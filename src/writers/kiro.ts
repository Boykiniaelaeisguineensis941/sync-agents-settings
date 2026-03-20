import { PATHS } from "../paths.js";
import type { UnifiedMcpServer } from "../types.js";
import { writeClaudeFormat } from "./claude-format.js";

export function writeToKiro(
  servers: UnifiedMcpServer[],
  dryRun: boolean
): { added: string[]; skipped: string[] } {
  return writeClaudeFormat(servers, dryRun, PATHS.kiroMcpConfig, "Kiro CLI");
}
