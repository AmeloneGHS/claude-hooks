import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pc from 'picocolors';
import { getHook, listHooks } from '../registry/index.js';
import { getHooksDir } from '../config/locator.js';

// Resolve the package root by walking up from __dirname until registry/hooks/fixtures exists.
// Handles both src/commands/ (dev) and dist/ (built/installed) layouts.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findPackageRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'registry', 'hooks', 'fixtures'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(__dirname, '..', '..');
}

const PACKAGE_ROOT = findPackageRoot();
const BUNDLED_HOOKS_DIR = join(PACKAGE_ROOT, 'registry', 'hooks');
const BUNDLED_FIXTURES_DIR = join(PACKAGE_ROOT, 'registry', 'hooks', 'fixtures');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Fixture {
  description: string;
  input: Record<string, unknown>;
  expectedExitCode: number;
  env?: Record<string, string>;
}

export interface TestResult {
  hookName: string;
  description: string;
  expectedExitCode: number;
  actualExitCode: number;
  passed: boolean;
  stdout: string;
  stderr: string;
}

export interface TestSummary {
  passed: number;
  failed: number;
  results: TestResult[];
}

export interface RunFixtureOptions {
  hookName?: string;
}

// ─── Core engine (exported for unit testing) ─────────────────────────────────

/**
 * Discover fixture JSON files in a directory.
 * Returns an empty array if the directory does not exist.
 */
export async function discoverFixtures(fixtureDir: string): Promise<Fixture[]> {
  if (!existsSync(fixtureDir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = await readdir(fixtureDir);
  } catch {
    return [];
  }

  const fixtures: Fixture[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const filePath = join(fixtureDir, entry);
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Fixture;
      fixtures.push(parsed);
    } catch {
      // Skip malformed fixture files
    }
  }
  return fixtures;
}

/**
 * Run a single fixture against a hook script.
 * Spawns `bash <scriptPath>` with fixture.input as JSON on stdin.
 * Compares the actual exit code to fixture.expectedExitCode.
 */
