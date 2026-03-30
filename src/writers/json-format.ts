import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { UnifiedMcpServer } from "../types.js";

/**
 * Generic writer for targets that store MCP servers in a JSON settings file
 * under a configurable key (e.g. "mcpServers" or "amp.mcpServers").
 *
 * Each target supplies its own converter function that maps a UnifiedMcpServer
 * to the target-specific server object shape. The shared scaffold handles:
 * directory check, JSON read/write, OAuth skip, duplicate skip, and dry-run.
 *
 * Used by Gemini, Qwen Code, Amp, and Windsurf writers.
 */
export function writeJsonFormat(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  options: {
    configPath: string;
    targetName: string;
    jsonKey?: string;
    converter: (server: UnifiedMcpServer) => Record<string, unknown> | null;
  }
): { added: string[]; skipped: string[] } {
  const { configPath, targetName, converter } = options;
  const jsonKey = options.jsonKey ?? "mcpServers";
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

  let settings: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      settings = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      // skip malformed settings
    }
  }

  const existing = (settings[jsonKey] as Record<string, unknown>) ?? {};

  for (const server of servers) {
    if (server.oauth && !server.command && !server.url) {
      skipped.push(`${server.name} (requires manual OAuth)`);
      continue;
    }

    const converted = converter(server);
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

  settings[jsonKey] = existing;

  if (!dryRun && added.length > 0) {
    writeFileSync(configPath, JSON.stringify(settings, null, 2) + "\n");
  }

  return { added, skipped };
}
