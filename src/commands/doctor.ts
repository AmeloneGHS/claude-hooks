import { existsSync, accessSync, constants } from 'node:fs';
import pc from 'picocolors';
import { readSettings } from '../config/manager.js';
import { getSettingsPath, getHooksDir } from '../config/locator.js';
import type { Scope } from '../config/locator.js';
import type { ClaudeSettings, HookGroup } from '../types/settings.js';

export interface DoctorCheck {
  level: 'pass' | 'fail' | 'warn';
  message: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  passed: number;
  failed: number;
  warnings: number;
  exitCode: 0 | 1;
}

export interface DoctorAtOptions {
  settingsPath: string;
  hooksDir: string;
}

/**
 * Extract all command strings from the hooks section of settings.
 */
function extractCommands(hooks: Record<string, HookGroup[]>): Array<{ event: string; matcher?: string; command: string }> {
  const result: Array<{ event: string; matcher?: string; command: string }> = [];
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!group.hooks || !Array.isArray(group.hooks)) continue;
      for (const entry of group.hooks) {
        if (entry.type === 'command' && entry.command) {
          result.push({ event, matcher: group.matcher, command: entry.command });
        }
      }
    }
  }
  return result;
}

/**
 * Core doctor logic. Accepts explicit paths for testability.
 *
 * Runs 5 checks:
 * 1. Settings file exists and is valid JSON
 * 2. Hooks directory exists
 * 3. Installed scripts exist and are executable
 * 4. No orphaned settings entries (entries pointing to missing scripts) — covered by check 3
 * 5. No conflicting hooks (same event+matcher, different commands)
 */
export async function _doctorAt(opts: DoctorAtOptions): Promise<DoctorResult> {
  const { settingsPath, hooksDir } = opts;
  const checks: DoctorCheck[] = [];

  // ── Check 1: Settings file exists and is valid JSON ──────────────────────
  let settings: ClaudeSettings | undefined;

  if (!existsSync(settingsPath)) {
    checks.push({ level: 'warn', message: `Settings file not found: ${settingsPath}` });
  } else {
    try {
      settings = await readSettings(settingsPath);
      checks.push({ level: 'pass', message: 'Settings file valid' });
    } catch {
      checks.push({ level: 'fail', message: `Settings file parse error: malformed JSON at ${settingsPath}` });
    }
  }

  // ── Check 2: Hooks directory exists ──────────────────────────────────────
  if (!existsSync(hooksDir)) {
    checks.push({ level: 'fail', message: `Hooks dir not found: ${hooksDir}` });
  } else {
    checks.push({ level: 'pass', message: 'Hooks directory exists' });
  }

  // ── Checks 3 & 4: Installed scripts exist and are executable ─────────────
  if (settings !== undefined) {
    const hookDefs = settings.hooks as Record<string, HookGroup[]> | undefined;
    const allEntries = hookDefs ? extractCommands(hookDefs) : [];

    if (allEntries.length === 0) {
      checks.push({ level: 'pass', message: 'No hook scripts to validate' });
    } else {
      for (const { command: scriptPath } of allEntries) {
        if (!existsSync(scriptPath)) {
          checks.push({ level: 'fail', message: `Script not found: ${scriptPath}` });
        } else {
          try {
            accessSync(scriptPath, constants.X_OK);
            checks.push({ level: 'pass', message: `Script OK: ${scriptPath}` });
          } catch {
            checks.push({ level: 'fail', message: `Script not executable: ${scriptPath}` });
          }
        }
      }
    }

    // ── Check 5: No conflicting hooks (same event+matcher, different commands) ──
    if (hookDefs) {
      const tupleMap = new Map<string, Set<string>>();

      for (const { event, matcher, command } of allEntries) {
        const key = `${event}::${matcher ?? '__none__'}`;
        if (!tupleMap.has(key)) {
          tupleMap.set(key, new Set());
        }
        tupleMap.get(key)!.add(command);
      }

      let conflictFound = false;
      for (const [key, commands] of tupleMap.entries()) {
        if (commands.size > 1) {
          const parts = key.split('::');
          const event = parts[0];
          const matcher = parts[1];
          const label = matcher === '__none__' ? event : `${event}/${matcher}`;
          checks.push({
            level: 'warn',
            message: `Conflicting hooks: ${label} has ${commands.size} commands`,
          });
          conflictFound = true;
        }
      }

      if (!conflictFound) {
        checks.push({ level: 'pass', message: 'No conflicting hooks' });
      }
    } else {
      checks.push({ level: 'pass', message: 'No conflicting hooks' });
    }
  }

  // ── Tally ─────────────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.level === 'pass').length;
  const failed = checks.filter((c) => c.level === 'fail').length;
  const warnings = checks.filter((c) => c.level === 'warn').length;
  const exitCode: 0 | 1 = failed > 0 ? 1 : 0;

  return { checks, passed, failed, warnings, exitCode };
}

/**
 * Print doctor results to the terminal with colored output.
 */
function printResults(result: DoctorResult): void {
  console.log('');
  for (const check of result.checks) {
    if (check.level === 'pass') {
      console.log(pc.green('[PASS]') + ' ' + check.message);
    } else if (check.level === 'fail') {
      console.log(pc.red('[FAIL]') + ' ' + check.message);
    } else {
      console.log(pc.yellow('[WARN]') + ' ' + check.message);
    }
  }
  console.log('');
  const summary = `${result.passed} passed, ${result.failed} failed, ${result.warnings} warning${result.warnings !== 1 ? 's' : ''}`;
  if (result.failed > 0) {
    console.log(pc.red(summary));
  } else if (result.warnings > 0) {
    console.log(pc.yellow(summary));
  } else {
    console.log(pc.green(summary));
  }
}

/**
 * Public doctor command — resolves paths from scope then delegates to _doctorAt.
 */
export async function doctorCommand(opts: { scope: string }): Promise<void> {
  const validScopes: Scope[] = ['user', 'project', 'local'];
  const scope: Scope = validScopes.includes(opts.scope as Scope)
    ? (opts.scope as Scope)
    : 'project';

  const result = await _doctorAt({
    settingsPath: getSettingsPath(scope),
    hooksDir: getHooksDir(scope),
  });

  printResults(result);
  process.exit(result.exitCode);
}
