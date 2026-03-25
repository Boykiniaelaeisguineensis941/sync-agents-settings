import { describe, it, expect } from "vitest";
import { validateServersForTargets } from "../validation.js";
import type { UnifiedMcpServer } from "../types.js";

function makeServer(overrides: Partial<UnifiedMcpServer> & { name: string }): UnifiedMcpServer {
  return {
    source: "claude-config",
    transport: "stdio",
    command: "npx",
    ...overrides,
  };
}

describe("validateServersForTargets", () => {
  it("reports error when stdio server has no command", () => {
    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "broken-stdio",
        transport: "stdio",
        command: undefined,
      }),
    ];

    const report = validateServersForTargets(servers, ["gemini"]);
    expect(report.errorCount).toBe(1);
    expect(report.issues[0]).toMatchObject({
      target: "gemini",
      server: "broken-stdio",
      severity: "error",
      code: "INVALID_STDIO_COMMAND_REQUIRED",
    });
  });

  it("reports error when remote server has no url", () => {
    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "broken-http",
        transport: "http",
        url: undefined,
      }),
    ];

    const report = validateServersForTargets(servers, ["codex"]);
    expect(report.errorCount).toBe(1);
    expect(report.issues[0]).toMatchObject({
      target: "codex",
      server: "broken-http",
      severity: "error",
      code: "INVALID_REMOTE_URL_REQUIRED",
    });
  });

  it("reports warning for codex when headers are unsupported", () => {
    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "header-server",
        transport: "http",
        url: "https://example.com/mcp",
        headers: {
          Authorization: "Bearer ${TOKEN}",
          "X-Trace": "abc",
        },
      }),
    ];

    const report = validateServersForTargets(servers, ["codex"]);
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(1);
    expect(report.issues[0]).toMatchObject({
      target: "codex",
      server: "header-server",
      severity: "warning",
      code: "CODEX_UNSUPPORTED_HEADERS",
    });
  });

  it("can skip oauth-only servers from validation", () => {
    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "oauth-only",
        transport: "http",
        command: undefined,
        url: undefined,
        oauth: { clientId: "abc" },
      }),
    ];

    const report = validateServersForTargets(servers, ["gemini"], { skipOAuth: true });
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.issues).toHaveLength(0);
  });

  it("treats blank command/url as missing values", () => {
    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "blank-stdio",
        transport: "stdio",
        command: "   ",
      }),
      makeServer({
        name: "blank-http",
        transport: "http",
        command: undefined,
        url: "   ",
      }),
    ];

    const report = validateServersForTargets(servers, ["gemini"]);
    expect(report.errorCount).toBe(2);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          server: "blank-stdio",
          code: "INVALID_STDIO_COMMAND_REQUIRED",
          severity: "error",
        }),
        expect.objectContaining({
          server: "blank-http",
          code: "INVALID_REMOTE_URL_REQUIRED",
          severity: "error",
        }),
      ])
    );
  });

  it("reports only oauth manual setup warning for oauth-only servers", () => {
    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "oauth-only",
        transport: "http",
        command: undefined,
        url: undefined,
        oauth: { clientId: "abc" },
      }),
    ];

    const report = validateServersForTargets(servers, ["codex"]);
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(1);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      target: "codex",
      server: "oauth-only",
      severity: "warning",
      code: "OAUTH_MANUAL_SETUP_REQUIRED",
    });
  });
});
