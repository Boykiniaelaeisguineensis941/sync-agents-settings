# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build              # Compile TypeScript (src/ → dist/)
pnpm test               # Run all tests (vitest)
pnpm test:coverage      # Run tests with v8 coverage report
pnpm lint               # ESLint check
pnpm format:check       # Prettier check
pnpm format             # Prettier auto-fix
pnpm dev list           # Run CLI from source (tsx)
pnpm dev doctor         # Check MCP drift from source without writing files
pnpm dev validate       # Validate schema/capability compatibility before syncing
pnpm dev reconcile      # Run validate + doctor + sync missing in one flow
pnpm dev doctor -- --fix --dry-run   # Auto-fix drift via reconcile (preview)
pnpm dev reconcile -- --report json   # Machine-readable output for CI integration
pnpm dev sync -- --report json --dry-run   # Machine-readable sync preview
pnpm dev sync-instructions -- --report json --dry-run --global --target gemini   # Machine-readable instruction sync preview
pnpm dev diff -- --report json --target gemini codex   # Machine-readable diff output
pnpm dev report-schema -- --write docs/report-schema.md   # Regenerate report schema markdown from code
pnpm dev report-schema -- --check   # CI check for stale/missing report schema doc
bash ci-local.sh        # Run full local CI (format + lint + typecheck + build + test)
```

Run a single test file:
```bash
npx vitest run src/__tests__/codex-writer.test.ts
```

**Important:** Always run `bash ci-local.sh` before committing to catch lint/format/type errors early.

## Architecture

This is a CLI tool that reads MCP server configurations from Claude Code and writes them to other AI coding agents in their native formats.

**Data flow:**
```
Reader (src/reader.ts)
  → reads ~/.claude.json + enabled plugin .mcp.json files
  → produces UnifiedMcpServer[]

Writers (src/writers/*.ts)
  → each writer converts UnifiedMcpServer[] to target-specific format
  → writes to target config file
```

**Writer patterns — three categories:**

1. **Claude-format targets** (Kiro, Cursor, Kimi, Cline): Use shared `claude-format.ts` — same `mcpServers` JSON format as Claude, just different file paths. Each writer is ~10 lines delegating to `writeClaudeFormat()`. Cline config lives at `~/.cline/data/settings/cline_mcp_settings.json`.

2. **Custom JSON targets** (Gemini, OpenCode, Qwen Code, Amp, Windsurf): Own writer with format-specific conversion (`httpUrl`, `type: "local"/"remote"`, `environment` vs `env`). Qwen Code follows the Gemini pattern (settings.json with embedded `mcpServers`, `httpUrl` for HTTP, `$VAR` env syntax). Amp uses `"amp.mcpServers"` as the JSON key (dotted key) and `${VAR}` env syntax (same as Claude, no conversion needed). Windsurf uses `serverUrl` instead of `url` for remote servers and `${env:VAR}` env syntax.

3. **TOML targets** (Codex, Vibe): Convert JSON to TOML via `@iarna/toml`. Codex uses `[mcp_servers.<name>]` (table-per-key), Vibe uses `[[mcp_servers]]` (array-of-tables with `name` + `transport` fields).

**Adding a new target that uses Claude's format:** Create a one-liner writer like `kiro.ts`/`cursor.ts`/`kimi.ts`, add path to `paths.ts`, add target name to `SyncTarget` union in `types.ts`, wire into `cli.ts`, `backup.ts`, `doctor.ts`, `reconcile.ts`, `fix.ts`, and `instructions.ts`.

**Instruction sync (`sync-instructions` command):**

```
src/instructions.ts
  → reads CLAUDE.md (global or local)
  → filterClaudeSpecificSyntax() removes @import lines
  → optional transform: wrapForKiro() or wrapForCursor() adds frontmatter
  → writes to target instruction file

src/prompt.ts
  → askConflictAction() interactive prompt when target file exists
  → options: overwrite / append / skip
```

**Key modules:**
- `src/env.ts` — `expandEnvVars()` resolves `${VAR:-default}` syntax for targets that don't support it (Codex, OpenCode, Kiro, Cursor, Kimi). Gemini and Qwen Code do their own `${VAR}` → `$VAR` conversion inline.
- `src/backup.ts` — copies all affected config files to `~/.sync-agents-backup/<timestamp>/` before writing
- `src/paths.ts` — centralized config file paths for all targets (MCP + instruction paths)
- `src/doctor.ts` — drift/health checker that compares Claude source MCP names against each target and reports missing/extra/unavailable/parse-error states
- `src/validation.ts` — schema/capability validator for pre-sync checks (blank command/url treated as missing errors, OAuth-only reported as manual-setup warning, plus target-specific mapping warnings)
- `src/reconcile.ts` — orchestration layer that runs validate + doctor and then syncs only drift-missing servers per target
- `src/fix.ts` — shared auto-fix entrypoint for `doctor --fix` / `validate --fix` (delegates to reconcile with guard checks)
- `src/report.ts` — report formatter for CI-friendly machine-readable outputs (`doctor` / `validate` / `reconcile`)
- `src/report-parser.ts` — stable parser helper that validates JSON reports by `schemaVersion` for consumer-side compatibility checks
- `src/report-schema-renderer.ts` — renders required-field markdown from parser validator metadata for documentation sync
- `src/diff.ts` — reusable set comparison utility used by text/JSON diff outputs
- `src/instructions.ts` — instruction file sync logic with source caching and transform pipeline
- `src/prompt.ts` — interactive conflict resolution (overwrite/append/skip)

## Testing

- Unit tests mock `node:fs` with `vi.mock("node:fs")` — no real filesystem access
- E2E tests (`e2e.test.ts`) create a fake `HOME` directory in `/tmp` and run the CLI via `execFileSync`
- `vitest.config.ts` scopes tests to `src/__tests__/` to avoid running compiled `dist/` duplicates

## Publishing

Published to npm as `sync-agents-settings`. The `bin` entry uses a CJS wrapper (`bin/sync-agents.cjs`) that dynamically imports the ESM `dist/cli.js` — this is required for `npx` compatibility with ESM packages.

## Plugin

This repo is also a Claude Code plugin **and marketplace**. When bumping the version in `package.json`, also update these files to match:
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
