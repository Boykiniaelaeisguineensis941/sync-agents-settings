import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToKiro } from "../writers/kiro.js";
import * as fs from "node:fs";
import { PATHS } from "../paths.js";
import type { UnifiedMcpServer } from "../types.js";

vi.mock("node:fs");
const mockFs = vi.mocked(fs);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeServer(overrides: Partial<UnifiedMcpServer> & { name: string }): UnifiedMcpServer {
  return {
    transport: "stdio",
    source: "claude-config",
    ...overrides,
  };
}

describe("writeToKiro", () => {
  const kiroDir = PATHS.kiroMcpConfig.replace(/\/[^/]+$/, "");

  it("converts stdio servers with command/args/env", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === kiroDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "context7",
        command: "npx",
        args: ["-y", "@upstash/context7-mcp"],
      }),
    ];

    const result = writeToKiro(servers, false);

    expect(result.added).toEqual(["context7"]);
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.context7.command).toBe("npx");
    expect(parsed.mcpServers.context7.args).toEqual(["-y", "@upstash/context7-mcp"]);
  });

  it("converts http servers with url", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === kiroDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "sentry",
        transport: "http",
        url: "https://mcp.sentry.dev/mcp",
      }),
    ];

    writeToKiro(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.sentry.url).toBe("https://mcp.sentry.dev/mcp");
  });

  it("expands ${VAR:-default} in URLs", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === kiroDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "posthog",
        transport: "http",
        url: "${POSTHOG_MCP_URL:-https://mcp.posthog.com/mcp}",
      }),
    ];

    writeToKiro(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.posthog.url).toBe("https://mcp.posthog.com/mcp");
  });

  it("preserves headers for http servers", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === kiroDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "custom",
        transport: "http",
        url: "https://mcp.example.com",
        headers: { Authorization: "Bearer token123" },
      }),
    ];

    writeToKiro(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.custom.headers).toEqual({ Authorization: "Bearer token123" });
  });

  it("skips existing servers", () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === kiroDir) return true;
      if (String(p) === PATHS.kiroMcpConfig) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ mcpServers: { context7: { command: "npx" } } })
    );

    const servers: UnifiedMcpServer[] = [makeServer({ name: "context7", command: "npx" })];

    const result = writeToKiro(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["context7 (already exists)"]);
  });

  it("does not write in dry-run mode", () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === kiroDir) return true;
      return false;
    });

    writeToKiro([makeServer({ name: "test", command: "node" })], true);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when kiro directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    const result = writeToKiro(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
  });
});
