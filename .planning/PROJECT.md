# claude-hooks

## What This Is

An open-source CLI tool and curated hook registry for Claude Code. Think `husky` for Claude Code — install, manage, test, and share hooks with a single command. Ships with 8-10 battle-tested hooks covering security, code quality, cost control, and error recovery. MIT licensed.

## Core Value

Developers can go from zero to production-grade Claude Code hooks in under 60 seconds with `npx claude-hooks init && npx claude-hooks add security-pack`.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] CLI with init, add, remove, list, test, create commands
- [ ] Curated hook registry bundled with the package (8-10 hooks)
- [ ] Hook testing framework (feed mock tool JSON, validate output)
- [ ] Hook scaffolding/templating for custom hooks
- [ ] Non-destructive settings.json management (merge, don't overwrite)
- [ ] Works with npx (zero-install) out of the box
- [ ] Clear documentation with examples for every bundled hook
- [ ] Hook composition (install packs/bundles of related hooks)

### Out of Scope

- Web-based hook marketplace — defer to v2 if community grows
- GUI/TUI interface — CLI-first, keep it simple
- Hook auto-updating — users control their hook versions
- Windows-native hooks — shell scripts target macOS/Linux (WSL works)
- Paid features or licensing — fully open source, MIT license
- Claude Code API integration — we work with the file-based hook system only

## Context

- Claude Code hooks are configured in `~/.claude/settings.json` under a `hooks` key
- Hooks are shell commands, HTTP endpoints, or MCP tool calls triggered by events (PreToolUse, PostToolUse, SessionStart, Stop, etc.)
- The leading open-source project (disler/claude-code-hooks-mastery) has 3.3K stars but is just a script collection — no CLI, no testing, no management
- claudekit (633 stars) is an opinionated monolith requiring Max plan
- Nobody has built a hook package manager with init/add/test/remove workflow
- Austin (author) has 19 production-tested hooks running daily on a headless Mac Mini server, covering patterns nobody else has published
- Target audience: Claude Code users who want production-grade hooks without writing everything from scratch

## Constraints

- **Language**: TypeScript — npm ecosystem native, Claude Code is Node-based
- **Distribution**: npx (zero-install) as primary, npm global as secondary
- **Hook format**: Shell scripts — lowest barrier, works everywhere, matches Claude Code's native format
- **Registry**: Bundled with package (no remote server for v1)
- **Settings management**: Must not break existing user hooks — merge-only approach
- **Dependencies**: Minimal — avoid heavy dep tree for a CLI tool
- **Compatibility**: macOS and Linux (WSL for Windows users)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript over Rust | npm-native distribution, lower contributor barrier, matches Claude Code ecosystem | — Pending |
| Shell hooks over Node modules | Matches Claude Code's native hook format, lowest barrier to entry | — Pending |
| Bundled registry over remote | Simpler v1, no server infrastructure, versioned with the CLI | — Pending |
| Open source MIT | Community building, Anthropic visibility, consulting funnel for @YourBusinessAI | — Pending |
| npx-first distribution | Zero friction install, matches modern CLI tool patterns | — Pending |

---
*Last updated: 2026-03-18 after initialization*
