# Stack Research

**Project:** claude-hooks
**Researched:** 2026-03-18
**Mode:** Ecosystem

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Commander.js | 14.x | CLI argument parsing & command routing | 270M+ weekly downloads, battle-tested, excellent TypeScript support since v12+, extensive ecosystem knowledge means contributors already know it. Optique and gunshi are interesting newcomers but too niche for an open-source project that needs contributor accessibility. | HIGH |
| Node.js | >=18.x | Runtime | LTS baseline. 18+ gives native `fs/promises`, `node:test`, structuredClone. No reason to require 20+ yet. | HIGH |
| TypeScript | 5.7+ | Type safety | Current stable. Strict mode, `satisfies`, `const` type parameters. | HIGH |

### Build & Bundle

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsup | 8.x | Bundle TS to JS for npm distribution | tsdown is the future but tsup is proven and stable for production CLI tools today. tsdown's author recommends it as tsup's successor, but for a v1 launch, tsup's stability wins. Zero-config for CLI bundling, outputs CJS+ESM, handles shebang insertion. Migration to tsdown later is trivial (drop-in replacement). | HIGH |
| typescript | 5.7+ | Type checking (not compilation) | tsup handles compilation via esbuild; tsc is for `--noEmit` type checking only. | HIGH |

### Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vitest | 3.x | Unit & integration testing | Native TypeScript, fast startup, ESM-first, excellent DX with watch mode. The standard for new TS projects in 2025-2026. Jest is legacy at this point. | HIGH |

### Terminal Output

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| picocolors | 1.x | Terminal color output | 7KB vs chalk's 101KB. 2x faster. Zero dependencies. Used by Vite, Rollup, PostCSS. For a CLI tool with minimal deps, this is the right choice. chalk is overweight for what we need (bold, green, red, yellow). | HIGH |

### Configuration & Validation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| zod | 3.x | Schema validation for settings.json & hook configs | Type inference from schemas, excellent error messages, standard in TS ecosystem. Validates user hook configs and settings.json structure before writing. | HIGH |

### File System & Utilities

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| node:fs/promises | built-in | File operations | No external dependency needed. Native async FS. | HIGH |
| node:path | built-in | Path manipulation | Built-in, cross-platform path handling. | HIGH |
| deepmerge-ts | 7.x | Deep merge settings.json without overwriting | Type-safe deep merge. Critical for the non-destructive settings.json management requirement. Small, focused library. | MEDIUM |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| **Yargs** | Heavier dependency tree, more complex API. Commander is simpler for our command structure (init, add, remove, list, test, create). |
| **Oclif** | Way too heavy. Generates entire project scaffolding, brings Salesforce ecosystem baggage. Designed for enterprise CLIs with dozens of commands. We have 6 commands. |
| **Optique** | Too new, too niche. Low npm downloads, small community. Would hurt contributor onboarding. Revisit in 2027. |
| **gunshi** | Same problem as Optique -- interesting but unproven. |
| **Chalk** | 14x larger than picocolors, slower load time. We need basic colors, not 16M color support. |
| **Jest** | Slower, requires transforms for TypeScript, CJS-first. Vitest is strictly better for new TS projects. |
| **tsdown** | Promising successor to tsup but tsup author marked tsup as maintenance-only, not dead. For v1 stability, tsup is safer. Migration is trivial later. |
| **Ink (React for CLI)** | Massive overkill. We're not building a TUI. Simple stdout output with picocolors is all we need. |
| **Inquirer / Prompts** | We don't need interactive prompts for v1. Commands are non-interactive (`npx claude-hooks add security-pack`). If needed later, use `@clack/prompts` (smaller, modern). |
| **ora / nanospinner** | Spinners add complexity for minimal gain. A simple "Done." with a checkmark via picocolors is sufficient. |
| **cosmiconfig** | Overkill config discovery. We know exactly where our config lives (`~/.claude/settings.json`). No need to search up directory trees. |

## Package.json Configuration

```json
{
  "name": "claude-hooks",
  "type": "module",
  "bin": {
    "claude-hooks": "./dist/cli.js"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=18.0.0"
  }
}
```

Key points:
- `"type": "module"` -- ESM-first, the standard for 2025+
- `bin` entry enables `npx claude-hooks` execution
- `files: ["dist"]` -- only ship compiled JS, not source TS
- tsup inserts `#!/usr/bin/env node` shebang automatically

## tsup Configuration

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false, // No type exports needed for a CLI tool
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Bundle all deps into the output for zero-install npx experience
  noExternal: [/.*/],
});
```

Bundling all dependencies means `npx claude-hooks init` downloads one package with zero dep resolution -- faster cold start.

## Dev Dependencies

```bash
npm install -D typescript tsup vitest @types/node
```

## Runtime Dependencies

```bash
npm install commander picocolors zod deepmerge-ts
```

Note: With `noExternal: [/.*/]` in tsup, these get bundled into the output. They're listed as dependencies for transparency but don't cause separate installs for npx users.

## Dependency Count

- **Runtime:** 4 (commander, picocolors, zod, deepmerge-ts)
- **Dev:** 4 (typescript, tsup, vitest, @types/node)
- **Total direct:** 8

This is deliberately minimal. Every dependency is justified and serves a specific purpose.

## npx Distribution Notes

1. Package must have a `bin` field in package.json
2. Entry file needs `#!/usr/bin/env node` shebang (tsup handles this)
3. `npm publish` is the only deployment step -- npx pulls from npm registry
4. Test locally with `npm link` or `npx .` from project root
5. Bundle all deps (`noExternal`) for fastest npx cold start

## Sources

- [Commander.js npm](https://www.npmjs.com/package/commander) -- 270M+ weekly downloads, v14.0.3 latest
- [tsup GitHub](https://github.com/egoist/tsup) -- v8.x stable
- [tsdown migration guide](https://tsdown.dev/guide/migrate-from-tsup) -- confirms drop-in replacement path
- [picocolors GitHub](https://github.com/alexeyraspopov/picocolors) -- 7KB, 2x faster than chalk
- [Vitest 3.2 release](https://vitest.dev/blog/vitest-3-2.html) -- latest stable
- [My JS CLI Stack 2025](https://ryoppippi.com/blog/2025-08-12-my-js-cli-stack-2025-en) -- modern CLI patterns
- [Building CLI apps with TypeScript in 2026](https://dev.to/hongminhee/building-cli-apps-with-typescript-in-2026-5c9d) -- emerging tools landscape
- [Building Your Own NPX CLI Tool](https://johnsedlak.com/blog/2025/03/building-an-npx-cli-tool) -- npx distribution patterns
