import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import TOML from "@iarna/toml";
import type { UnifiedMcpServer } from "../types.js";
import { expandEnvVars } from "../env.js";

const DEFAULT_CODEX_HOME = join(homedir(), ".codex");

export function resolveCodexConfigPath(codexHome?: string): string {
  const dir = resolve(codexHome ?? DEFAULT_CODEX_HOME);
  return join(dir, "config.toml");
}

interface CodexTomlConfig {
  mcp_servers?: Record<string, CodexTomlServer>;
  [key: string]: unknown;
}

interface CodexTomlServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  bearer_token_env_var?: string;
}

export function writeToCodex(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  codexHome?: string
): { added: string[]; skipped: string[]; configPath: string } {
  const added: string[] = [];
  const skipped: string[] = [];
  const configPath = resolveCodexConfigPath(codexHome);
  const codexDir = dirname(configPath);

  // Check if Codex directory exists
  if (!existsSync(codexDir)) {
    return {
      added: [],
      skipped: [
        `all ${servers.length} server(s) (${codexDir} does not exist, please install Codex CLI or use --codex-home)`,
      ],
      configPath,
    };
  }

  // Read existing config
  let config: CodexTomlConfig = {};
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8");
    if (raw.trim()) {
      config = TOML.parse(raw) as CodexTomlConfig;
    }
  }

  if (!config.mcp_servers) {
    config.mcp_servers = {};
  }

  const existing = config.mcp_servers;

  for (const server of servers) {
    // Skip OAuth-only servers
    if (server.oauth && !server.command && !server.url) {
      skipped.push(`${server.name} (requires manual OAuth)`);
      continue;
    }

    // Skip if already exists
    if (existing[server.name]) {
      skipped.push(`${server.name} (already exists)`);
      continue;
    }

    const codexServer = toCodexServer(server);
    if (!codexServer) {
      skipped.push(`${server.name} (cannot convert)`);
      continue;
    }

    existing[server.name] = codexServer;
    added.push(server.name);
  }

  if (!dryRun && added.length > 0) {
    writeFileSync(configPath, TOML.stringify(config as TOML.JsonMap));
  }

  return { added, skipped, configPath };
}

function toCodexServer(server: UnifiedMcpServer): CodexTomlServer | null {
  if (server.transport === "stdio" && server.command) {
    const result: CodexTomlServer = {
      command: server.command,
    };
    if (server.args) result.args = server.args;
    if (server.env) result.env = server.env;
    return result;
  }

  if ((server.transport === "http" || server.transport === "sse") && server.url) {
    const result: CodexTomlServer = {
      url: expandEnvVars(server.url),
    };

    // Extract bearer token env var from Authorization header
    if (server.headers?.["Authorization"]) {
      const auth = server.headers["Authorization"];
      const envMatch = auth.match(/\$\{?(\w+)\}?/);
      if (envMatch?.[1]) {
        result.bearer_token_env_var = envMatch[1];
      }
    }

    return result;
  }

  return null;
}
