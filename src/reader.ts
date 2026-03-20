import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "./paths.js";
import type { ClaudeMcpServer, ClaudeSettings, PluginMcpJson, UnifiedMcpServer } from "./types.js";

/**
 * Read all MCP servers from Claude Code config sources:
 * 1. ~/.claude.json mcpServers (user-configured)
 * 2. Enabled plugin .mcp.json files
 */
export function readClaudeMcpServers(): UnifiedMcpServer[] {
  const servers: UnifiedMcpServer[] = [];
  const seenNames = new Set<string>();

  // 1. Read from ~/.claude.json
  const configServers = readFromClaudeJson();
  for (const s of configServers) {
    seenNames.add(s.name);
  }
  servers.push(...configServers);

  // 2. Read from enabled plugins
  servers.push(...readFromPlugins(seenNames));

  return servers;
}

function readFromClaudeJson(): UnifiedMcpServer[] {
  const servers: UnifiedMcpServer[] = [];

  if (!existsSync(PATHS.claudeJson)) {
    console.log("  ⚠ ~/.claude.json not found");
    return servers;
  }

  try {
    const raw = JSON.parse(readFileSync(PATHS.claudeJson, "utf-8"));
    const mcpServers: Record<string, ClaudeMcpServer> = raw.mcpServers ?? {};

    for (const [name, config] of Object.entries(mcpServers)) {
      servers.push(toUnified(name, config, "claude-config"));
    }
  } catch {
    console.log("  ⚠ Failed to parse ~/.claude.json");
  }

  return servers;
}

function readFromPlugins(seenNames: Set<string>): UnifiedMcpServer[] {
  const servers: UnifiedMcpServer[] = [];

  // Read enabled plugins from settings.json
  if (!existsSync(PATHS.claudeSettings)) {
    return servers;
  }

  let enabledPlugins: Record<string, boolean> = {};
  try {
    const settings: ClaudeSettings = JSON.parse(readFileSync(PATHS.claudeSettings, "utf-8"));
    enabledPlugins = settings.enabledPlugins ?? {};
  } catch {
    return servers;
  }

  // Walk plugin cache to find .mcp.json files for enabled plugins
  if (!existsSync(PATHS.claudePluginCache)) {
    return servers;
  }

  const marketplaces = readdirSync(PATHS.claudePluginCache, {
    withFileTypes: true,
  }).filter((d) => d.isDirectory());

  for (const marketplace of marketplaces) {
    const marketplacePath = join(PATHS.claudePluginCache, marketplace.name);
    const plugins = readdirSync(marketplacePath, { withFileTypes: true }).filter((d) =>
      d.isDirectory()
    );

    for (const plugin of plugins) {
      // Check if this plugin is enabled
      const pluginKey = `${plugin.name}@${marketplace.name}`;
      const isEnabled = enabledPlugins[pluginKey] === true;

      if (!isEnabled) continue;

      // Find the latest version directory with .mcp.json
      const pluginPath = join(marketplacePath, plugin.name);
      const versions = readdirSync(pluginPath, { withFileTypes: true }).filter((d) =>
        d.isDirectory()
      );

      for (const version of versions) {
        const versionDir = join(pluginPath, version.name);
        let found = false;

        // Source 1: .mcp.json (most plugins)
        const mcpJsonPath = join(versionDir, ".mcp.json");
        if (existsSync(mcpJsonPath)) {
          try {
            const raw: PluginMcpJson = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
            const mcpEntries = parseMcpJson(raw);
            addPluginServers(servers, seenNames, mcpEntries);
            found = true;
          } catch {
            // skip malformed .mcp.json
          }
        }

        // Source 2: .claude-plugin/marketplace.json → mcpServers (e.g. qmd)
        if (!found) {
          const marketplaceJsonPath = join(versionDir, ".claude-plugin", "marketplace.json");
          if (existsSync(marketplaceJsonPath)) {
            try {
              const raw = JSON.parse(readFileSync(marketplaceJsonPath, "utf-8"));
              const plugins: unknown[] = raw.plugins ?? [];
              for (const p of plugins) {
                if (typeof p === "object" && p !== null && "mcpServers" in p) {
                  const mcpEntries = (p as { mcpServers: Record<string, ClaudeMcpServer> })
                    .mcpServers;
                  addPluginServers(servers, seenNames, mcpEntries);
                  found = true;
                }
              }
            } catch {
              // skip malformed marketplace.json
            }
          }
        }

        if (found) break; // only use first version found
      }
    }
  }

  return servers;
}

function addPluginServers(
  servers: UnifiedMcpServer[],
  seenNames: Set<string>,
  mcpEntries: Record<string, ClaudeMcpServer>
) {
  for (const [name, config] of Object.entries(mcpEntries)) {
    if (!seenNames.has(name)) {
      seenNames.add(name);
      servers.push(toUnified(name, config, "claude-plugin"));
    }
  }
}

/** Plugin .mcp.json has two formats: flat or nested under mcpServers */
function parseMcpJson(raw: PluginMcpJson): Record<string, ClaudeMcpServer> {
  if ("mcpServers" in raw && typeof raw.mcpServers === "object") {
    return raw.mcpServers as Record<string, ClaudeMcpServer>;
  }
  // Flat format: { "name": { command, args } }
  // Filter out non-server keys
  const result: Record<string, ClaudeMcpServer> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (
      typeof val === "object" &&
      val !== null &&
      ("command" in val || "type" in val || "url" in val)
    ) {
      result[key] = val as ClaudeMcpServer;
    }
  }
  return result;
}

function toUnified(
  name: string,
  config: ClaudeMcpServer,
  source: "claude-config" | "claude-plugin"
): UnifiedMcpServer {
  let transport: UnifiedMcpServer["transport"] = "stdio";

  if (config.type === "http") transport = "http";
  else if (config.type === "sse") transport = "sse";
  else if (config.url && !config.command) transport = "http";

  return {
    name,
    transport,
    source,
    command: config.command,
    args: config.args,
    env: config.env,
    url: config.url,
    headers: config.headers,
    oauth: config.oauth,
  };
}
