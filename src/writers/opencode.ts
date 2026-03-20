import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { PATHS } from "../paths.js";
import type { OpenCodeConfig, OpenCodeMcpServer, UnifiedMcpServer } from "../types.js";
import { expandEnvVars } from "../env.js";

export function writeToOpenCode(
  servers: UnifiedMcpServer[],
  dryRun: boolean
): { added: string[]; skipped: string[] } {
  const added: string[] = [];
  const skipped: string[] = [];

  // Check if OpenCode config directory exists
  const openCodeDir = dirname(PATHS.openCodeConfig);
  if (!existsSync(openCodeDir)) {
    return {
      added: [],
      skipped: [
        `all ${servers.length} server(s) (${openCodeDir} does not exist, please install OpenCode first)`,
      ],
    };
  }

  // Read existing OpenCode config
  let config: OpenCodeConfig = {};
  if (existsSync(PATHS.openCodeConfig)) {
    const raw = readFileSync(PATHS.openCodeConfig, "utf-8");
    if (raw.trim()) {
      config = JSON.parse(raw);
    }
  }

  const existing = config.mcp ?? {};

  for (const server of servers) {
    // Skip OAuth-only servers (need manual auth)
    if (server.oauth && !server.command && !server.url) {
      skipped.push(`${server.name} (requires manual OAuth)`);
      continue;
    }

    const openCodeServer = toOpenCodeServer(server);
    if (!openCodeServer) {
      skipped.push(`${server.name} (cannot convert)`);
      continue;
    }

    // Don't overwrite existing config
    if (existing[server.name]) {
      skipped.push(`${server.name} (already exists)`);
      continue;
    }

    existing[server.name] = openCodeServer;
    added.push(server.name);
  }

  config.mcp = existing;

  if (!dryRun && added.length > 0) {
    writeFileSync(PATHS.openCodeConfig, JSON.stringify(config, null, 2) + "\n");
  }

  return { added, skipped };
}

function toOpenCodeServer(server: UnifiedMcpServer): OpenCodeMcpServer | null {
  if (server.transport === "stdio" && server.command) {
    const command = [server.command, ...(server.args ?? [])];
    const result: OpenCodeMcpServer = {
      type: "local",
      command,
    };
    if (server.env) {
      result.environment = server.env;
    }
    return result;
  }

  if ((server.transport === "http" || server.transport === "sse") && server.url) {
    const result: OpenCodeMcpServer = {
      type: "remote",
      url: expandEnvVars(server.url),
    };
    if (server.headers) {
      result.headers = server.headers;
    }
    return result;
  }

  return null;
}
