import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { convertEnvVarSyntax } from "../env.js";
import { writeJsonFormat } from "./json-format.js";
import type { UnifiedMcpServer } from "../types.js";

const DEFAULT_WINDSURF_HOME = join(homedir(), ".codeium", "windsurf");

export function resolveWindsurfMcpConfigPath(windsurfHome?: string): string {
  const dir = resolve(windsurfHome ?? DEFAULT_WINDSURF_HOME);
  return join(dir, "mcp_config.json");
}

export function writeToWindsurf(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  windsurfHome?: string
): { added: string[]; skipped: string[]; configPath: string } {
  const configPath = resolveWindsurfMcpConfigPath(windsurfHome);
  const result = writeJsonFormat(servers, dryRun, {
    configPath,
    targetName: "Windsurf",
    converter: toWindsurfServer,
  });
  return { ...result, configPath };
}

function toWindsurfServer(server: UnifiedMcpServer): Record<string, unknown> | null {
  if (server.transport === "stdio" && server.command) {
    return {
      command: server.command,
      ...(server.args && { args: server.args }),
      ...(server.env && { env: convertEnvVarSyntax(server.env, (v) => `\${env:${v}}`) }),
    };
  }

  if ((server.transport === "http" || server.transport === "sse") && server.url) {
    return {
      serverUrl: server.url,
      ...(server.headers && { headers: server.headers }),
    };
  }

  return null;
}
