import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

export type Scope = 'user' | 'project' | 'local';

/**
 * Walk up from cwd looking for .git or .claude directory to find the project root.
 * Falls back to cwd if neither is found, matching eslint/prettier behavior.
 * (Pitfall 5: project scope path resolution)
 */
function findProjectRoot(): string {
  let dir = process.cwd();
  const root = parse(dir).root;

  while (dir !== root) {
    if (existsSync(join(dir, '.git')) || existsSync(join(dir, '.claude'))) {
      return dir;
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  return process.cwd();
}

// Import parse from path to handle root detection cross-platform
import { parse } from 'node:path';

/**
 * Resolve the settings.json path for the given scope.
 *
 * - user:    ~/.claude/settings.json
 * - project: <project-root>/.claude/settings.json
 * - local:   <project-root>/.claude/settings.local.json
 */
export function getSettingsPath(scope: Scope): string {
  switch (scope) {
    case 'user':
      return join(homedir(), '.claude', 'settings.json');
    case 'project':
      return resolve(findProjectRoot(), '.claude', 'settings.json');
    case 'local':
      return resolve(findProjectRoot(), '.claude', 'settings.local.json');
  }
}

/**
 * Return the backup path for the given scope's settings file.
 * Always settingsPath + '.backup' (single backup file, overwritten on each write).
 */
export function getBackupPath(scope: Scope): string {
  return getSettingsPath(scope) + '.backup';
}

/**
 * Resolve the hooks directory for the given scope.
 *
 * - user:           ~/.claude/hooks
 * - project/local:  <project-root>/.claude/hooks
 */
export function getHooksDir(scope: Scope): string {
  switch (scope) {
    case 'user':
      return join(homedir(), '.claude', 'hooks');
    case 'project':
    case 'local':
      return resolve(findProjectRoot(), '.claude', 'hooks');
  }
}
