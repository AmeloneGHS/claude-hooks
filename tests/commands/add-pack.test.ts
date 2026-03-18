import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { _addPackAt, _addAt } from '../../src/commands/add.js';

let tmp: string;
let settingsPath: string;
let hooksDir: string;
let sourceHooksDir: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'claude-hooks-pack-test-'));
  settingsPath = join(tmp, '.claude', 'settings.json');
  hooksDir = join(tmp, '.claude', 'hooks');
  sourceHooksDir = join(tmp, 'registry', 'hooks');

  await mkdir(join(tmp, '.claude'), { recursive: true });
  await mkdir(hooksDir, { recursive: true });
  await mkdir(sourceHooksDir, { recursive: true });

  // Create fake scripts for all hooks in security-pack
  await writeFile(
    join(sourceHooksDir, 'sensitive-path-guard.sh'),
    '#!/bin/bash\necho "sensitive-path-guard"\n',
    'utf8',
  );
  await writeFile(
    join(sourceHooksDir, 'exit-code-enforcer.sh'),
    '#!/bin/bash\necho "exit-code-enforcer"\n',
    'utf8',
  );
  // Also create quality-pack scripts
  await writeFile(
    join(sourceHooksDir, 'post-edit-lint.sh'),
    '#!/bin/bash\necho "post-edit-lint"\n',
    'utf8',
  );
  await writeFile(
    join(sourceHooksDir, 'ts-check.sh'),
    '#!/bin/bash\necho "ts-check"\n',
    'utf8',
  );
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('_addPackAt', () => {
  it('installs all hooks in security-pack', async () => {
    await _addPackAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      packName: 'security-pack',
    });

    // Both scripts should be in hooksDir
    expect(existsSync(join(hooksDir, 'sensitive-path-guard.sh'))).toBe(true);
    expect(existsSync(join(hooksDir, 'exit-code-enforcer.sh'))).toBe(true);
  });

  it('adds all pack hooks to settings.json', async () => {
    await _addPackAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      packName: 'security-pack',
    });

    const raw = await readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);

    // sensitive-path-guard: PreToolUse/Edit|Write
    const preToolUseGroups: Array<{ matcher?: string; hooks: Array<{ command: string }> }> =
      parsed.hooks['PreToolUse'] ?? [];
    const hasSPG = preToolUseGroups.some(
      (g) =>
        g.matcher === 'Edit|Write' &&
        g.hooks.some((h) => h.command.includes('sensitive-path-guard.sh')),
    );
    expect(hasSPG).toBe(true);

    // exit-code-enforcer: PreToolUse/Bash
    const hasECE = preToolUseGroups.some(
      (g) =>
        g.matcher === 'Bash' &&
        g.hooks.some((h) => h.command.includes('exit-code-enforcer.sh')),
    );
    expect(hasECE).toBe(true);
  });

  it('skips hooks that are already installed', async () => {
    // Install one hook first
    await _addAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      hookName: 'sensitive-path-guard',
    });

    // Now install the whole pack
    await _addPackAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      packName: 'security-pack',
    });

    // Both should still be installed, no duplicates
    const raw = await readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    const preToolUse: Array<{ matcher?: string; hooks: Array<{ command: string }> }> =
      parsed.hooks['PreToolUse'] ?? [];

    // Count how many times sensitive-path-guard appears
    let spgCount = 0;
    for (const group of preToolUse) {
      if (group.matcher === 'Edit|Write') {
        spgCount += group.hooks.filter((h) => h.command.includes('sensitive-path-guard.sh')).length;
      }
    }
    expect(spgCount).toBe(1); // Should not duplicate
  });

  it('returns without error for unknown pack name', async () => {
    await expect(
      _addPackAt({
        settingsPath,
        hooksDir,
        sourceHooksDir,
        packName: 'nonexistent-pack',
      }),
    ).resolves.toBeUndefined();
  });

  it('installs quality-pack hooks', async () => {
    await _addPackAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      packName: 'quality-pack',
    });

    expect(existsSync(join(hooksDir, 'post-edit-lint.sh'))).toBe(true);
    expect(existsSync(join(hooksDir, 'ts-check.sh'))).toBe(true);
  });

  it('dry-run does not write files', async () => {
    await _addPackAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      packName: 'security-pack',
      dryRun: true,
    });

    expect(existsSync(join(hooksDir, 'sensitive-path-guard.sh'))).toBe(false);
    expect(existsSync(settingsPath)).toBe(false);
  });
});

describe('addCommand unknown name', () => {
  it('_addAt handles unknown name without throwing', async () => {
    // unknown name that's neither a hook nor a pack — existing behavior
    await expect(
      _addAt({
        settingsPath,
        hooksDir,
        sourceHooksDir,
        hookName: 'totally-unknown-thing',
      }),
    ).resolves.toBeUndefined();
  });
});
