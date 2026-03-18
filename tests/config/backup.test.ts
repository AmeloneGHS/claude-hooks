import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { createBackup, restoreBackup } from '../../src/config/backup.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'claude-hooks-backup-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('createBackup', () => {
  it('copies settings.json to settings.json.backup', async () => {
    const settingsPath = join(tmpDir, 'settings.json');
    const backupPath = settingsPath + '.backup';
    const content = JSON.stringify({ hooks: {} });

    await writeFile(settingsPath, content, 'utf8');
    const result = await createBackup(settingsPath);

    expect(result).toBe(backupPath);
    const backupContent = await readFile(backupPath, 'utf8');
    expect(backupContent).toBe(content);
  });

  it('returns empty string if settings file does not exist', async () => {
    const settingsPath = join(tmpDir, 'nonexistent.json');
    const result = await createBackup(settingsPath);
    expect(result).toBe('');
  });
});

describe('restoreBackup', () => {
  it('copies backup file over settings file', async () => {
    const settingsPath = join(tmpDir, 'settings.json');
    const backupPath = settingsPath + '.backup';
    const originalContent = JSON.stringify({ hooks: { PreToolUse: [] } });
    const backupContent = JSON.stringify({ hooks: {} });

    await writeFile(settingsPath, originalContent, 'utf8');
    await writeFile(backupPath, backupContent, 'utf8');

    const result = await restoreBackup(settingsPath);

    expect(result).toBe(true);
    const restoredContent = await readFile(settingsPath, 'utf8');
    expect(restoredContent).toBe(backupContent);
  });

  it('returns false if no backup exists', async () => {
    const settingsPath = join(tmpDir, 'settings.json');
    const result = await restoreBackup(settingsPath);
    expect(result).toBe(false);
  });
});
