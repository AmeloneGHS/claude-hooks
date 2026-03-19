# Phase 4: Documentation & Polish - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

README, info command, inline docs, npx distribution readiness. A new user can go from discovery to production hooks by reading the README alone.

</domain>

<decisions>
## Implementation Decisions

### README
- Quick start: init + add security-pack in 60 seconds
- Full command reference for all 8 commands
- Hook registry table (all 7 hooks with descriptions)
- Pack descriptions
- Examples for every command
- Contributing section
- MIT license badge

### info command
- `claude-hooks info <hook>` — shows description, event, matcher, pack, and example input/output JSON
- Uses fixture data to show real examples

### Inline docs
- Every bundled hook script already has inline comments (done in Phase 2)
- Verify completeness

### npx readiness
- package.json bin field already set (done in Phase 1)
- Verify `npx claude-hooks` works end-to-end
- Add keywords for npm discovery

### Claude's Discretion
- README formatting and tone
- Info command output formatting
- npm keywords selection

</decisions>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md` — Core value prop, target audience
- `.planning/REQUIREMENTS.md` — DOC-01, DOC-02, DOC-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/registry/index.ts` — getHook for info command
- `registry/hooks/fixtures/` — fixture data for example display
- All 8 CLI commands already registered and working

### Integration Points
- CLI entry (src/cli.ts) — register info command
- package.json — keywords, description

</code_context>

<specifics>
## Specific Ideas

No specific requirements.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 04-documentation-polish*
*Context gathered: 2026-03-18*
