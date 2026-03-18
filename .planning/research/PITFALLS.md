# Pitfalls Research

**Domain:** CLI hook manager for Claude Code
**Researched:** 2026-03-18
**Confidence:** HIGH (verified against official Claude Code hooks reference + real-world bug reports)

## Critical Pitfalls

Mistakes that cause rewrites, broken user installs, or silent security failures.

### Pitfall 1: Destructive settings.json Management

**What goes wrong:** The CLI overwrites `~/.claude/settings.json` instead of merging, destroying user's existing hooks, permissions, MCP configs, and other settings. One bad `init` command nukes their entire Claude Code configuration.

**Why it happens:** JSON doesn't have a native "merge" semantic. Naive implementations read-write the whole file. The `hooks` key is deeply nested (event -> matcher groups -> hook arrays), making deep merge non-trivial. Users may have hooks in `~/.claude/settings.json` (user), `.claude/settings.json` (project), and `.claude/settings.local.json` (local) -- three separate files.

**Consequences:** Users lose their custom hooks, permission rules, and MCP configs. Trust is destroyed immediately. GitHub issues pile up on day one. Competing tools (claudekit) have already made this mistake.

**Warning signs:** Any code path that calls `JSON.stringify()` + `writeFileSync()` on settings.json without reading first. Tests that start with empty settings files.

**Prevention:**
- Always read-parse-merge-write. Never overwrite.
- Deep merge strategy: append to hook arrays, don't replace. Deduplicate by hook command path.
- Create a backup (`.claude/settings.json.bak`) before any write.
- Dry-run mode (`--dry-run`) that shows the diff before applying.
- Integration tests with pre-existing settings containing hooks, permissions, MCP configs, and custom keys.

**Detection:** Test with a settings.json that has 10+ existing hooks, MCP servers, and permission rules. Run `init`. Verify nothing was lost.

**Phase:** Must be solved in Phase 1 (core CLI). This is the foundation -- every command that touches settings depends on it.

---

### Pitfall 2: Exit Code Semantics Mismatch

**What goes wrong:** Bundled hooks use `exit 1` to block actions, but Claude Code only blocks on `exit 2`. Exit 1 is logged as a non-blocking error and execution continues. Users think they're protected but hooks are silently ineffective.

**Why it happens:** Every other tool ecosystem uses exit 1 for failure. Claude Code's exit code semantics are non-standard: exit 0 = success (parse JSON output), exit 2 = blocking error (stderr becomes feedback), anything else = non-blocking error (logged, execution continues). This is the #1 documented hook mistake in the wild.

**Consequences:** Security hooks that are supposed to block dangerous commands let them through. Users have a false sense of safety. This is a liability issue for a tool marketed as providing "production-grade" hooks.

**Warning signs:** Any bundled hook script containing `exit 1` in a blocking path. Tests that check "hook ran" but not "action was actually blocked."

**Prevention:**
- Lint all bundled hooks for `exit 1` in blocking paths -- flag as a bug.
- Hook scaffolding templates must use `exit 2` for blocking, with a comment explaining why.
- `claude-hooks test` must verify that blocking hooks actually produce exit code 2.
- Documentation must prominently explain the exit code semantics with a comparison table.
- Consider a wrapper function in hook templates: `block() { echo "$1" >&2; exit 2; }`.

**Detection:** `grep -rn 'exit 1' hooks/` -- every hit needs manual review. Automated test: run a PreToolUse hook, verify the tool call was actually prevented.

**Phase:** Phase 1 (bundled hooks) and Phase 2 (testing framework). Every hook and every test must get this right from day one.

---

### Pitfall 3: Shell Script Portability Failures

**What goes wrong:** Hooks work on the author's machine but fail silently on users' systems due to shell/OS differences. macOS ships with BSD tools (no GNU coreutils), `readlink -f` doesn't exist, `sed -i` requires a backup extension, `jq` isn't pre-installed, bash version differs (macOS ships bash 3.2 from 2007 due to GPL3).

**Why it happens:** Hook authors develop on one platform and don't test cross-platform. Shell scripts are the hook format Claude Code uses natively, so there's no abstraction layer. macOS defaulting to zsh but scripts using `#!/bin/bash` creates confusion.

