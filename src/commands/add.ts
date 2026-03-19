import { copyFile, chmod, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getHook, getPack } from '../registry/index.js';
import { applyMerge } from '../config/manager.js';
import { getSettingsPath, getHooksDir } from '../config/locator.js';
import { log } from '../utils/logger.js';
import type { Scope } from '../config/locator.js';

export interface AddOptions {
  scope: string;
  hookName: string;
  dryRun?: boolean;
}

export interface AddAtOptions {
  settingsPath: string;
  hooksDir: string;
  /**
   * Override for the source hooks directory (registry/hooks/).
   * Defaults to the bundled registry/hooks/ relative to this file.
   * Used in tests to provide a fake scripts directory.
   */
  sourceHooksDir?: string;
  hookName: string;
  dryRun?: boolean;
}

/**
 * Resolve the bundled registry/hooks/ directory by walking up from this file.
 * Handles both src/commands/ (dev) and dist/ (built/installed) layouts.
 */
function getDefaultSourceHooksDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  let dir = dirname(__filename);
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'registry', 'hooks');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback
  return join(dirname(__filename), '..', '..', 'registry', 'hooks');
}

/**
 * Core add logic. Accepts explicit paths for testability.
 *
 * Flow:
 * 1. Look up hook in registry — error and return if not found
 * 2. If dry-run: print preview and return
 * 3. Ensure hooksDir exists (mkdir -p)
 * 4. Copy script from sourceHooksDir to hooksDir
 * 5. chmod +x the copied script
 * 6. Call applyMerge to add settings entry
 * 7. Print summary
 */
export async function _addAt(opts: AddAtOptions): Promise<void> {
  const { settingsPath, hooksDir, hookName, dryRun = false } = opts;
  const sourceHooksDir = opts.sourceHooksDir ?? getDefaultSourceHooksDir();

  // 1. Look up hook in registry
  const hook = getHook(hookName);
  if (!hook) {
    log.error(`Unknown hook: "${hookName}". Run "claude-hooks list" to see available hooks.`);
    return;
  }

  const srcPath = join(sourceHooksDir, hook.scriptFile);
  const destPath = join(hooksDir, hook.scriptFile);

  // 2. Dry-run preview
  if (dryRun) {
    log.dryRun(`Would copy: ${srcPath} -> ${destPath}`);
    log.dryRun(`Would chmod +x: ${destPath}`);
    log.dryRun(`Would add ${hook.event}${hook.matcher ? ` [${hook.matcher}]` : ''} hook to settings.json`);
    return;
  }

  // 3. Check if already installed (merge first to detect duplicate, don't copy yet)
  await mkdir(hooksDir, { recursive: true });

  const result = await applyMerge({
    settingsPath,
    newHooks: [
      {
        event: hook.event,
        matcher: hook.matcher,
        hook: { type: 'command', command: destPath },
      },
    ],
    dryRun: false,
  });

  // 4. Only copy script if the settings entry was actually added (not a duplicate)
  if (result.added.length > 0) {
    await copyFile(srcPath, destPath);
    await chmod(destPath, 0o755);
  }

  // 7. Print summary
  if (result.added.length > 0) {
    log.success(`Installed hook: ${hook.name}`);
    log.dim(`  Script: ${destPath}`);
    if (hook.pack) {
      log.dim(`  Pack: ${hook.pack}`);
    }
    log.dim(`  Event: ${hook.event}${hook.matcher ? ` [matcher: ${hook.matcher}]` : ''}`);
  } else if (result.skipped.length > 0) {
    log.warn(`Hook "${hook.name}" is already installed (skipped).`);
  }
}

export interface AddPackAtOptions {
  settingsPath: string;
  hooksDir: string;
  /**
   * Override for the source hooks directory (registry/hooks/).
   * Used in tests to provide a fake scripts directory.
   */
  sourceHooksDir?: string;
  packName: string;
  dryRun?: boolean;
}

/**
 * Install all hooks in a named pack.
 * Delegates to _addAt for each hook, which handles deduplication.
 */
export async function _addPackAt(opts: AddPackAtOptions): Promise<void> {
  const { settingsPath, hooksDir, packName, dryRun = false } = opts;
  const sourceHooksDir = opts.sourceHooksDir ?? getDefaultSourceHooksDir();

  const pack = getPack(packName);
  if (!pack) {
    log.error(`Unknown hook or pack: "${packName}". Run "claude-hooks list" to see available options.`);
    return;
  }

  log.info(`Installing ${packName} (${pack.hooks.length} hooks)...`);

  const installed: string[] = [];
  const skipped: string[] = [];

  for (const hookName of pack.hooks) {
    const hook = getHook(hookName);
    if (!hook) {
      log.warn(`Pack "${packName}" references unknown hook "${hookName}" — skipping.`);
      continue;
    }

    if (dryRun) {
      const srcPath = join(sourceHooksDir, hook.scriptFile);
      const destPath = join(hooksDir, hook.scriptFile);
      log.dryRun(`Would install hook: ${hookName}`);
      log.dryRun(`  ${srcPath} -> ${destPath}`);
      installed.push(hookName);
      continue;
    }

    // Capture console output to detect skip (workaround: call _addAt and check result via applyMerge)
    await _addAt({ settingsPath, hooksDir, sourceHooksDir, hookName, dryRun });
    installed.push(hookName);
  }

  if (!dryRun) {
    log.success(`Installed ${packName} (${installed.length} hooks): ${installed.join(', ')}`);
  }
}

/**
 * Public add command — resolves paths from scope then delegates to _addAt or _addPackAt.
 */
export async function addCommand(opts: AddOptions): Promise<void> {
  const validScopes: Scope[] = ['user', 'project', 'local'];
  const scope: Scope = validScopes.includes(opts.scope as Scope)
    ? (opts.scope as Scope)
    : 'project';

  const settingsPath = getSettingsPath(scope);
  const hooksDir = getHooksDir(scope);

  // Check if it's a pack first
  if (getPack(opts.hookName)) {
    await _addPackAt({
      settingsPath,
      hooksDir,
      packName: opts.hookName,
      dryRun: opts.dryRun,
    });
    return;
  }

  // Check if it's a known hook
  if (getHook(opts.hookName)) {
    await _addAt({
      settingsPath,
      hooksDir,
      hookName: opts.hookName,
      dryRun: opts.dryRun,
    });
    return;
  }

  // Neither hook nor pack
  log.error(`Unknown hook or pack: "${opts.hookName}". Run "claude-hooks list" to see available options.`);
}
