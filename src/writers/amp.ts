import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { writeJsonFormat } from "./json-format.js";
import type { UnifiedMcpServer } from "../types.js";

const DEFAULT_AMP_HOME = join(homedir(), ".config", "amp");

export function resolveAmpSettingsPath(ampHome?: string): string {
  const dir = resolve(ampHome ?? DEFAULT_AMP_HOME);
  return join(dir, "settings.json");
}

export function writeToAmp(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  ampHome?: string
): { added: string[]; skipped: string[]; configPath: string } {
  const configPath = resolveAmpSettingsPath(ampHome);
  const result = writeJsonFormat(servers, dryRun, {
    configPath,
    targetName: "Amp",
    jsonKey: "amp.mcpServers",
    converter: toAmpServer,
  });
  return { ...result, configPath };
}

function toAmpServer(server: UnifiedMcpServer): Record<string, unknown> | null {
  if (server.transport === "stdio" && server.command) {
    return {
      command: server.command,
      ...(server.args && { args: server.args }),
      ...(server.env && { env: server.env }),
    };
  }

  if ((server.transport === "http" || server.transport === "sse") && server.url) {
    return {
      url: server.url,
      ...(server.headers && { headers: server.headers }),
    };
  }

  return null;
}
