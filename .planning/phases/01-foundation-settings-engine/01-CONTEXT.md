# Phase 1: Foundation & Settings Engine - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Types, schemas, non-destructive settings merger, registry data model, and init command. Users can initialize claude-hooks and trust it will never destroy their existing settings.json. No hook installation (add/remove) — that's Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Settings file handling
- Default target scope: **project** (.claude/settings.json in repo root)
- `--scope user|project|local` flag available to override default
- On conflict (same event+matcher as existing hook): **warn and skip** — user must remove first
- Single backup file: `.claude/settings.json.backup` — overwritten on each write
- `claude-hooks restore` reverts to the single backup
- Deep merge strategy: preserve all existing config, only add/modify hook entries

### Init experience
- `npx claude-hooks init` creates `.claude/hooks/` directory and seeds `.claude/settings.json` with empty hooks structure
- **Silent with summary** — no interactive prompts, prints what was created, exits cleanly. Works in CI.
- `--dry-run` flag to preview without writing
- **No-op on re-init** — if hooks already configured, print "Already initialized" and exit. Don't touch existing config.

### Hook directory layout
- Hook scripts live in `.claude/hooks/` (inside the existing .claude directory)
- Naming convention: **kebab-case.sh** (e.g. `sensitive-path-guard.sh`, `post-edit-lint.sh`)
- All hooks (bundled and user-created) in the same flat directory — no subdirectory split
- Scripts are committable to git for team sharing

### Registry data model
- **JSON manifest + scripts dir** — `registry.json` with hook metadata, actual scripts in a separate hooks/ dir within the npm package
- No hook dependencies — each hook is standalone. Packs are named groups, not dependency chains.
- Packs defined as **named lists in registry.json**: `{ "packs": { "security-pack": ["sensitive-path-guard", "exit-code-enforcer"] } }`
- Hook metadata fields (core only): name, description, event, matcher, pack membership, script filename

### Claude's Discretion
- TypeScript project scaffold specifics (tsconfig, build tooling, package.json scripts)
- Commander.js command structure and option parsing details
- Deep merge algorithm implementation
- Error message wording and formatting
- Internal type/interface design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Claude Code hooks spec
- `.planning/research/ARCHITECTURE.md` — Settings merger patterns, CLI architecture decisions
- `.planning/research/FEATURES.md` — Feature breakdown and implementation guidance
- `.planning/research/PITFALLS.md` — Common mistakes and edge cases to avoid
- `.planning/research/STACK.md` — Technology stack decisions and rationale
- `.planning/research/SUMMARY.md` — Research synthesis and key takeaways

### Project definition
- `.planning/PROJECT.md` — Core value prop, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Full v1 requirements with IDs (CLI-01 through DOC-03)
- `.planning/ROADMAP.md` — Phase breakdown and success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing code — greenfield project, empty repo

### Established Patterns
- No patterns yet — Phase 1 establishes them

### Integration Points
- Claude Code settings.json format (user/project/local scopes)
- npm/npx distribution pipeline
- `.claude/hooks/` directory convention (must match what settings.json command paths reference)

</code_context>

<specifics>
## Specific Ideas

- "husky for Claude Code" — the mental model for how this tool should feel
- Austin has 19 production hooks on a headless Mac Mini — these inform the bundled registry
- Competitor gap: disler/claude-code-hooks-mastery (3.3K stars) is scripts-only, no CLI management

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-settings-engine*
*Context gathered: 2026-03-18*
