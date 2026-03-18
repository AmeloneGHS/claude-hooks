import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { readSettings, writeSettings, applyMerge } from '../../src/config/manager.js';
import type { ClaudeSettings } from '../../src/types/settings.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'claude-hooks-manager-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('readSettings', () => {
  it('returns parsed ClaudeSettings from file', async () => {
    const filePath = join(tmpDir, 'settings.json');
    const settings: ClaudeSettings = {
      env: { FOO: 'bar' },
      hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: '/guard.sh' }] }] },
    };
    await writeFile(filePath, JSON.stringify(settings), 'utf8');

    const result = await readSettings(filePath);
    expect(result).toEqual(settings);
  });

  it('returns empty object if file does not exist', async () => {
    const filePath = join(tmpDir, 'nonexistent.json');
    const result = await readSettings(filePath);
    expect(result).toEqual({});
  });
});

describe('writeSettings', () => {
  it('writes JSON with detected indentation (2-space)', async () => {
    const filePath = join(tmpDir, 'settings.json');
    const originalRaw = '{\n  "env": {}\n}';
    const settings: ClaudeSettings = { env: { FOO: 'bar' } };

    await writeSettings(filePath, settings, originalRaw);

    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('  '); // 2-space indent
    expect(content.endsWith('\n')).toBe(true);
  });

  it('writes JSON with tab indentation when detected', async () => {
    const filePath = join(tmpDir, 'settings.json');
    const originalRaw = '{\n\t"env": {}\n}';
    const settings: ClaudeSettings = { env: { FOO: 'bar' } };

    await writeSettings(filePath, settings, originalRaw);

    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('\t');
    expect(content.endsWith('\n')).toBe(true);
  });
});

describe('applyMerge', () => {
  it('creates backup then writes merged result to disk', async () => {
    const filePath = join(tmpDir, 'settings.json');
    const backupPath = filePath + '.backup';
    const initial: ClaudeSettings = { env: { KEY: 'val' } };
    await writeFile(filePath, JSON.stringify(initial, null, 2), 'utf8');

    const result = await applyMerge({
      settingsPath: filePath,
      newHooks: [{ event: 'PreToolUse', matcher: 'Edit', hook: { type: 'command', command: '/guard.sh' } }],
    });

    // Backup must exist
    await expect(access(backupPath)).resolves.toBeUndefined();

    // Result should have the added hook
    expect(result.added).toHaveLength(1);
    expect(result.added[0].command).toBe('/guard.sh');

    // Written to disk
    const written = JSON.parse(await readFile(filePath, 'utf8'));
    expect(written.hooks?.['PreToolUse']).toHaveLength(1);

    // Non-hook keys preserved
    expect(written.env).toEqual({ KEY: 'val' });
  });

  it('does NOT write to disk when dryRun=true', async () => {
    const filePath = join(tmpDir, 'settings.json');
    const initial: ClaudeSettings = { env: { KEY: 'val' } };
    await writeFile(filePath, JSON.stringify(initial, null, 2), 'utf8');

    await applyMerge({
      settingsPath: filePath,
      newHooks: [{ event: 'PostToolUse', hook: { type: 'command', command: '/post.sh' } }],
      dryRun: true,
    });

    // File should still be the original (not written)
    const content = JSON.parse(await readFile(filePath, 'utf8'));
    expect(content.hooks).toBeUndefined();
  });

  it('still returns merge result when dryRun=true', async () => {
    const filePath = join(tmpDir, 'settings.json');
    await writeFile(filePath, JSON.stringify({}), 'utf8');

    const result = await applyMerge({
      settingsPath: filePath,
      newHooks: [{ event: 'SessionStart', hook: { type: 'command', command: '/session.sh' } }],
      dryRun: true,
    });

    expect(result.added).toHaveLength(1);
    expect(result.settings.hooks?.['SessionStart']).toHaveLength(1);
  });
});
