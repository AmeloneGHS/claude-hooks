import { copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

/**
 * Create a backup of the settings file at settingsPath + '.backup'.
 *
 * Returns the backup path on success, or empty string if the source doesn't exist.
 * The backup file is overwritten on each call (single .backup file strategy).
 */
export async function createBackup(settingsPath: string): Promise<string> {
  const backupPath = settingsPath + '.backup';

  try {
    await access(settingsPath, constants.F_OK);
    await copyFile(settingsPath, backupPath);
    return backupPath;
  } catch {
    // Source file does not exist — nothing to back up
    return '';
  }
}

/**
 * Restore the settings file from its backup (.backup file).
 *
 * Returns true on success, false if no backup exists.
 */
export async function restoreBackup(settingsPath: string): Promise<boolean> {
  const backupPath = settingsPath + '.backup';

  try {
    await access(backupPath, constants.F_OK);
    await copyFile(backupPath, settingsPath);
    return true;
  } catch {
    // No backup exists
    return false;
  }
}
