# Roadmap: claude-hooks

## Overview

claude-hooks goes from zero to publishable npm package in 4 phases. The settings merger is the foundation everything builds on, so it ships first. CLI commands and the bundled hook registry deliver the core value. The testing framework and scaffolding provide the key differentiator. Documentation and polish make it ready for public release.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation & Settings Engine** - Types, schemas, non-destructive settings merger, registry data model, init command (completed 2026-03-18)
- [x] **Phase 2: CLI Commands & Hook Registry** - add/remove/list/doctor commands with bundled hooks and packs (completed 2026-03-18)
- [x] **Phase 3: Testing & Scaffolding** - Hook test runner, fixtures, create command with templates (completed 2026-03-19)
- [ ] **Phase 4: Documentation & Polish** - README, info command, inline docs, npx distribution readiness

## Phase Details

### Phase 1: Foundation & Settings Engine
**Goal**: Users can initialize claude-hooks and trust it will never destroy their existing settings.json
**Depends on**: Nothing (first phase)
**Requirements**: CLI-01, SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. User can run `npx claude-hooks init` and get a working hook directory with settings.json seeded
  2. Running init on an existing settings.json preserves all prior configuration (deep merge, not overwrite)
  3. User can pass `--dry-run` on init to preview changes without writing anything
  4. Settings.json is automatically backed up before any write, and `claude-hooks restore` reverts to the last backup
  5. Registry data model exists with metadata (name, description, event type, matcher) for all planned hooks
**Plans**: 3 plans

Plans:
- [x] 01-01: TypeScript project scaffold, Commander.js CLI skeleton, types and schemas
- [x] 01-02: Settings merger engine (deep merge, backup, restore, scope, dry-run, conflict detection)
- [x] 01-03: Registry data model and init command integration

### Phase 2: CLI Commands & Hook Registry
**Goal**: Users can discover, install, and remove production-grade hooks with a single command
**Depends on**: Phase 1
**Requirements**: CLI-02, CLI-03, CLI-04, CLI-05, CLI-09, CLI-10, REG-03, REG-04, REG-05, REG-06, REG-07, REG-08
**Success Criteria** (what must be TRUE):
  1. User can run `claude-hooks add sensitive-path-guard` and the hook script + settings.json entry are installed correctly
  2. User can run `claude-hooks add security-pack` and get all security hooks installed in one command
  3. User can run `claude-hooks remove <hook>` and both the script and settings.json entry are cleanly removed
  4. User can run `claude-hooks list` and see all available hooks with installed status and event types
  5. User can run `claude-hooks doctor` and get a health report (scripts exist, are executable, settings.json valid, no conflicts)
**Plans**: 3 plans

Plans:
- [x] 02-01: add, remove, list commands with settings integration
- [x] 02-02: Bundled hook scripts (security, quality, cost, error packs) with POSIX compat and exit code 2
- [x] 02-03: doctor command, --help on all commands, pack installation logic

### Phase 3: Testing & Scaffolding
**Goal**: Users can verify hooks work before deploying them and create custom hooks from templates
**Depends on**: Phase 2
**Requirements**: CLI-06, CLI-07, CLI-08, TST-01, TST-02, TST-03, TST-04, SCF-01, SCF-02, SCF-03
**Success Criteria** (what must be TRUE):
  1. User can run `claude-hooks test <hook>` and see it fed mock JSON input with pass/fail result and colored output
  2. User can run `claude-hooks test --all` and see every installed hook tested with a summary
  3. Each bundled hook ships with test fixtures that validate automatically
  4. User can run `claude-hooks create my-hook --event PreToolUse --matcher Bash` and get a working hook script with test fixture
  5. User-created hooks with test fixtures in the expected location are auto-discovered by the test command
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Test runner engine (mock JSON stdin, exit code capture, colored output, fixture discovery)
- [ ] 03-02-PLAN.md — Create command with templates for each event type, test fixture scaffolding

### Phase 4: Documentation & Polish
**Goal**: A new user can go from discovery to production hooks by reading the README alone
**Depends on**: Phase 3
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. README has quick start (init + add security-pack), full command reference, and real examples
  2. User can run `claude-hooks info <hook>` and see description with real input/output JSON examples
  3. Every bundled hook script has inline comments explaining what it does, what it blocks, and why
**Plans**: 1 plan

Plans:
- [ ] 04-01: README, info command, inline hook documentation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Settings Engine | 3/3 | Complete   | 2026-03-18 |
| 2. CLI Commands & Hook Registry | 3/3 | Complete   | 2026-03-18 |
| 3. Testing & Scaffolding | 2/2 | Complete   | 2026-03-19 |
| 4. Documentation & Polish | 0/1 | Not started | - |
