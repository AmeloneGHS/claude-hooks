# Research Summary: claude-hooks

**Domain:** CLI hook manager for Claude Code (npm/npx distribution)
**Researched:** 2026-03-18
**Overall confidence:** HIGH

## Executive Summary

claude-hooks fills a clear gap: Claude Code has a powerful hooks system but no package manager for it. The existing landscape is script collections (disler/claude-code-hooks-mastery, 3.3K stars) and monolithic toolkits (claudekit, 633 stars). Nobody has built the "husky for Claude Code" -- an init/add/remove/test workflow with a bundled registry.

The stack is straightforward and well-established: Commander.js for CLI parsing, tsup for bundling, Vitest for testing, picocolors for output, zod for validation. No exotic choices needed. The project's complexity lives in the domain logic (non-destructive settings.json merging, exit code semantics, shell portability), not in the toolchain.

The single hardest technical problem is the settings.json merger. Claude Code's settings hierarchy (user/project/local) with deeply nested hook arrays requires careful merge logic that never destroys existing configuration. This must be solved before any other command works correctly.

The testing framework (`claude-hooks test`) is the key differentiator. No competing tool lets users verify hooks work before deploying them. This should ship in v1 -- it's what makes this a tool, not another script dump.

## Key Findings

**Stack:** Commander.js 14.x + tsup 8.x + Vitest 3.x + picocolors + zod. 8 total dependencies (4 runtime, 4 dev). ESM-first, Node 18+ baseline.

**Architecture:** Flat module structure with command handlers delegating to core modules (settings, registry, hooks, validator). No classes, no DI, no framework.

**Critical pitfall:** Exit code semantics -- Claude Code uses exit 2 (not exit 1) to block actions. Every bundled hook must get this right or security hooks are silently ineffective.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation & Core Engine** - Types, schemas, settings merger, registry data model
   - Addresses: Non-destructive settings.json management, configuration hierarchy
   - Avoids: Destructive settings writes (Pitfall #1), scope confusion (Pitfall #6)
   - Rationale: Pure logic, zero I/O, most testable, hardest to retrofit

2. **CLI Commands (read-only first)** - list, then add/remove, then init
   - Addresses: Core CLI commands, hook installation, pack support
   - Avoids: File permission issues (Pitfall #10), deduplication failures (Pitfall #8)
   - Rationale: list is read-only (safest first), add/remove build on merger, init orchestrates add

3. **Bundled Hook Registry** - Port 8-10 production hooks with metadata and test fixtures
   - Addresses: Hook registry, packs (security, quality, cost-control)
   - Avoids: Exit code misuse (Pitfall #2), shell portability (Pitfall #3), stdout pollution (Pitfall #5)
   - Rationale: Hooks need the CLI infrastructure from Phase 2 to be installable/testable

4. **Testing Framework** - Hook test runner, mock JSON fixtures, benchmark mode
   - Addresses: `test` command (key differentiator), hook validation
   - Avoids: False confidence from shallow tests (Pitfall #14)
   - Rationale: Differentiator feature, requires hooks from Phase 3 to have something to test

5. **Polish & Distribution** - npx cold start optimization, create scaffolding, documentation
   - Addresses: `create` command, dry-run mode, doctor command, README/docs
   - Avoids: npx cold start issues (Pitfall #7), overly complex templates (Pitfall #12)

**Phase ordering rationale:**
- Phase 1 before everything: the merger is the foundation. Every write command depends on it.
- Phase 2 before Phase 3: CLI commands are the interface for installing hooks. Build the tool before the content.
- Phase 3 before Phase 4: need actual hooks to have something worth testing.
- Phase 4 before Phase 5: testing framework validates everything works before public release.
- Phase 5 is polish that doesn't block functionality.

**Research flags for phases:**
- Phase 1: Needs deeper research on Claude Code settings.json exact merge semantics (how does Claude Code itself merge user/project/local?)
- Phase 3: Needs careful audit of Austin's 19 production hooks for portability and exit code correctness
- Phase 4: Standard patterns, unlikely to need additional research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Well-established tools, verified versions, clear rationale for each choice |
| Features | HIGH | Clear competitive landscape, obvious table stakes vs differentiators |
| Architecture | HIGH | Standard CLI patterns, no novel architecture needed |
| Pitfalls | HIGH | Verified against official Claude Code docs, real GitHub issues, and community bug reports |

## Gaps to Address

- Exact format of Claude Code's hook input JSON for each event type (needed for test fixtures in Phase 4)
- Whether `noExternal: [/.*/]` in tsup correctly bundles the registry's JSON/shell files alongside JS
- How Claude Code handles hook timeouts and whether we need to document/enforce limits
- npm package name availability (`claude-hooks` on npm registry)
