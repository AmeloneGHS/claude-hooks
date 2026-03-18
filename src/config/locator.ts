import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';

export type Scope = 'user' | 'project' | 'local';

/**
 * Walk up from cwd looking for .git to find the project root.
 * Only checks .git (not .claude) to avoid resolving to ~/.claude on machines
 * that have user-scope Claude config. Falls back to cwd if no .git found.
 */
function findProjectRoot(): string {
  let dir = resolve(process.cwd());

  while (true) {
    if (existsSync(join(dir, '.git'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return process.cwd();
}

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
