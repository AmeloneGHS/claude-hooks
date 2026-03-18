# Architecture Research

**Domain:** CLI hook manager with bundled registry for Claude Code
**Researched:** 2026-03-18
**Confidence:** HIGH (based on official Claude Code docs, oclif architecture, and real-world hook configs)

## Recommended Architecture

claude-hooks should follow a layered architecture with clear component boundaries. The design is inspired by oclif's plugin system (discovery, loading, registration) but simplified since we bundle hooks rather than dynamically install plugins.

```
User CLI Input
      |
      v
  [CLI Router]  ---- parses commands (init, add, remove, list, test, create)
      |
      v
  [Command Handlers]  ---- one handler per command
      |
      +---> [Registry]  ---- reads bundled hook definitions from registry/
      |
      +---> [Config Manager]  ---- reads/writes ~/.claude/settings.json
      |         |
      |         +---> [JSON Merger]  ---- non-destructive merge logic
      |         +---> [Settings Locator]  ---- finds correct settings file
      |
      +---> [Hook Installer]  ---- copies scripts, sets permissions
      |
      +---> [Test Runner]  ---- feeds mock JSON, validates output
      |
      +---> [Scaffolder]  ---- generates hook templates from create command
```

### Component Boundaries

| Component | Responsibility | Communicates With | Key Files |
|-----------|---------------|-------------------|-----------|
| **CLI Router** | Parse argv, dispatch to command handlers | Command Handlers | `src/cli.ts` |
| **Command Handlers** | Execute init/add/remove/list/test/create logic | Registry, Config Manager, Hook Installer, Test Runner, Scaffolder | `src/commands/*.ts` |
| **Registry** | Index of all bundled hooks with metadata | Command Handlers | `src/registry/index.ts`, `src/registry/hooks/*.ts` |
| **Config Manager** | Read/write/merge settings.json safely | Command Handlers, JSON Merger, Settings Locator | `src/config/manager.ts` |
| **JSON Merger** | Non-destructive deep merge of hook configs into existing settings | Config Manager | `src/config/merger.ts` |
| **Settings Locator** | Find and resolve the correct settings.json (user/project/local) | Config Manager | `src/config/locator.ts` |
| **Hook Installer** | Copy hook scripts to target directory, set chmod +x | Command Handlers | `src/installer.ts` |
| **Test Runner** | Execute hooks with mock JSON input, validate exit codes and output | Command Handlers | `src/testing/runner.ts` |
| **Scaffolder** | Generate hook template files from `create` command | Command Handlers | `src/scaffolder.ts` |

### Data Flow

#### `npx claude-hooks add security-pack`

```
1. CLI Router parses "add security-pack"
2. AddCommand handler invoked
3. Registry looks up "security-pack" -> resolves to [sensitive-path-guard, prompt-guard, ...]
4. For each hook in pack:
   a. Settings Locator finds ~/.claude/settings.json (or --project flag)
   b. Config Manager reads current settings
   c. JSON Merger computes merged hooks config (additive, never removes existing hooks)
   d. Config Manager writes merged settings.json
   e. Hook Installer copies script files to ~/.claude/hooks/claude-hooks/ (namespaced dir)
   f. Hook Installer runs chmod +x on scripts
5. Output: summary of what was installed
```

#### `npx claude-hooks test sensitive-path-guard`

```
1. CLI Router parses "test sensitive-path-guard"
2. TestCommand handler invoked
3. Registry looks up hook -> gets test fixtures (mock JSON inputs + expected outputs)
4. Test Runner for each fixture:
   a. Spawns hook script as child process
   b. Pipes mock JSON to stdin
   c. Captures stdout, stderr, exit code
   d. Compares against expected: exit code, stdout content, stderr patterns
5. Output: pass/fail report
```

#### `npx claude-hooks init`

```
1. CLI Router parses "init"
2. InitCommand handler invoked
3. Settings Locator checks for existing settings.json
4. Interactive prompt: which hooks/packs to install? (or --yes for defaults)
5. For each selected hook: same flow as "add"
6. Output: summary + next steps
```

## Component Deep Dives

### Registry Structure

The registry is the core data model. Each hook definition contains everything needed to install, test, and document it.