**Consequences:** Hooks fail silently (non-zero exit codes are logged but don't block by default). Users on different platforms get inconsistent behavior. Support burden explodes.

**Warning signs:** Scripts using `readlink -f`, GNU sed flags, bash 4+ features (associative arrays, `${var,,}`), or assuming `jq` is installed.

**Prevention:**
- All bundled hooks must use `#!/usr/bin/env bash` shebang.
- Stick to POSIX + bash 3.2 compatible syntax (no associative arrays, no `${var,,}`, no `mapfile`).
- Use built-in bash JSON parsing for simple cases or check for `jq` with fallback: `if ! command -v jq &>/dev/null; then ...`.
- CI matrix testing on macOS (bash 3.2 + zsh) and Ubuntu (bash 5.x).
- Provide a `claude-hooks doctor` command that checks system dependencies.

**Detection:** Run bundled hooks in a macOS container with only default tools. Run in Alpine Linux (no bash by default). Any failure = portability bug.

**Phase:** Phase 1 (bundled hooks must be portable from launch). Phase 3 (doctor command for diagnostics).

---

### Pitfall 4: Hook Performance Causing UX Degradation

**What goes wrong:** Hooks that take more than 500ms create noticeable lag on every tool use. A PreToolUse hook running on every `Bash`, `Edit`, and `Write` call means users feel the delay dozens of times per session. Users disable all hooks rather than debugging which one is slow.

**Why it happens:** Hooks fork a shell process, parse JSON from stdin, do their work, and produce output. Each hook invocation has ~50-100ms of process startup overhead. Multiple hooks compound. Hooks that shell out to additional tools (`ruff`, `eslint`, `git`) add more latency.

**Consequences:** Users blame `claude-hooks` for making Claude Code feel sluggish. They uninstall. Reviews on npm mention "slows down Claude Code." Claudekit already documents this as a known issue with a 5-second threshold.

**Warning signs:** Any hook that calls external tools without caching. Hooks without matchers (run on every tool use). Hooks that process entire files when only a diff is needed.

**Prevention:**
- All bundled hooks must complete in under 200ms. Benchmark in CI.
- Use matchers aggressively -- a lint hook should only match `Write|Edit`, not all tools.
- Document performance expectations in hook creation guides.
- `claude-hooks test --benchmark` to measure hook execution time.
- Consider a hook profiler: `claude-hooks profile` that times each installed hook.

**Detection:** `time echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | ./hook.sh` for each bundled hook. Anything over 200ms needs optimization.

**Phase:** Phase 1 (bundled hooks must be fast). Phase 2 (testing framework should include benchmarks). Phase 3 (profiler/doctor).

---

### Pitfall 5: Stdout Pollution Breaking JSON Communication

**What goes wrong:** Hook scripts produce unexpected stdout (from shell profiles, sourced files, debug echo statements, or tool output) that corrupts the JSON response Claude Code expects. Claude Code tries to parse stdout as JSON on exit 0 and silently fails.

**Why it happens:** Shell scripts often source `.bashrc`/`.bash_profile` which print welcome messages or diagnostic info. Scripts use `echo` for debugging and forget to remove it. External tools write to stdout instead of stderr. The JSON output contract is strict but the shell environment is messy.

**Consequences:** Hooks appear to run but their JSON output (decisions, system messages, updated inputs) is never processed. A PreToolUse hook that should block an action produces valid JSON but it's prepended with garbage, so Claude Code ignores it and proceeds.

**Warning signs:** Hooks that source external files. Hooks that call tools without redirecting their stdout. Hooks that use `echo` for anything other than the final JSON response.

**Prevention:**
- Hook templates must redirect all non-output to stderr: `exec 3>&1 1>&2` pattern, then `echo "$json" >&3` for final output.
- Or: accumulate output in a variable, `echo` it as the last operation.
- `claude-hooks test` must validate that hook stdout is either empty or valid JSON.
- Lint rule: flag any `echo` statement that isn't the final JSON output.
- Documentation: "stdout is sacred -- only JSON goes there."

**Detection:** Run hooks with `bash --login` (which sources profiles) and verify stdout is clean JSON.

**Phase:** Phase 1 (hook templates), Phase 2 (test framework validation).

---

### Pitfall 6: Ignoring the Multi-File Configuration Hierarchy

**What goes wrong:** The CLI only manages `~/.claude/settings.json` but Claude Code loads hooks from three locations with a merge hierarchy: user settings (`~/.claude/settings.json`), project settings (`.claude/settings.json`), project local settings (`.claude/settings.local.json`), and managed policy settings. Hooks installed at the wrong level either don't apply where expected or can't be overridden.

**Why it happens:** It's tempting to pick one file and call it done. But the hierarchy matters: project hooks should go in `.claude/settings.json` (shared with team via git), personal hooks in `~/.claude/settings.json` (global) or `.claude/settings.local.json` (personal per-project). Managed policy hooks can't be disabled by users at all.

**Consequences:** Teams can't share hooks via their repo. Personal hooks leak into project settings and get committed. Users can't have different hook sets per project. The tool feels half-baked compared to just editing JSON manually.

**Warning signs:** CLI commands that don't accept a `--scope` or `--project` flag. Tests that only exercise one settings file.

**Prevention:**
- `claude-hooks add` must support `--global` (user settings), `--project` (project settings), and `--local` (project local settings) flags.
- Default to project scope (`.claude/settings.json`) for `add` -- this is the most common use case and team-shareable.
- `claude-hooks list` must show which scope each hook is installed in.
- `claude-hooks init` should ask or infer the appropriate scope.

**Detection:** Install a hook at project scope, verify it doesn't appear in global settings. Install at global scope, verify it doesn't appear in project settings.

**Phase:** Phase 1 (core CLI must handle scopes from the start). Retrofitting scope support is a breaking change.

## Moderate Pitfalls

### Pitfall 7: npx Cold Start and Caching Issues

**What goes wrong:** `npx claude-hooks init` downloads the package every time if not cached, taking 5-10 seconds. Users on slow connections or CI environments experience friction. npx also has version caching bugs where stale versions persist.

**Prevention:**
- Keep the package small (< 1MB unpacked). Minimal dependencies.
- Document `npm install -g claude-hooks` as the recommended path for frequent users.
- Avoid heavy dependencies (no `inquirer` for prompts when `readline` works, no `chalk` when `\033[` escapes work).
- Test the npx flow in CI to catch size regressions.

**Phase:** Phase 1 (package design). Package size discipline from the start.

---

### Pitfall 8: Hook Deduplication and Conflict Detection

**What goes wrong:** User runs `claude-hooks add security-pack` twice and gets duplicate hooks in settings.json. Or two hooks both match `PreToolUse:Bash` and produce conflicting decisions (one allows, one blocks).

**Prevention:**
- Dedup on add: check if a hook with the same command path already exists in the target scope.
- Warn on conflict: if two installed hooks match the same event+matcher pattern, warn the user.
- `claude-hooks list` should flag duplicates and potential conflicts.
- Hook packs should document which events they claim.

**Phase:** Phase 1 (add command) and Phase 2 (list enhancements).

---

### Pitfall 9: Matcher Regex Gotchas

**What goes wrong:** Users write matchers like `Bash` thinking it's a string match, but it's a regex. `Bash` also matches tool names containing "Bash" as a substring. Or they write `Edit|Write` not realizing regex alternation without grouping can produce unexpected behavior with anchoring.

**Prevention:**
- Hook scaffolding should use exact tool names as matchers (they work because Claude Code's tool names are exact).
- Document: "Matchers are regex patterns. `Bash` matches `Bash` exactly because there's no tool named `BashExtended`. But `mcp__` requires `mcp__.*` for prefix matching."
- `claude-hooks test` should validate matchers against known tool names.

**Phase:** Phase 2 (testing framework) and documentation.

---

### Pitfall 10: Bundled Hook Scripts Not Executable

**What goes wrong:** npm publish strips file permissions. Hook scripts installed via `claude-hooks add` aren't executable (`chmod +x`). Claude Code fails to run them.

**Prevention:**
- `claude-hooks add` must `chmod +x` every installed hook script.
- Include a postinstall script or handle permissions in the add command.
- Test the full flow: `npm pack` -> `npx` -> `add` -> verify permissions.
- Consider embedding hooks as heredocs that get written with correct permissions rather than copying files.

**Phase:** Phase 1 (add command). Must work from day one.

---

### Pitfall 11: Breaking Changes in Claude Code's Hook API

**What goes wrong:** Claude Code is actively evolving. The hooks API has already had breaking changes: the PreToolUse decision format changed from `decision: "approve"|"block"` to `hookSpecificOutput.permissionDecision: "allow"|"deny"|"ask"`. New events are being added regularly (SubagentStart, WorktreeCreate, Elicitation, etc. are all recent). Hooks built for today's API may break tomorrow.

**Prevention:**
- Pin to documented, stable fields (session_id, tool_name, tool_input are unlikely to change).
- Version the hook format: `claude-hooks` should track which Claude Code version each hook targets.
- Defensive parsing: hooks should gracefully handle missing fields rather than crashing.
- Watch the Claude Code changelog and have a CI job that runs hooks against the latest Claude Code hook format.

**Phase:** Ongoing. Build defensively from Phase 1. Add version compatibility checking in Phase 3.

## Minor Pitfalls

### Pitfall 12: Overly Complex Hook Templates

**What goes wrong:** Hook scaffolding generates 100+ line scripts with elaborate error handling, logging, and configuration. Users can't understand or customize them. Simpler hooks would be more maintainable.

**Prevention:** Keep bundled hooks under 50 lines. Favor clarity over cleverness. Comment the "why" not the "what." Provide a `--minimal` scaffolding option.

**Phase:** Phase 1 (hook design).

---

### Pitfall 13: Missing Uninstall/Remove Cleanup

**What goes wrong:** `claude-hooks remove` deletes the hook entry from settings.json but leaves orphaned script files in `~/.claude/hooks/` or wherever they were installed. Over time, the hooks directory accumulates dead scripts.

**Prevention:** Track installed hook file paths. `remove` should delete both the settings.json entry and the script file. `claude-hooks list` should flag orphaned scripts.

**Phase:** Phase 1 (remove command).

---

### Pitfall 14: No Validation of Hook Script Content

**What goes wrong:** Users create hooks via `claude-hooks create` that read stdin incorrectly, produce invalid JSON, or have syntax errors. They install them and wonder why nothing works. No feedback loop.

**Prevention:** `claude-hooks test` must feed realistic mock JSON to the hook, capture stdout/stderr, check exit codes, and validate JSON output. Provide this as part of the `create` workflow: "Your hook was created. Run `claude-hooks test my-hook` to verify it works."

**Phase:** Phase 2 (testing framework). Critical for user-created hooks.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Core CLI (init/add/remove) | Destructive settings.json writes (#1), scope confusion (#6), file permissions (#10) | Deep merge with backup, scope flags, chmod +x |
| Bundled Hooks | Exit code 2 misuse (#2), shell portability (#3), stdout pollution (#5) | Lint rules, CI matrix testing, stderr-first pattern |
| Testing Framework | False confidence from shallow tests (#2, #14) | Test actual blocking behavior, validate JSON output |
| Hook Packs | Deduplication failures (#8), matcher conflicts (#9) | Dedup on install, conflict warnings |
| npx Distribution | Package size (#7), cold start (#7) | Minimal deps, < 1MB unpacked |
| Long-term Maintenance | Claude Code API changes (#11) | Defensive parsing, version tracking |

## Sources

- [Claude Code Hooks Reference (official)](https://code.claude.com/docs/en/hooks) - HIGH confidence
- [5 Claude Code Hook Mistakes That Silently Break Your Safety Net](https://dev.to/yurukusa/5-claude-code-hook-mistakes-that-silently-break-your-safety-net-58l3) - MEDIUM confidence
- [Claude Code Hooks Bug: Hooks don't always fire](https://github.com/anthropics/claude-code/issues/20265) - HIGH confidence
- [Claude Code Hooks Bug: SessionStart fails on Windows](https://github.com/anthropics/claude-code/issues/21468) - HIGH confidence
- [Claude Code Hooks System Issues](https://github.com/anthropics/claude-code/issues/2814) - HIGH confidence
- [Husky Troubleshooting](https://deepwiki.com/typicode/husky/3.4-troubleshooting) - MEDIUM confidence (analogous domain)
- [Claudekit Hook Profiling](https://github.com/carlrannaberg/claudekit/blob/main/docs/guides/hook-profiling.md) - MEDIUM confidence
- [Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) - HIGH confidence
- [Claude Code Settings](https://code.claude.com/docs/en/settings) - HIGH confidence
