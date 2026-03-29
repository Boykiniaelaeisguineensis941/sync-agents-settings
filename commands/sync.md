---
name: sync
description: Sync MCP server configurations from Claude Code to other AI agents (Gemini, Codex, OpenCode, Kiro, Cursor, Kimi, Vibe, Qwen, Amp, Cline, Windsurf)
---

Sync MCP server settings from Claude Code to other AI coding agents.

## Arguments

The user may pass target names after the command: `/sync gemini codex`
If no targets specified, sync to all targets (gemini, codex, opencode, kiro, cursor, kimi, vibe, qwen, amp, cline, windsurf).

The user may also pass server names to sync only specific servers: `/sync --server context7 supabase`

The user may also pass flags:
- `--server <names...>` or `-s <names...>` — sync only specified MCP servers by name
- `--skip-oauth` — skip MCP servers that require OAuth authentication
- `--no-backup` — skip creating backup of target config files
- `--codex-home <path>` — custom Codex config directory
- `--kimi-home <path>` — custom Kimi config directory
- `--vibe-home <path>` — custom Vibe config directory
- `--qwen-home <path>` — custom Qwen Code config directory
- `--amp-home <path>` — custom Amp config directory
- `--cline-home <path>` — custom Cline CLI config directory
- `--windsurf-home <path>` — custom Windsurf config directory
- `--report json` — output machine-readable JSON summary (CI-friendly)

## Execution Flow

1. Parse targets and server names from user arguments. Build the command:
   `npx sync-agents-settings sync --dry-run --target <targets>`
   Add `--server <names>` if the user specified specific servers.
   Add `--skip-oauth` or `--no-backup` if the user specified them.

2. Run the dry-run command using bash. This previews what will change without writing files.

3. Present the results to the user:
   - Servers that will be **added** to each target
   - Servers that will be **skipped** (already exist or unsupported)
   - If all servers are skipped, inform the user and stop here.

4. Ask the user: "Proceed with sync?"

5. If confirmed, run the same command without `--dry-run`:
   `npx sync-agents-settings sync --target <targets>`

6. Present the final results.
   - If `--report json` is used, return raw JSON and avoid text post-processing.

## Error Handling

- If `npx` fails with "command not found" or network error: suggest `npm install -g sync-agents-settings` as fallback.
- If the CLI exits with non-zero code: show the stderr output and suggest checking that target agent directories exist.
