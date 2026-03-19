import { unlink, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname as pathDirname } from 'node:path';
import { getHook } from '../registry/index.js';
import { readSettings, writeSettings } from '../config/manager.js';
import { createBackup } from '../config/backup.js';
import { getSettingsPath, getHooksDir } from '../config/locator.js';
import { log } from '../utils/logger.js';
import type { Scope } from '../config/locator.js';
import type { ClaudeSettings, HookGroup } from '../types/settings.js';

export interface RemoveOptions {
  scope: string;
  hookName: string;
  dryRun?: boolean;
}

export interface RemoveAtOptions {
  settingsPath: string;
  hooksDir: string;
  hookName: string;
  dryRun?: boolean;
}

/**
 * Remove hook entries that reference the given exact script path from a settings object.
 * Only removes entries whose command matches the exact path — won't touch unrelated
 * hooks that happen to share a filename.
 * Returns the modified settings and a count of removed entries.
 */
function removeHookFromSettings(
  settings: ClaudeSettings,
  exactScriptPath: string,
): { settings: ClaudeSettings; removedCount: number } {
  if (!settings.hooks) {
    return { settings, removedCount: 0 };
  }

  const modified = structuredClone(settings) as ClaudeSettings;
  let removedCount = 0;

  for (const [event, groups] of Object.entries(modified.hooks!)) {
    const filtered: HookGroup[] = [];
    for (const group of groups as HookGroup[]) {
      // Filter out only commands that exactly match the installed path
      const remainingHooks = group.hooks.filter((h) => {
        const matches = h.command === exactScriptPath;
        if (matches) removedCount++;
        return !matches;
      });
      // Only keep the group if it still has hooks
      if (remainingHooks.length > 0) {
        filtered.push({ ...group, hooks: remainingHooks });
      }
    }
    modified.hooks![event] = filtered;
  }

  return { settings: modified, removedCount };
}

/**
 * Core remove logic. Accepts explicit paths for testability.
 *
 * Flow:
 * 1. Look up hook in registry — error and return if not found
 * 2. Check if script exists in hooksDir — warn and return if not installed
 * 3. If dry-run: print preview and return
 * 4. Read settings, filter out matching hook entries
 * 5. Backup settings
 * 6. Write updated settings
 * 7. Delete script file
 * 8. Print summary
 */
export async function _removeAt(opts: RemoveAtOptions): Promise<void> {
  const { settingsPath, hooksDir, hookName, dryRun = false } = opts;

  // 1. Look up hook in registry
  const hook = getHook(hookName);
  if (!hook) {
    log.error(`Unknown hook: "${hookName}". Run "claude-hooks list" to see available hooks.`);
    return;
  }

  const scriptPath = join(hooksDir, hook.scriptFile);
  const scriptExists = existsSync(scriptPath);

  // Check if anything is installed (script or settings entry)
  // Pass the exact installed path so we only remove entries for THIS scope's install
  const existing = await readSettings(settingsPath);
  const { settings: updated, removedCount } = removeHookFromSettings(existing, scriptPath);

  if (!scriptExists && removedCount === 0) {
    log.warn(`Hook "${hookName}" is not installed.`);
    return;
  }

  // 3. Dry-run preview
  if (dryRun) {
    if (scriptExists) {
      log.dryRun(`Would delete: ${scriptPath}`);
    }
    if (removedCount > 0) {
      log.dryRun(`Would remove ${removedCount} settings entr${removedCount === 1 ? 'y' : 'ies'} from settings.json`);
    }
    return;
  }

  // 4. Backup settings (only if settings file exists and we're changing it)
  if (removedCount > 0 && existsSync(settingsPath)) {
    await createBackup(settingsPath);

    // 5. Write updated settings
    let originalRaw: string | undefined;
    try {
      originalRaw = await readFile(settingsPath, 'utf8');
    } catch {
      originalRaw = undefined;
    }
    const settingsParent = pathDirname(settingsPath);
    await mkdir(settingsParent, { recursive: true });
    await writeSettings(settingsPath, updated, originalRaw);
  }

  // 6. Delete script file (if it exists)
  if (scriptExists) {
    await unlink(scriptPath);
  }

  // 7. Print summary
  log.success(`Removed hook: ${hookName}`);
  if (scriptExists) {
    log.dim(`  Deleted: ${scriptPath}`);
  }
  if (removedCount > 0) {
    log.dim(`  Removed ${removedCount} settings entr${removedCount === 1 ? 'y' : 'ies'} from settings.json`);
  }
  if (!scriptExists && removedCount > 0) {
    log.dim(`  (Script was already missing — cleaned up settings entry)`);
  }
}

/**
 * Public remove command — resolves paths from scope then delegates to _removeAt.
 */
export async function removeCommand(opts: RemoveOptions): Promise<void> {
  const validScopes: Scope[] = ['user', 'project', 'local'];
  const scope: Scope = validScopes.includes(opts.scope as Scope)
    ? (opts.scope as Scope)
    : 'project';

  await _removeAt({
    settingsPath: getSettingsPath(scope),
    hooksDir: getHooksDir(scope),
    hookName: opts.hookName,
    dryRun: opts.dryRun,
  });
}