export async function runFixture(
  scriptPath: string,
  fixture: Fixture,
  opts: RunFixtureOptions = {},
): Promise<TestResult> {
  const hookName = opts.hookName ?? '';
  const input = JSON.stringify(fixture.input);

  const result = spawnSync('bash', [scriptPath], {
    input,
    encoding: 'utf8',
    env: { ...process.env, ...(fixture.env ?? {}) },
  });

  const actualExitCode = result.status ?? -1;
  const passed = actualExitCode === fixture.expectedExitCode;

  return {
    hookName,
    description: fixture.description,
    expectedExitCode: fixture.expectedExitCode,
    actualExitCode,
    passed,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// ─── Script path resolution ──────────────────────────────────────────────────

/**
 * Resolve the absolute path to a bundled hook script.
 */
function resolveBundledScriptPath(scriptFile: string): string {
  return join(BUNDLED_HOOKS_DIR, scriptFile);
}

// ─── Single hook test ────────────────────────────────────────────────────────

async function testHook(
  hookName: string,
  scope: string,
): Promise<TestResult[]> {
  const def = getHook(hookName);
  const userHooksDir = getHooksDir(scope as 'user' | 'project' | 'local');

  // Resolve script path: bundled hook or user-created hook
  let scriptPath: string;
  if (def) {
    scriptPath = resolveBundledScriptPath(def.scriptFile);
  } else {
    // Check if it's a user-created hook
    const userScript = join(userHooksDir, `${hookName}.sh`);
    if (existsSync(userScript)) {
      scriptPath = userScript;
    } else {
      console.error(pc.red(`Hook not found: ${hookName}`));
      console.error(pc.dim('  Not in registry and no script at: ' + userScript));
      console.error(pc.dim('  Run `claude-hooks list` to see available hooks'));
      process.exitCode = 1;
      return [];
    }
  }

  // Discover fixtures: bundled first, then user fixtures dir
  const bundledFixtureDir = join(BUNDLED_FIXTURES_DIR, hookName);
  const userFixtureDir = join(userHooksDir, 'fixtures', hookName);

  const bundledFixtures = await discoverFixtures(bundledFixtureDir);
  const userFixtures = await discoverFixtures(userFixtureDir);
  const allFixtures = [...bundledFixtures, ...userFixtures];

  if (allFixtures.length === 0) {
    console.log(pc.yellow(`  warning`) + `  ${hookName}: no fixtures found`);
    console.log(pc.dim(`    Add fixtures at: ${userFixtureDir}/*.json`));
    return [];
  }

  const results: TestResult[] = [];
  for (const fixture of allFixtures) {
    const result = await runFixture(scriptPath, fixture, { hookName });
    results.push(result);
    printResult(result);
  }
  return results;
}

// ─── Output helpers ──────────────────────────────────────────────────────────

function printResult(result: TestResult): void {
  if (result.passed) {
    const label = pc.green('  PASS');
    const name = pc.bold(result.hookName);
    console.log(`${label}  ${name}: ${result.description}`);
  } else {
    const label = pc.red('  FAIL');
    const name = pc.bold(result.hookName);
    const detail = pc.dim(`(expected ${result.expectedExitCode}, got ${result.actualExitCode})`);
    console.log(`${label}  ${name}: ${result.description} ${detail}`);
  }
}

function printSummary(summary: TestSummary): void {
  const { passed, failed } = summary;
  const passStr = pc.green(`${passed} passed`);
  const failStr = failed > 0 ? pc.red(`${failed} failed`) : pc.dim(`${failed} failed`);
  console.log(`\n${passStr}, ${failStr}`);
}

// ─── testCommand (CLI entry point) ──────────────────────────────────────────

export interface TestCommandOpts {
  hookName?: string;
  all?: boolean;
  scope?: string;
}

export async function testCommand(opts: TestCommandOpts): Promise<TestSummary> {
  const scope = opts.scope ?? 'project';
  const allResults: TestResult[] = [];

  if (opts.all) {
    // Test only hooks that are actually installed (have scripts in hooks dir) + custom hooks
    const userHooksDir = getHooksDir(scope as 'user' | 'project' | 'local');
    const bundledHooks = listHooks();
    const testedNames = new Set<string>();

    // 1. Bundled hooks that are installed (script exists in hooks dir)
    for (const def of bundledHooks) {
      const installedScript = join(userHooksDir, def.scriptFile);
      if (existsSync(installedScript)) {
        console.log(pc.bold(`\n${def.name}`));
        const results = await testHook(def.name, scope);
        allResults.push(...results);
        testedNames.add(def.name);
      }
    }

    // 2. User-created hooks with fixtures (discovered from .claude/hooks/fixtures/)
    const userFixturesRoot = join(userHooksDir, 'fixtures');
    if (existsSync(userFixturesRoot)) {
      try {
        const dirs = await readdir(userFixturesRoot, { withFileTypes: true });
        for (const d of dirs) {
          if (d.isDirectory() && !testedNames.has(d.name)) {
            const userScript = join(userHooksDir, `${d.name}.sh`);
            if (existsSync(userScript)) {
              console.log(pc.bold(`\n${d.name}`) + pc.dim(' (custom)'));
              const results = await testHook(d.name, scope);
              allResults.push(...results);
            }
          }
        }
      } catch {
        // fixtures dir unreadable — skip custom hooks
      }
    }

    if (testedNames.size === 0 && allResults.length === 0) {
      console.log(pc.yellow('\nNo installed hooks found. Run `claude-hooks add <hook>` first.'));
    }
  } else if (opts.hookName) {
    console.log(pc.bold(`\n${opts.hookName}`));
    const results = await testHook(opts.hookName, scope);
    allResults.push(...results);
  } else {
    console.error(pc.red('Error: specify a hook name or use --all'));
    process.exitCode = 1;
    return { passed: 0, failed: 0, results: [] };
  }

  const passed = allResults.filter((r) => r.passed).length;
  const failed = allResults.filter((r) => !r.passed).length;

  const summary: TestSummary = { passed, failed, results: allResults };
  printSummary(summary);

  if (failed > 0) {
    process.exitCode = 1;
  }

  return summary;
}
