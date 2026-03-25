import type { SyncTarget, UnifiedMcpServer } from "./types.js";
import { isOAuthOnlyServer } from "./oauth.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  target: SyncTarget;
  server: string;
  severity: ValidationSeverity;
  code:
    | "INVALID_STDIO_COMMAND_REQUIRED"
    | "INVALID_REMOTE_URL_REQUIRED"
    | "CODEX_UNSUPPORTED_HEADERS"
    | "OAUTH_MANUAL_SETUP_REQUIRED";
  message: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export interface ValidationOptions {
  skipOAuth?: boolean;
}

export function validateServersForTargets(
  servers: UnifiedMcpServer[],
  targets: SyncTarget[],
  options: ValidationOptions = {}
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const filtered = options.skipOAuth
    ? servers.filter((server) => !isOAuthOnlyServer(server))
    : servers;

  for (const target of targets) {
    for (const server of filtered) {
      if (isOAuthOnlyServer(server)) {
        issues.push({
          target,
          server: server.name,
          severity: "warning",
          code: "OAUTH_MANUAL_SETUP_REQUIRED",
          message: `${server.name} is OAuth-only and requires manual setup on ${target}.`,
        });
        continue;
      }

      if (server.transport === "stdio" && !hasText(server.command)) {
        issues.push({
          target,
          server: server.name,
          severity: "error",
          code: "INVALID_STDIO_COMMAND_REQUIRED",
          message: `${server.name} uses stdio transport but has no command.`,
        });
      }

      if ((server.transport === "http" || server.transport === "sse") && !hasText(server.url)) {
        issues.push({
          target,
          server: server.name,
          severity: "error",
          code: "INVALID_REMOTE_URL_REQUIRED",
          message: `${server.name} uses ${server.transport} transport but has no url.`,
        });
      }

      if (
        target === "codex" &&
        (server.transport === "http" || server.transport === "sse") &&
        hasUnsupportedCodexHeaders(server.headers)
      ) {
        issues.push({
          target,
          server: server.name,
          severity: "warning",
          code: "CODEX_UNSUPPORTED_HEADERS",
          message: `${server.name} has headers not supported by Codex (only Authorization is mapped).`,
        });
      }
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  return { issues, errorCount, warningCount };
}

function hasUnsupportedCodexHeaders(headers?: Record<string, string>): boolean {
  if (!headers) return false;
  return Object.keys(headers).some((key) => key.toLowerCase() !== "authorization");
}

function hasText(value?: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
