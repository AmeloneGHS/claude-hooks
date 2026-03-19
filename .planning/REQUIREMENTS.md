# Requirements: claude-hooks

**Defined:** 2026-03-18
**Core Value:** Developers can go from zero to production-grade Claude Code hooks in under 60 seconds

## v1 Requirements

### CLI Core

- [x] **CLI-01**: User can run `npx claude-hooks init` to scaffold hook directory and seed settings.json
- [x] **CLI-02**: User can run `claude-hooks add <hook>` to install a hook from the bundled registry
- [x] **CLI-03**: User can run `claude-hooks add <pack>` to install a pack of related hooks in one command
- [x] **CLI-04**: User can run `claude-hooks remove <hook>` to cleanly uninstall a hook (script + settings.json entry)
- [x] **CLI-05**: User can run `claude-hooks list` to see available hooks, installed status, and event types
- [x] **CLI-06**: User can run `claude-hooks test <hook>` to validate a hook with mock JSON input and verify exit code + output
- [x] **CLI-07**: User can run `claude-hooks test --all` to test all installed hooks
- [x] **CLI-08**: User can run `claude-hooks create <name> --event <type> --matcher <pattern>` to scaffold a custom hook from templates
- [x] **CLI-09**: User can run `claude-hooks doctor` to validate installation health (scripts exist, executable, settings.json valid)
- [x] **CLI-10**: Every command supports `--help` with clear usage examples

### Settings Management

- [x] **SET-01**: `add` and `init` perform non-destructive deep merge on settings.json, preserving all existing config
- [x] **SET-02**: User can pass `--dry-run` on any write command to preview changes without applying
- [x] **SET-03**: Settings.json is automatically backed up before any write operation
- [x] **SET-04**: User can run `claude-hooks restore` to revert to the last backup
- [x] **SET-05**: `doctor` detects conflicting hooks (overlapping event+matcher combinations) and warns
- [x] **SET-06**: `add` and `remove` target the correct settings scope (user/project/local via `--scope` flag)

### Hook Registry

- [x] **REG-01**: Registry ships bundled with the npm package (no remote server)
- [x] **REG-02**: Each hook has metadata: name, description, event type, matcher, what it blocks/allows
- [x] **REG-03**: Security pack includes: sensitive-path-guard, exit-code enforcer
- [x] **REG-04**: Quality pack includes: post-edit-lint, ts-check
- [x] **REG-05**: Cost pack includes: web-budget-gate, cost-tracker
- [x] **REG-06**: Error pack includes: error-advisor with contextual fix suggestions
- [x] **REG-07**: All bundled hooks use exit code 2 to block (not exit 1) per Claude Code spec
- [x] **REG-08**: All bundled hooks are POSIX-compatible (macOS bash 3.2 + Linux bash 5.x)

### Testing Framework

- [x] **TST-01**: Test runner feeds mock tool JSON (stdin) to hook scripts and captures exit code + stdout
- [x] **TST-02**: Each bundled hook ships with test fixtures (input JSON + expected outcome)
- [x] **TST-03**: Test output clearly shows pass/fail per hook with colored output
- [x] **TST-04**: User-created hooks can include test fixtures that `test` command discovers automatically

### Hook Scaffolding

- [x] **SCF-01**: `create` generates a working hook script with proper shebang, stdin JSON parsing, and exit code handling
- [x] **SCF-02**: `create` generates a test fixture skeleton alongside the hook script
- [x] **SCF-03**: Templates exist for each supported event type (PreToolUse, PostToolUse, SessionStart, Stop)

### Documentation

- [ ] **DOC-01**: README with quick start, all commands, and examples
- [ ] **DOC-02**: `claude-hooks info <hook>` shows hook description with real input/output JSON examples
- [ ] **DOC-03**: Each bundled hook has inline documentation (comments in script)

## v2 Requirements

### Distribution

- **DIST-01**: User can install hooks from a git URL (`--from <url>`)
- **DIST-02**: Remote hook registry with community submissions
- **DIST-03**: Hook versioning and `outdated` command

### Advanced

- **ADV-01**: Prompt and agent hook type scaffolding (with cost warnings)
- **ADV-02**: Hook enable/disable without removing (toggle in settings.json)
- **ADV-03**: Hook analytics (local-only execution counts and timing)

## Out of Scope

| Feature | Reason |
|---------|--------|
| GUI/TUI interface | CLI-first tool, avoid dependency bloat |
| Windows native hooks | macOS/Linux focus, WSL is the Windows path |
| Auto-updating hooks | Trust violation — users control versions |
| Remote marketplace (v1) | Server infrastructure, moderation overhead |
| Hook telemetry/analytics | Privacy concern, trust killer for OSS |
| MCP server for management | Overcomplicates what should be a CLI tool |
| Claude Code API integration | No public API exists, file-based only |
| Hook chaining/DAG resolution | Over-engineering for event-based system |
| Paid features | Fully open source, MIT license |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 1 | Complete |
| CLI-02 | Phase 2 | Complete |
| CLI-03 | Phase 2 | Complete |
| CLI-04 | Phase 2 | Complete |
| CLI-05 | Phase 2 | Complete |
| CLI-06 | Phase 3 | Complete |
| CLI-07 | Phase 3 | Complete |
| CLI-08 | Phase 3 | Complete |
| CLI-09 | Phase 2 | Complete |
| CLI-10 | Phase 2 | Complete |
| SET-01 | Phase 1 | Complete |
| SET-02 | Phase 1 | Complete |
| SET-03 | Phase 1 | Complete |
| SET-04 | Phase 1 | Complete |
| SET-05 | Phase 2 | Complete |
| SET-06 | Phase 1 | Complete |
| REG-01 | Phase 1 | Complete |
| REG-02 | Phase 1 | Complete |
| REG-03 | Phase 2 | Complete |
| REG-04 | Phase 2 | Complete |
| REG-05 | Phase 2 | Complete |
| REG-06 | Phase 2 | Complete |
| REG-07 | Phase 2 | Complete |
| REG-08 | Phase 2 | Complete |
| TST-01 | Phase 3 | Complete |
| TST-02 | Phase 3 | Complete |
| TST-03 | Phase 3 | Complete |
| TST-04 | Phase 3 | Complete |
| SCF-01 | Phase 3 | Complete |
| SCF-02 | Phase 3 | Complete |
| SCF-03 | Phase 3 | Complete |
| DOC-01 | Phase 4 | Pending |
| DOC-02 | Phase 4 | Pending |
| DOC-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation*
