import { describe, it, expect } from 'vitest';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { getSettingsPath, getBackupPath, getHooksDir } from '../../src/config/locator.js';

describe('getSettingsPath', () => {
  it("returns homedir + .claude/settings.json for 'user' scope", () => {
    const result = getSettingsPath('user');
    expect(result).toBe(`${homedir()}/.claude/settings.json`);
  });

  it("ends with .claude/settings.json for 'project' scope", () => {
    const result = getSettingsPath('project');
    expect(result.endsWith('.claude/settings.json') || result.endsWith('.claude\\settings.json')).toBe(true);
  });

  it("ends with .claude/settings.local.json for 'local' scope", () => {
    const result = getSettingsPath('local');
    expect(result.endsWith('.claude/settings.local.json') || result.endsWith('.claude\\settings.local.json')).toBe(true);
  });
});

describe('getBackupPath', () => {
  it("returns settingsPath + '.backup' for user scope", () => {
    const settingsPath = getSettingsPath('user');
    const result = getBackupPath('user');
    expect(result).toBe(settingsPath + '.backup');
  });

  it("returns settingsPath + '.backup' for project scope", () => {
    const settingsPath = getSettingsPath('project');
    const result = getBackupPath('project');
    expect(result).toBe(settingsPath + '.backup');
  });

  it("returns settingsPath + '.backup' for local scope", () => {
    const settingsPath = getSettingsPath('local');
    const result = getBackupPath('local');
    expect(result).toBe(settingsPath + '.backup');
  });
});

describe('getHooksDir', () => {
  it("returns homedir + .claude/hooks for 'user' scope", () => {
    const result = getHooksDir('user');
    expect(result).toBe(`${homedir()}/.claude/hooks`);
  });

  it("ends with .claude/hooks for 'project' scope", () => {
    const result = getHooksDir('project');
    expect(result.endsWith('.claude/hooks') || result.endsWith('.claude\\hooks')).toBe(true);
  });

  it("ends with .claude/hooks for 'local' scope (same as project)", () => {
    const result = getHooksDir('local');
    expect(result.endsWith('.claude/hooks') || result.endsWith('.claude\\hooks')).toBe(true);
  });
});
