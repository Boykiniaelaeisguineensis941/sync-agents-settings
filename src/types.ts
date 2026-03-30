// ===== Claude Code MCP Config Types =====

export interface ClaudeMcpServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: "http" | "sse";
  url?: string;
  headers?: Record<string, string>;
  oauth?: {
    clientId: string;
    callbackPort?: number;
  };
  description?: string;
}

/** Plugin .mcp.json can be either flat or nested under mcpServers */
export type PluginMcpJson =
  | Record<string, ClaudeMcpServer>
  | { mcpServers: Record<string, ClaudeMcpServer> };

export interface ClaudeSettings {
  enabledPlugins?: Record<string, boolean>;
  mcpServers?: Record<string, ClaudeMcpServer>;
  [key: string]: unknown;
}

// ===== OpenCode MCP Config Types =====

export interface OpenCodeMcpServer {
  type: "local" | "remote";
  command?: string[];
  environment?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  oauth?: Record<string, unknown> | false;
  enabled?: boolean;
  timeout?: number;
}

export interface OpenCodeConfig {
  mcp?: Record<string, OpenCodeMcpServer>;
  [key: string]: unknown;
}

// ===== Unified MCP Server =====

export type McpTransport = "stdio" | "http" | "sse";

export interface UnifiedMcpServer {
  name: string;
  transport: McpTransport;
  source: "claude-config" | "claude-plugin";
  // stdio fields
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // http/sse fields
  url?: string;
  headers?: Record<string, string>;
  oauth?: Record<string, unknown>;
}

// ===== Sync Options =====

export type SyncTarget =
  | "gemini"
  | "codex"
  | "opencode"
  | "kiro"
  | "cursor"
  | "kimi"
  | "vibe"
  | "qwen"
  | "amp"
  | "cline"
  | "windsurf";
