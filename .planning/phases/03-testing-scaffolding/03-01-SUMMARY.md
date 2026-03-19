---
phase: 03-testing-scaffolding
plan: 01
subsystem: test-runner
tags: [test-runner, fixtures, cli, tdd]
dependency_graph:
  requires: [src/registry/index.ts, src/config/locator.ts, registry/hooks/]
  provides: [src/commands/test.ts, registry/hooks/fixtures/]
  affects: [src/cli.ts]
tech_stack:
  added: []
  patterns: [spawnSync-with-stdin, fixture-discovery, tdd-red-green]
key_files:
  created:
    - src/commands/test.ts
    - tests/commands/test.test.ts
    - registry/hooks/fixtures/sensitive-path-guard/block-env.json
    - registry/hooks/fixtures/sensitive-path-guard/allow-src.json
    - registry/hooks/fixtures/exit-code-enforcer/block-rm-rf.json
    - registry/hooks/fixtures/exit-code-enforcer/allow-npm-test.json
    - registry/hooks/fixtures/post-edit-lint/allow-ts-file.json
    - registry/hooks/fixtures/post-edit-lint/allow-unknown-ext.json
    - registry/hooks/fixtures/ts-check/allow-ts-file.json
    - registry/hooks/fixtures/ts-check/allow-non-ts.json
    - registry/hooks/fixtures/web-budget-gate/allow-within-budget.json
    - registry/hooks/fixtures/web-budget-gate/block-over-budget.json
    - registry/hooks/fixtures/cost-tracker/allow-bash-tool.json
    - registry/hooks/fixtures/cost-tracker/allow-no-session.json
    - registry/hooks/fixtures/error-advisor/allow-enoent.json
    - registry/hooks/fixtures/error-advisor/allow-no-error.json
  modified:
    - src/cli.ts
decisions:
  - "web-budget-gate block fixture uses CLAUDE_HOOKS_WEB_LIMIT=0 so first call is immediately blocked (no state pre-seeding needed)"
  - "bash exits 127 for missing scripts, not -1 — test adjusted to check actualExitCode != 0"
  - "discoverFixtures and runFixture exported for unit testing; testCommand is the CLI-facing entry"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-18"
  tasks_completed: 2
  files_created: 17
requirements: [CLI-06, CLI-07, TST-01, TST-02, TST-03, TST-04]
---

# Phase 3 Plan 01: Test Runner Engine Summary

Test runner engine with `discoverFixtures`/`runFixture` internals plus 14 fixture JSON files covering all 7 bundled hooks, wired into `claude-hooks test <hook>` and `--all` with colored PASS/FAIL output.

## What Was Built

### src/commands/test.ts
- `discoverFixtures(dir)` — reads `*.json` files from a fixture directory, returns empty array if dir missing
- `runFixture(scriptPath, fixture, opts)` — spawns `bash <script>` with JSON stdin, compares exit code, returns `TestResult`
- `testCommand(opts)` — CLI entry: resolves hook metadata via `getHook()`, finds bundled fixtures at `registry/hooks/fixtures/<name>/`, also checks user fixture dir at `getHooksDir(scope)/fixtures/<name>/` (TST-04)
- Colored output: `pc.green('  PASS')` / `pc.red('  FAIL')`, summary line at end
- Sets `process.exitCode = 1` on any failure

### Fixtures (14 total, 2 per hook)
All 7 hooks covered with allow + block cases where applicable. `web-budget-gate` block case uses `CLAUDE_HOOKS_WEB_LIMIT=0` env to guarantee block on first call without requiring state pre-seeding.

### CLI registration
`claude-hooks test [hook]` with `--all` and `--scope` options added to `src/cli.ts`.

## Verification Results

```
claude-hooks test --all:
  14 passed, 0 failed  (all 7 hooks, both fixtures each)

vitest run tests/commands/test.test.ts:
  13 passed

vitest run (full suite):
  172 passed across 14 test files

npm run typecheck: clean
npm run build: success
node dist/cli.js test --help: shows correct usage
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] bash exits 127, not -1 for missing scripts**
- **Found during:** RED phase — initial test expected -1
- **Issue:** `spawnSync` returns `status: null` when spawned process sends a signal, but bash itself runs fine and returns 127 for "command not found"; `result.status ?? -1` only hits -1 on signal kill, not on bash 127
- **Fix:** Updated test expectation from `toBe(-1)` to `not.toBe(0)` — correct for all non-zero failure cases
- **Files modified:** tests/commands/test.test.ts
- **Commit:** 78ee98b

## Self-Check: PASSED

- src/commands/test.ts exists: FOUND
- tests/commands/test.test.ts exists: FOUND
- registry/hooks/fixtures/ (14 files): FOUND (committed in 769e265)
- Commit 78ee98b (test runner engine): FOUND
- All 172 tests pass: VERIFIED
