---
phase: 03-testing-scaffolding
plan: "02"
subsystem: create-command
tags: [cli, scaffold, templates, bash, fixtures]
dependency_graph:
  requires: []
  provides: [src/commands/create.ts, src/templates/index.ts]
  affects: [src/cli.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, template-registry, fixture-scaffolding]
key_files:
  created:
    - src/templates/index.ts
    - src/commands/create.ts
    - tests/commands/create.test.ts
  modified:
    - src/cli.ts
decisions:
  - "Template comments use 'pure bash, no external JSON parser required' to avoid false-positive test failures on 'no jq required' substring"
  - "Internal _createAt() function accepts explicit hooksDir for testability without touching real filesystem"
  - "PreToolUse-only gets block-example.json fixture; other event types are informational-only and get allow-example.json only"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-19T00:06:30Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 03 Plan 02: Create Command with Event-Type Templates Summary

Create command scaffolds custom hooks from event-type templates with proper bash boilerplate and test fixture skeletons — `claude-hooks create my-guard --event PreToolUse --matcher Bash` writes an executable .sh file and JSON fixtures in one step.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Template registry with event-type templates | 769e265 | src/templates/index.ts, tests/commands/create.test.ts |
| 2 | Create command with hook script + fixture scaffolding | 769e265 | src/commands/create.ts, src/cli.ts |

## Decisions Made

1. **Template comment text**: Comments in templates say "pure bash, no external JSON parser required" instead of "no jq required" to prevent the test assertion `not.toContain('jq')` from false-positiving on the comment text itself.

2. **Testable internals via `_createAt`**: The create command exports `_createAt(opts: { name, event, matcher?, hooksDir })` accepting an explicit hooksDir so tests can operate in tmp directories without any scope resolution or real filesystem side effects.

3. **Block fixture gating**: Only PreToolUse generates a `block-example.json` fixture (expectedExitCode: 2). PostToolUse, SessionStart, and Stop are informational-only and get only `allow-example.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Template comment contained literal 'jq' substring causing test failure**
- **Found during:** Task 1, GREEN phase
- **Issue:** Comments like `# no jq required` caused `expect(script).not.toContain('jq')` to fail
- **Fix:** Changed all template comments to use "pure bash, no external JSON parser required"
- **Files modified:** src/templates/index.ts
- **Commit:** 769e265

## Verification

- 25 tests passing in tests/commands/create.test.ts
- 172 total tests passing (full suite)
- TypeScript typecheck clean
- Build successful (tsup)
- Smoke test: `node dist/cli.js create --help` shows correct usage with examples

## Self-Check: PASSED

- src/templates/index.ts: FOUND
- src/commands/create.ts: FOUND
- tests/commands/create.test.ts: FOUND
- src/cli.ts (modified): FOUND
- Commit 769e265: FOUND
