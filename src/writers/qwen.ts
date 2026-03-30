import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { convertEnvVarSyntax } from "../env.js";
import { writeJsonFormat } from "./json-format.js";
import type { UnifiedMcpServer } from "../types.js";

const DEFAULT_QWEN_HOME = join(homedir(), ".qwen");

export function resolveQwenSettingsPath(qwenHome?: string): string {
  const dir = resolve(qwenHome ?? DEFAULT_QWEN_HOME);
  return join(dir, "settings.json");
}

export function writeToQwen(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  qwenHome?: string
): { added: string[]; skipped: string[]; configPath: string } {
  const configPath = resolveQwenSettingsPath(qwenHome);
  const result = writeJsonFormat(servers, dryRun, {
    configPath,
    targetName: "Qwen Code",
    converter: toQwenServer,
  });
  return { ...result, configPath };
}

function toQwenServer(server: UnifiedMcpServer): Record<string, unknown> | null {
  if (server.transport === "stdio" && server.command) {
    return {
      command: server.command,
      ...(server.args && { args: server.args }),
      ...(server.env && { env: convertEnvVarSyntax(server.env, (v) => `$${v}`) }),
    };
  }

  if (server.transport === "http" && server.url) {
    return {
      httpUrl: server.url,
      ...(server.headers && { headers: server.headers }),
    };
  }

  if (server.transport === "sse" && server.url) {
    return {
      url: server.url,
      ...(server.headers && { headers: server.headers }),
    };
  }

  return null;
}
