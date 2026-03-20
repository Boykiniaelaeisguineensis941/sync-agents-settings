import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { UnifiedMcpServer } from "../types.js";
import { expandEnvVars } from "../env.js";

interface ClaudeFormatServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

interface ClaudeFormatConfig {
  mcpServers?: Record<string, ClaudeFormatServer>;
  [key: string]: unknown;
}

/**
 * Generic writer for targets that use the same MCP format as Claude Code
 * (mcpServers with command/args/env/url/headers).
 * Used by Kiro and Cursor writers.
 */
export function writeClaudeFormat(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  configPath: string,
  targetName: string
): { added: string[]; skipped: string[] } {
  const added: string[] = [];
  const skipped: string[] = [];

  const configDir = dirname(configPath);
  if (!existsSync(configDir)) {
    return {
      added: [],
      skipped: [
        `all ${servers.length} server(s) (${configDir} does not exist, please install ${targetName} first)`,
      ],
    };
  }

  let config: ClaudeFormatConfig = {};
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8");
    if (raw.trim()) {
      config = JSON.parse(raw);
    }
  }

  const existing = config.mcpServers ?? {};

  for (const server of servers) {
    if (server.oauth && !server.command && !server.url) {
      skipped.push(`${server.name} (requires manual OAuth)`);
      continue;
    }

    const converted = toClaudeFormatServer(server);
    if (!converted) {
      skipped.push(`${server.name} (cannot convert)`);
      continue;
    }

    if (existing[server.name]) {
      skipped.push(`${server.name} (already exists)`);
      continue;
    }

    existing[server.name] = converted;
    added.push(server.name);
  }

  config.mcpServers = existing;

  if (!dryRun && added.length > 0) {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  }

  return { added, skipped };
}

function toClaudeFormatServer(server: UnifiedMcpServer): ClaudeFormatServer | null {
  if (server.transport === "stdio" && server.command) {
    const result: ClaudeFormatServer = {
      command: server.command,
    };
    if (server.args) result.args = server.args;
    if (server.env) result.env = server.env;
    return result;
  }

  if ((server.transport === "http" || server.transport === "sse") && server.url) {
    const result: ClaudeFormatServer = {
      url: expandEnvVars(server.url),
    };
    if (server.headers) result.headers = server.headers;
    return result;
  }

  return null;
}
