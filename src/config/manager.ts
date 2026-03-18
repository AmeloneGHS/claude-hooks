import { readFile, writeFile } from 'node:fs/promises';
import type { ClaudeSettings, MergeResult } from '../types/settings.js';
import type { HookEntry } from '../types/settings.js';
import { mergeHooks } from './merger.js';
import { createBackup } from './backup.js';

/**
 * Detect indentation from a raw JSON string.
 * Returns '\t' for tab-indented files, or the detected space count (defaulting to 2).
 * (Pitfall 6: preserve the user's indentation style to avoid git diff noise)
 */
function detectIndent(raw: string): string | number {
  const lines = raw.split('\n');
  for (const line of lines.slice(1)) {
    if (line.startsWith('\t')) return '\t';
    const match = line.match(/^( +)/);
    if (match) return match[1].length;
  }
  return 2;
}

/**
 * Read and parse settings.json from the given path.
 * Returns an empty object if the file does not exist.
 * Throws on malformed JSON or permission errors to prevent silent overwrites.
 */
export async function readSettings(path: string): Promise<ClaudeSettings> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as ClaudeSettings;
  } catch (err: unknown) {
    // File not found is expected — return empty settings
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ENOENT') {
      return {};
    }
    // Any other error (malformed JSON, permission denied) should propagate
    throw err;
  }
}

/**
 * Write ClaudeSettings to the given path as JSON.
 *
 * If originalRaw is provided, its indentation style is detected and preserved.
 * Always writes a trailing newline.
 */
export async function writeSettings(
  path: string,
  settings: ClaudeSettings,
  originalRaw?: string,
): Promise<void> {
  const indent = originalRaw ? detectIndent(originalRaw) : 2;
  const output = JSON.stringify(settings, null, indent) + '\n';
  await writeFile(path, output, 'utf8');
}

export interface ApplyMergeOptions {
  settingsPath: string;
  newHooks: {
    event: string;
    matcher?: string;
    hook: HookEntry;
  }[];
  dryRun?: boolean;
}

/**
 * High-level orchestrator: read -> merge -> backup -> write.
 *
 * Pipeline:
 * 1. Read existing settings (returns {} if file missing)
 * 2. Run pure mergeHooks()
 * 3. If not dry-run: createBackup() then writeSettings()
 * 4. Return MergeResult (always, even for dry-run)
 */
export async function applyMerge(opts: ApplyMergeOptions): Promise<MergeResult> {
  const { settingsPath, newHooks, dryRun = false } = opts;

  // 1. Read existing settings and capture raw for indent detection
  let originalRaw: string | undefined;
  let existing: ClaudeSettings;

  try {
    originalRaw = await readFile(settingsPath, 'utf8');
    existing = JSON.parse(originalRaw) as ClaudeSettings;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ENOENT') {
      existing = {};
      originalRaw = undefined;
    } else {
      throw err;
    }
  }

  // 2. Pure merge
  const result = mergeHooks({ existing, newHooks });

  // 3. If not dry-run: backup then write
  if (!dryRun) {
    await createBackup(settingsPath);
    await writeSettings(settingsPath, result.settings, originalRaw);
  }

  return result;
}
