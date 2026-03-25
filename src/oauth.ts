import type { UnifiedMcpServer } from "./types.js";

function hasText(value?: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isOAuthOnlyServer(server: UnifiedMcpServer): boolean {
  return Boolean(server.oauth && !hasText(server.command) && !hasText(server.url));
}
