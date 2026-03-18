import { log } from '../utils/logger.js';
import { getSettingsPath } from '../config/locator.js';
import { restoreBackup } from '../config/backup.js';
import type { Scope } from '../config/locator.js';

export interface RestoreOptions {
  scope: string;
}

/**
 * Restore settings.json from the last .backup file for the given scope.
 *
 * Exits 0 on success, 1 if no backup is found.
 */
export async function restoreCommand(opts: RestoreOptions): Promise<void> {
  const scope = opts.scope as Scope;
  const settingsPath = getSettingsPath(scope);
  const backupPath = settingsPath + '.backup';

  const success = await restoreBackup(settingsPath);

  if (success) {
    log.success(`Restored settings from backup`);
    log.dim(`  settings: ${settingsPath}`);
    log.dim(`  restored from: ${backupPath}`);
    process.exit(0);
  } else {
    log.error(`No backup found for scope '${scope}'`);
    log.dim(`  expected: ${backupPath}`);
    process.exit(1);
  }
}
