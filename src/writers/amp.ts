import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { AmpMcpServer, AmpSettings, UnifiedMcpServer } from "../types.js";

const DEFAULT_AMP_HOME = join(homedir(), ".config", "amp");

export function resolveAmpSettingsPath(ampHome?: string): string {
  const dir = resolve(ampHome ?? DEFAULT_AMP_HOME);
  return join(dir, "settings.json");
}

const AMP_MCP_KEY = "amp.mcpServers" as const;

export function writeToAmp(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  ampHome?: string
): { added: string[]; skipped: string[]; configPath: string } {
  const added: string[] = [];
  const skipped: string[] = [];
  const configPath = resolveAmpSettingsPath(ampHome);
  const ampDir = dirname(configPath);

  if (!existsSync(ampDir)) {
    return {
      added: [],
      skipped: [
        `all ${servers.length} server(s) (${ampDir} does not exist, please install Amp or use --amp-home)`,
      ],
      configPath,
    };
  }

  let settings: AmpSettings = {};
  if (existsSync(configPath)) {
    try {
      settings = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      // skip malformed settings
    }
  }

  const existing = settings[AMP_MCP_KEY] ?? {};

  for (const server of servers) {
    if (server.oauth && !server.command && !server.url) {
      skipped.push(`${server.name} (requires manual OAuth)`);
      continue;
    }

    const ampServer = toAmpServer(server);
    if (!ampServer) {
      skipped.push(`${server.name} (cannot convert)`);
      continue;
    }

    if (existing[server.name]) {
      skipped.push(`${server.name} (already exists)`);
      continue;
    }

    existing[server.name] = ampServer;
    added.push(server.name);
  }

  settings[AMP_MCP_KEY] = existing;

  if (!dryRun && added.length > 0) {
    writeFileSync(configPath, JSON.stringify(settings, null, 2) + "\n");
  }

  return { added, skipped, configPath };
}

function toAmpServer(server: UnifiedMcpServer): AmpMcpServer | null {
  if (server.transport === "stdio" && server.command) {
    return {
      command: server.command,
      ...(server.args && { args: server.args }),
      ...(server.env && { env: server.env }),
    };
  }

  // Amp uses url for both HTTP and SSE transports
  if ((server.transport === "http" || server.transport === "sse") && server.url) {
    return {
      url: server.url,
      ...(server.headers && { headers: server.headers }),
    };
  }

  return null;
}
