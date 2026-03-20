# sync-agents-settings

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![version](https://img.shields.io/badge/version-0.1.0-blue)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green?logo=node.js)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-orange?logo=pnpm)](https://pnpm.io/)
[![Vitest](https://img.shields.io/badge/Vitest-4.1-green?logo=vitest)](https://vitest.dev/)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2)](https://modelcontextprotocol.io/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?logo=prettier)](https://prettier.io/)
[![CI](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml/badge.svg)](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml)

Sync MCP server configurations from **Claude Code** to **Gemini CLI**, **Codex CLI**, **OpenCode**, **Kiro CLI**, and **Cursor**.

[中文說明](#中文說明)

## Why

If you use Claude Code as your primary AI coding agent but also switch between other agents (Gemini CLI, Codex CLI, OpenCode, Kiro, Cursor) to take advantage of their free tiers or different models, you know the pain — every tool has its own MCP config format, and setting them up one by one is tedious.

This tool lets you configure MCP servers once in Claude Code, then sync everywhere with a single command.

## Install

```bash
pnpm install
```

## Usage

```bash
# List all MCP servers detected from Claude Code
npx tsx src/cli.ts list

# Preview sync (no files modified)
npx tsx src/cli.ts sync --dry-run

# Sync to all targets (with automatic backup)
npx tsx src/cli.ts sync

# Sync to a specific target
npx tsx src/cli.ts sync --target gemini
npx tsx src/cli.ts sync --target codex
npx tsx src/cli.ts sync --target opencode
npx tsx src/cli.ts sync --target kiro
npx tsx src/cli.ts sync --target cursor

# Sync to Codex project-level config
npx tsx src/cli.ts sync --target codex --codex-home ./my-project/.codex

# Compare differences
npx tsx src/cli.ts diff

# Skip OAuth-only servers (e.g. Slack)
npx tsx src/cli.ts sync --skip-oauth

# Skip backup
npx tsx src/cli.ts sync --no-backup

# Verbose output
npx tsx src/cli.ts sync -v
```

## How It Works

**Claude Code is the single source of truth** for MCP settings, synced to all supported targets.

```
                                                 ┌─→ Gemini Writer   ─→ ~/.gemini/settings.json
                                                 ├─→ Codex Writer    ─→ ~/.codex/config.toml
~/.claude.json ─────┐                            │
                     ├─→ Reader ─→ UnifiedMcpServer[] ─┼─→ OpenCode Writer ─→ ~/.config/opencode/opencode.json
~/.claude/plugins/ ──┘                            │
                                                 ├─→ Kiro Writer     ─→ ~/.kiro/settings/mcp.json
                                                 └─→ Cursor Writer   ─→ ~/.cursor/mcp.json
```

| Stage | Description |
|-------|-------------|
| **Reader** | Reads from `~/.claude.json` and enabled plugin `.mcp.json` files, merges into a unified format |
| **Gemini Writer** | JSON → JSON, `type: "http"` → `httpUrl`, `${VAR}` → `$VAR` |
| **Codex Writer** | JSON → TOML, `${VAR:-default}` → expanded to actual value (env value or fallback) |
| **OpenCode Writer** | JSON → JSON, `command`+`args` → merged `command` array, `env` → `environment`, `type: "local"`/`"remote"` |
| **Kiro Writer** | Same format as Claude, `${VAR:-default}` → expanded |
| **Cursor Writer** | Same format as Claude, `${VAR:-default}` → expanded |

**Safety mechanisms:**
- Existing servers are never overwritten (idempotent, safe to re-run)
- Automatic backup to `~/.sync-agents-backup/` by default (`--no-backup` to skip)
- `--dry-run` previews changes without writing any files

### Source: Claude Code

Reads MCP servers from two sources:

1. **`~/.claude.json`** → `mcpServers` object (user-configured servers)
2. **`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/.mcp.json`** → enabled plugin MCP servers (matched against `~/.claude/settings.json` `enabledPlugins`)

Claude Code has two `.mcp.json` formats:

```jsonc
// Format 1: Flat (e.g. context7, firebase)
{ "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] } }

// Format 2: Nested under mcpServers (e.g. sentry, stripe)
{ "mcpServers": { "sentry": { "type": "http", "url": "https://mcp.sentry.dev/mcp" } } }
```

### Target: Gemini CLI

Writes to **`~/.gemini/settings.json`** → `mcpServers` object.

Key format differences from Claude:
- Claude `type: "http"` → Gemini `httpUrl`
- Claude `type: "sse"` → Gemini `url`
- Claude `command` (stdio) → Gemini `command` (same)
- Env var syntax: Claude `${VAR}` → Gemini `$VAR` (auto-converted)

```jsonc
// Gemini settings.json
{
  "theme": "Dracula",          // existing settings preserved
  "mcpServers": {
    "context7": {              // stdio server
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "sentry": {                // http server
      "httpUrl": "https://mcp.sentry.dev/mcp"
    }
  }
}
```

### Target: Codex CLI

Writes to **`~/.codex/config.toml`** (global) by default. Use `--codex-home <path>` to write to a project-level `.codex/config.toml` instead.

> **Note:** Codex CLI does NOT merge global and project configs. When a project has `.codex/`, Codex only reads that directory. Global `~/.codex/` is ignored entirely.

Key format differences:
- Uses TOML instead of JSON
- `command`/`args` for stdio (same concept)
- `url` for HTTP servers (no type field needed)
- `env` is a TOML sub-table `[mcp_servers.<name>.env]`

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.sentry]
url = "https://mcp.sentry.dev/mcp"

[mcp_servers.n8n-mcp]
command = "npx"
args = ["n8n-mcp"]

  [mcp_servers.n8n-mcp.env]
  N8N_API_KEY = "your-key"
  N8N_API_URL = "https://your-n8n.example.com"
```

### Target: OpenCode

Writes to **`~/.config/opencode/opencode.json`** → `mcp` object.

Key format differences:
- Root key is `mcp` (not `mcpServers`)
- stdio servers use `type: "local"` with a merged `command` array (command + args combined)
- HTTP/SSE servers use `type: "remote"`
- Environment variables use `environment` field (not `env`)

```jsonc
// opencode.json
{
  "model": "anthropic/claude-sonnet-4-5",  // existing settings preserved
  "mcp": {
    "context7": {                          // stdio → local
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp"]
    },
    "sentry": {                            // http → remote
      "type": "remote",
      "url": "https://mcp.sentry.dev/mcp"
    },
    "n8n-mcp": {                           // env → environment
      "type": "local",
      "command": ["npx", "n8n-mcp"],
      "environment": {
        "N8N_API_KEY": "your-key"
      }
    }
  }
}
```

### Target: Kiro CLI

Writes to **`~/.kiro/settings/mcp.json`** → `mcpServers` object.

Same format as Claude Code. `${VAR:-default}` syntax in URLs is auto-expanded during sync.

### Target: Cursor

Writes to **`~/.cursor/mcp.json`** → `mcpServers` object.

Same format as Claude Code. `${VAR:-default}` syntax in URLs is auto-expanded during sync.

## Transport Type Mapping

| Claude Code | Gemini CLI | Codex CLI | OpenCode | Kiro CLI | Cursor |
|------------|-----------|----------|----------|----------|--------|
| `command` + `args` (stdio) | `command` + `args` | `command` + `args` | `type: "local"`, `command: [cmd, ...args]` | same as Claude | same as Claude |
| `type: "http"` + `url` | `httpUrl` | `url` | `type: "remote"`, `url` | same as Claude | same as Claude |
| `type: "sse"` + `url` | `url` | `url` | `type: "remote"`, `url` | same as Claude | same as Claude |
| `env` | `env` | `env` | `environment` | `env` | `env` |
| `oauth` | skipped | skipped | skipped | skipped | skipped |

## Backup

Every sync automatically backs up all affected config files to `~/.sync-agents-backup/<timestamp>/` before writing, preserving the original directory structure relative to `~`:

```
~/.sync-agents-backup/2026-03-20T00-06-08-042Z/
├── .claude.json                  # ← ~/.claude.json
├── .claude/
│   └── settings.json             # ← ~/.claude/settings.json
├── .gemini/
│   └── settings.json             # ← ~/.gemini/settings.json
├── .codex/
│   └── config.toml               # ← ~/.codex/config.toml
├── .config/
│   └── opencode/
│       └── opencode.json         # ← ~/.config/opencode/opencode.json
├── .kiro/
│   └── settings/
│       └── mcp.json              # ← ~/.kiro/settings/mcp.json
└── .cursor/
    └── mcp.json                  # ← ~/.cursor/mcp.json
```

Use `--no-backup` to skip. Target directories that don't exist (CLI not installed) will be skipped with a warning, not created.

## Config File Locations

| Tool | Config Path | Format |
|------|-----------|--------|
| Claude Code (user MCP) | `~/.claude.json` | JSON |
| Claude Code (settings) | `~/.claude/settings.json` | JSON |
| Claude Code (plugin MCP) | `~/.claude/plugins/cache/.../.mcp.json` | JSON |
| Gemini CLI | `~/.gemini/settings.json` | JSON |
| Codex CLI (global) | `~/.codex/config.toml` | TOML |
| Codex CLI (project) | `.codex/config.toml` (use `--codex-home`) | TOML |
| OpenCode (global) | `~/.config/opencode/opencode.json` | JSON |
| OpenCode (project) | `opencode.json` in project root | JSON |
| Kiro CLI (global) | `~/.kiro/settings/mcp.json` | JSON |
| Kiro CLI (project) | `.kiro/settings/mcp.json` in project root | JSON |
| Cursor (global) | `~/.cursor/mcp.json` | JSON |
| Cursor (project) | `.cursor/mcp.json` in project root | JSON |

## Limitations

- **OAuth servers** (e.g. Slack with `oauth.clientId`) are synced as URL-only — you'll need to authenticate manually in each CLI
- **`${CLAUDE_PLUGIN_ROOT}`** env vars won't resolve in other CLIs
- Codex CLI doesn't support `${VAR:-default}` syntax in URLs — these are auto-expanded during sync (env value if set, otherwise the default)
- Re-running sync will **not overwrite** existing entries (safe to run multiple times)
- Codex CLI does NOT merge global and project configs — when `.codex/` exists in a project, global `~/.codex/` is ignored
- If target config directories don't exist, sync will skip that target (won't create directories)

## License

MIT

---

## 中文說明

將 **Claude Code** 的 MCP server 設定同步到 **Gemini CLI**、**Codex CLI**、**OpenCode**、**Kiro CLI** 和 **Cursor**。

### 為什麼需要這個工具

如果你主要用 Claude Code 開發，但也會切換其他 AI agent（Gemini CLI、Codex CLI、OpenCode、Kiro、Cursor）來善用各家的免費額度或不同模型，你一定知道這個痛點 — 每個工具的 MCP 設定格式都不一樣，一個一個設定實在太累。

這個工具讓你只在 Claude Code 設定一次 MCP servers，一行指令同步到所有目標。

### 安裝

```bash
pnpm install
```

### 使用方式

```bash
# 列出所有 Claude Code 的 MCP servers
npx tsx src/cli.ts list

# 預覽同步（不修改任何檔案）
npx tsx src/cli.ts sync --dry-run

# 同步到所有目標（自動備份）
npx tsx src/cli.ts sync

# 同步到特定目標
npx tsx src/cli.ts sync --target gemini
npx tsx src/cli.ts sync --target codex
npx tsx src/cli.ts sync --target opencode
npx tsx src/cli.ts sync --target kiro
npx tsx src/cli.ts sync --target cursor
```

### 運作原理

**Claude Code 是 MCP 設定的 single source of truth**，同步到所有支援的目標。

```
                                                 ┌─→ Gemini Writer   ─→ ~/.gemini/settings.json
                                                 ├─→ Codex Writer    ─→ ~/.codex/config.toml
~/.claude.json ─────┐                            │
                     ├─→ Reader ─→ UnifiedMcpServer[] ─┼─→ OpenCode Writer ─→ ~/.config/opencode/opencode.json
~/.claude/plugins/ ──┘                            │
                                                 ├─→ Kiro Writer     ─→ ~/.kiro/settings/mcp.json
                                                 └─→ Cursor Writer   ─→ ~/.cursor/mcp.json
```

| 階段 | 說明 |
|------|------|
| **Reader** | 從 `~/.claude.json` 和已啟用 plugin 的 `.mcp.json` 讀取，合併為統一格式 |
| **Gemini Writer** | JSON → JSON，`type: "http"` → `httpUrl`，`${VAR}` → `$VAR` |
| **Codex Writer** | JSON → TOML，`${VAR:-default}` → 展開為實際值 |
| **OpenCode Writer** | JSON → JSON，`command`+`args` → 合併為 `command` 陣列，`env` → `environment`，`type: "local"`/`"remote"` |
| **Kiro Writer** | 與 Claude 相同格式，`${VAR:-default}` → 展開 |
| **Cursor Writer** | 與 Claude 相同格式，`${VAR:-default}` → 展開 |

### 安全機制

- 已存在的 server 不會覆蓋（idempotent，可重複執行）
- 預設自動備份到 `~/.sync-agents-backup/`（`--no-backup` 跳過）
- `--dry-run` 預覽變更，不寫入任何檔案

### 限制

- **OAuth servers**（如 Slack）只會同步 URL，需要在各 CLI 手動認證
- **`${CLAUDE_PLUGIN_ROOT}`** 環境變數在其他 CLI 中無法解析
- Codex CLI 不支援 URL 中的 `${VAR:-default}` 語法，同步時會自動展開
- 重複執行不會覆蓋已存在的設定（安全可重複）
- 若目標設定目錄不存在，會跳過該目標（不會自動建立目錄）