```typescript
// src/registry/types.ts
interface HookDefinition {
  id: string;                    // "sensitive-path-guard"
  name: string;                  // "Sensitive Path Guard"
  description: string;           // One-liner
  event: HookEvent;              // "PreToolUse" | "PostToolUse" | etc.
  matcher: string;               // "Edit|Write" (regex for tool matching)
  type: "command" | "http";      // Hook type (v1: command only)
  scriptFile: string;            // Relative path in registry: "scripts/sensitive-path-guard.sh"
  tags: string[];                // ["security", "file-protection"]
  packs: string[];               // ["security-pack"]

  // For testing
  testFixtures: TestFixture[];

  // For documentation
  docs: {
    whatItDoes: string;
    exampleOutput: string;
    configuration?: Record<string, string>;  // Env vars the hook reads
  };
}

interface TestFixture {
  name: string;                  // "blocks .env file edit"
  input: Record<string, any>;   // Mock tool_input JSON
  expectedExitCode: number;      // 0, 2, etc.
  expectedStderr?: RegExp;       // Pattern to match in stderr
  expectedStdout?: string;       // Exact or pattern match
}

interface HookPack {
  id: string;                    // "security-pack"
  name: string;                  // "Security Pack"
  description: string;
  hooks: string[];               // Hook IDs
}

type HookEvent =
  | "PreToolUse" | "PostToolUse" | "PostToolUseFailure"
  | "SessionStart" | "Stop" | "Notification"
  | "SubagentStart" | "SubagentStop"
  | "UserPromptSubmit" | "ConfigChange"
  | "PreCompact" | "PostCompact"
  | "PermissionRequest" | "SessionEnd"
  | "TaskCompleted" | "TeammateIdle"
  | "WorktreeCreate" | "WorktreeRemove"
  | "InstructionsLoaded" | "Elicitation" | "ElicitationResult";
```

### Settings.json Schema (Claude Code Native)

This is the target format claude-hooks must produce. Based on official docs:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/script.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/other-script.sh"
          }
        ]
      }
    ]
  }
}
```

Key observations from real-world configs:
- Each event key maps to an **array of hook groups**
- Each hook group has an optional `matcher` (regex string) and a `hooks` array
- Each hook in the array has `type` and `command` (for command type)
- Multiple hooks can share the same matcher by being in the same group
- Multiple hook groups can exist under the same event (different matchers)
- Commands use **absolute paths** to scripts

### JSON Merger (Critical Component)

The merger is the most important component because it must be **non-destructive**. Users have existing hooks that must not be touched.

```typescript
// src/config/merger.ts

// Strategy: Array-append, never replace
// For hooks.PreToolUse (array), we APPEND new hook groups
// We never modify existing hook groups
// We detect duplicates by matching (event + matcher + command) tuples

interface MergeResult {
  merged: Settings;
  added: HookEntry[];       // What was added
  skipped: HookEntry[];     // Already existed (duplicate detection)
  conflicts: HookEntry[];   // Same matcher but different command (warn user)
}
```

Merge rules:
1. **Read** existing settings.json (preserve all non-hook keys untouched)
2. **For each hook to install**: check if (event, matcher, command-basename) already exists
3. **If exists**: skip, report as duplicate
4. **If new**: append to the event's array
5. **Write** back with original formatting preserved (use `JSON.stringify` with same indent)
6. **Never** remove or reorder existing entries

### Settings Locator

Claude Code has four settings locations with a specific precedence:

| File | Scope | Flag |
|------|-------|------|
| `~/.claude/settings.json` | User (global) | `--global` (default) |
| `.claude/settings.json` | Project (committed) | `--project` |
| `.claude/settings.local.json` | Project (gitignored) | `--local` |
| Managed policy | Organization | Not writable by CLI |

Default behavior: install to `~/.claude/settings.json` (user scope).
With `--project`: install to `.claude/settings.json` in project root.
With `--local`: install to `.claude/settings.local.json`.

### Hook Script Installation

Scripts are installed to a namespaced directory to avoid conflicts:

```
~/.claude/hooks/claude-hooks/     # Global hooks
  sensitive-path-guard.sh
  prompt-guard.sh
  web-budget-gate.sh
  ...

.claude/hooks/claude-hooks/       # Project hooks (if --project)
  custom-lint.sh
  ...
