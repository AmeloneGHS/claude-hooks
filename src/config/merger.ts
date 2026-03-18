import type { ClaudeSettings, HookEntry, HookGroup, MergeResult } from '../types/settings.js';

/** Input spec for the pure merge function */
export interface MergeInput {
  existing: ClaudeSettings;
  newHooks: {
    event: string;
    matcher?: string;
    hook: HookEntry;
  }[];
}

/**
 * Check whether the given hook already exists in an event's group array.
 * A duplicate is defined as: same matcher (or both undefined) + same command string.
 */
function isDuplicate(groups: HookGroup[], matcher: string | undefined, command: string): boolean {
  return groups.some((group) => {
    const matcherMatches = group.matcher === matcher;
    const commandMatches = group.hooks.some((h) => h.command === command);
    return matcherMatches && commandMatches;
  });
}

/**
 * Pure merge function — no I/O, no side effects.
 *
 * Takes existing ClaudeSettings and a list of new hook entries to add.
 * Returns a new ClaudeSettings with hooks merged, plus added/skipped reports.
 *
 * Rules:
 * - Only the `hooks` key is modified. All other keys pass through via structuredClone.
 * - Exact duplicates (same event + matcher + command) are skipped with a reason.
 * - Same event+matcher with a different command is NOT a conflict — it is appended.
 * - Input is never mutated (structuredClone guarantees this).
 */
export function mergeHooks(input: MergeInput): MergeResult {
  // 1. Deep clone — never mutate input (critical invariant)
  const settings = structuredClone(input.existing) as ClaudeSettings;
  const added: MergeResult['added'] = [];
  const skipped: MergeResult['skipped'] = [];

  // 2. Ensure hooks object exists
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // 3. Process each new hook entry
  for (const { event, matcher, hook } of input.newHooks) {
    // Ensure event array exists
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    const existingGroups = settings.hooks[event];

    // 4. Check for exact duplicate: same event + matcher + command
    if (isDuplicate(existingGroups, matcher, hook.command)) {
      skipped.push({
        event,
        matcher,
        command: hook.command,
        reason: 'Already exists (same event + matcher + command)',
      });
      continue;
    }

    // 5. Append as new hook group (one hook per group — matches real-world Claude Code pattern)
    const newGroup: HookGroup = {
      ...(matcher !== undefined ? { matcher } : {}),
      hooks: [{ type: hook.type, command: hook.command }],
    };

    existingGroups.push(newGroup);

    added.push({ event, matcher, command: hook.command });
  }

  return { settings, added, skipped };
}
