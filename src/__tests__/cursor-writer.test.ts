import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToCursor } from "../writers/cursor.js";
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

describe("writeToCursor", () => {
  const cursorDir = PATHS.cursorMcpConfig.replace(/\/[^/]+$/, "");

  it("converts stdio servers with command/args/env", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === cursorDir) return true;
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
        env: { KEY: "value" },
      }),
    ];

    const result = writeToCursor(servers, false);

    expect(result.added).toEqual(["context7"]);
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.context7.command).toBe("npx");
    expect(parsed.mcpServers.context7.args).toEqual(["-y", "@upstash/context7-mcp"]);
    expect(parsed.mcpServers.context7.env).toEqual({ KEY: "value" });
  });

  it("converts http servers with url and expands env vars", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === cursorDir) return true;
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

    writeToCursor(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.posthog.url).toBe("https://mcp.posthog.com/mcp");
  });

  it("skips existing servers", () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === cursorDir) return true;
      if (String(p) === PATHS.cursorMcpConfig) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ mcpServers: { context7: { command: "npx" } } })
    );

    const servers: UnifiedMcpServer[] = [makeServer({ name: "context7", command: "npx" })];

    const result = writeToCursor(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["context7 (already exists)"]);
  });

  it("does not write in dry-run mode", () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === cursorDir) return true;
      return false;
    });

    writeToCursor([makeServer({ name: "test", command: "node" })], true);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when cursor directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    const result = writeToCursor(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
  });
});