```

The settings.json `command` field uses absolute paths for global hooks and `$CLAUDE_PROJECT_DIR`-relative paths for project hooks. This matches Claude Code's native pattern.

### Test Runner

The test runner simulates Claude Code's hook execution:

```
1. Spawn hook script as child process
2. Pipe mock JSON to stdin (same format Claude Code sends)
3. Set environment variables (CLAUDE_PROJECT_DIR, etc.)
4. Wait for exit (with configurable timeout, default 10s)
5. Capture exit code, stdout, stderr
6. Compare against fixture expectations
7. Report pass/fail with diff on failure
```

Test fixtures are bundled with each hook definition in the registry. Users can also write custom fixtures for their own hooks via `claude-hooks test --fixture path/to/fixture.json`.

## Patterns to Follow

### Pattern 1: Commander.js for CLI Framework

Use Commander.js (not oclif) because:
- 35M+ weekly downloads, battle-tested
- No scaffolding overhead -- claude-hooks is a focused tool, not a framework
- Native TypeScript support
- No plugin system needed (we ARE the plugin system)
- Lighter dependency footprint

```typescript
// src/cli.ts
import { Command } from 'commander';

const program = new Command()
  .name('claude-hooks')
  .description('Hook manager for Claude Code')
  .version(pkg.version);

program.command('init')
  .description('Initialize hooks in your settings')
  .option('--yes', 'Accept defaults')
  .option('--project', 'Install to project settings')
  .action(initCommand);

program.command('add <hook-or-pack>')
  .description('Add a hook or pack')
  .option('--global', 'Install globally (default)')
  .option('--project', 'Install to project settings')
  .action(addCommand);
```

### Pattern 2: Static Registry with Dynamic Lookup

```typescript
// src/registry/index.ts
import { sensitivePathGuard } from './hooks/sensitive-path-guard';
import { promptGuard } from './hooks/prompt-guard';
// ... all hooks imported statically

const HOOKS: Map<string, HookDefinition> = new Map([
  ['sensitive-path-guard', sensitivePathGuard],
  ['prompt-guard', promptGuard],
  // ...
]);

const PACKS: Map<string, HookPack> = new Map([
  ['security-pack', { id: 'security-pack', hooks: ['sensitive-path-guard', 'prompt-guard', ...] }],
  // ...
]);

export function getHook(id: string): HookDefinition | undefined { ... }
export function getPack(id: string): HookPack | undefined { ... }
export function listHooks(filter?: { tag?: string; event?: string }): HookDefinition[] { ... }
export function searchHooks(query: string): HookDefinition[] { ... }
```

### Pattern 3: Backup Before Write

```typescript
// Always create a backup before modifying settings.json
async function safeWrite(filePath: string, content: string): Promise<void> {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  await fs.copyFile(filePath, backupPath);
  await fs.writeFile(filePath, content, 'utf-8');
  // Clean up old backups (keep last 3)
}
```

### Pattern 4: Dry Run Support

Every write operation should support `--dry-run` to show what would change without modifying files.

```typescript
// All commands that modify settings accept --dry-run
program.command('add <hook>')
  .option('--dry-run', 'Show what would be changed')
  .action(async (hook, opts) => {
    const result = await computeMerge(hook);
    if (opts.dryRun) {
      console.log('Would add:', result.added);
      console.log('Would skip:', result.skipped);
      return;
    }
    await applyMerge(result);
  });
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Replacing settings.json
**What:** Overwriting the entire settings.json with only hook content
**Why bad:** Destroys user's permissions, env vars, and other settings
**Instead:** Read-modify-write with surgical JSON merge on the `hooks` key only

### Anti-Pattern 2: Dynamic Script Generation
**What:** Generating hook scripts at install time from templates
**Why bad:** Scripts become unmaintainable, can't be updated, version drift
**Instead:** Ship pre-written scripts in the npm package, copy them verbatim

### Anti-Pattern 3: Global State in Hook Scripts
**What:** Hooks that depend on shared state files or databases
**Why bad:** Race conditions when multiple hooks run in parallel (Claude Code runs all matching hooks simultaneously)
**Instead:** Each hook should be self-contained. Use environment variables for configuration.

### Anti-Pattern 4: Relative Paths in settings.json
**What:** Using `./hooks/my-hook.sh` in the command field
**Why bad:** Breaks when Claude Code's cwd changes (it's the project dir, not home dir)
**Instead:** Use absolute paths for global hooks, `$CLAUDE_PROJECT_DIR` prefix for project hooks

### Anti-Pattern 5: Heavy Dependencies in Hook Scripts
**What:** Hook scripts that require npm install or Python venv
**Why bad:** Hooks fire on every tool call. Even 100ms latency is noticeable.
**Instead:** Shell scripts with standard tools (jq, grep, sed). Node.js scripts only when logic demands it.

## Suggested File Structure

