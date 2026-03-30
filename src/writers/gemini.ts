import { PATHS } from "../paths.js";
import { convertEnvVarSyntax } from "../env.js";
import { writeJsonFormat } from "./json-format.js";
import type { UnifiedMcpServer } from "../types.js";

export function writeToGemini(
  servers: UnifiedMcpServer[],
  dryRun: boolean
): { added: string[]; skipped: string[] } {
  return writeJsonFormat(servers, dryRun, {
    configPath: PATHS.geminiSettings,
    targetName: "Gemini CLI",
    converter: toGeminiServer,
  });
}

function toGeminiServer(server: UnifiedMcpServer): Record<string, unknown> | null {
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