```
claude-hooks/
  package.json
  tsconfig.json
  src/
    cli.ts                      # Entry point, Commander setup
    commands/
      init.ts                   # claude-hooks init
      add.ts                    # claude-hooks add <hook|pack>
      remove.ts                 # claude-hooks remove <hook|pack>
      list.ts                   # claude-hooks list [--tags] [--events]
      test.ts                   # claude-hooks test [hook] [--all]
      create.ts                 # claude-hooks create <name>
    config/
      manager.ts                # Read/write settings.json
      merger.ts                 # Non-destructive JSON merge
      locator.ts                # Find correct settings file
      types.ts                  # Settings types
    registry/
      index.ts                  # Hook/pack lookup
      types.ts                  # HookDefinition, HookPack, TestFixture
      hooks/                    # One file per hook definition
        sensitive-path-guard.ts
        prompt-guard.ts
        web-budget-gate.ts
        ...
      packs/                    # Pack definitions
        security.ts
        quality.ts
        cost-control.ts
    installer.ts                # Copy scripts, set permissions
    testing/
      runner.ts                 # Execute hooks with mock input
      fixtures.ts               # Built-in test fixture helpers
    scaffolder.ts               # Generate hook templates
    utils/
      logger.ts                 # Colored output, verbose mode
      fs.ts                     # Safe file operations with backup
  hooks/                        # Actual hook scripts (shipped in npm package)
    sensitive-path-guard.sh
    prompt-guard.sh
    web-budget-gate.sh
    verification-code-alert.sh
    post-edit-lint.sh
    error-advisor.sh
    cost-tracker.sh
    rtk-rewrite.sh
    gsd-context-monitor.js
    ...
  templates/                    # Hook scaffolding templates
    bash-hook.sh.template
    node-hook.js.template
  tests/                        # CLI tests
    commands/
    config/
    registry/
    testing/
```

## Suggested Build Order

Dependencies flow downward. Build from the foundation up.

```
Phase 1: Foundation (no external deps)
  types.ts (registry types, config types)
  locator.ts (find settings files)
  merger.ts (JSON merge logic -- most critical, most testable)

Phase 2: Core Engine
  registry/ (hook definitions, pack definitions)
  manager.ts (config read/write using merger + locator)
  installer.ts (copy scripts, chmod)

Phase 3: CLI Commands
  cli.ts + commands/list.ts (read-only, safest first)
  commands/add.ts (uses registry + manager + installer)
  commands/remove.ts (uses manager, inverse of add)
  commands/init.ts (uses add in a loop with interactive prompts)

Phase 4: Testing Framework
  testing/runner.ts (spawn hooks, compare output)
  commands/test.ts (CLI interface to runner)

Phase 5: Scaffolding & Polish
  scaffolder.ts + commands/create.ts
  templates/
  --dry-run support across all commands
```

**Rationale for this order:**
- Phase 1 is pure logic with zero I/O -- easiest to test, hardest to get wrong later
- Phase 2 builds on Phase 1 types, adds file I/O
- Phase 3 is where users see value -- `list` first because it's read-only and safe
- Phase 4 is a differentiator but not blocking for initial release
- Phase 5 is nice-to-have polish

## Scalability Considerations

| Concern | 10 hooks (v1) | 50 hooks (v2) | 200+ hooks (community) |
|---------|---------------|---------------|------------------------|
| Registry | Static imports, Map lookup | Same, still fast | Consider lazy loading or index file |
| npm package size | ~50KB scripts | ~200KB | Split into @claude-hooks/core + @claude-hooks/community |
| Search/discovery | Linear scan fine | Tag-based filtering | Full-text search, categories |
| Settings.json size | ~20 entries | ~100 entries | Performance concern -- recommend packs over individual hooks |
| Test execution | Sequential fine | Parallel with worker_threads | Parallel, timeout enforcement |

## Sources

- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- Official docs, full event list, JSON schema (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Full event schemas, input/output formats
- [GitButler Claude Code Hooks](https://docs.gitbutler.com/features/ai-integration/claude-code-hooks) -- Real-world settings.json examples
- [oclif Plugin Architecture](https://deepwiki.com/oclif/core/3-configuration-and-plugins) -- Plugin discovery/loading patterns (HIGH confidence)
- [Commander.js vs oclif comparison](https://www.pkgpulse.com/blog/how-to-build-cli-nodejs-commander-yargs-oclif) -- Framework selection rationale (MEDIUM confidence)
- Austin's `~/.claude/settings.json` -- Real-world hook config with 19 hooks (HIGH confidence, primary reference)
