import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToGemini } from "../writers/gemini.js";
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

describe("writeToGemini", () => {
  it("converts stdio servers correctly", () => {
    let written = "";
    const geminiDir = PATHS.geminiSettings.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === geminiDir) return true;
      if (String(p) === PATHS.geminiSettings) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ theme: "Dracula" }));
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

    const result = writeToGemini(servers, false);

    expect(result.added).toEqual(["context7"]);
    const parsed = JSON.parse(written);
    expect(parsed.theme).toBe("Dracula"); // preserves existing
    expect(parsed.mcpServers.context7).toEqual({
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
    });
  });

  it("converts http servers to httpUrl", () => {
    let written = "";
    const geminiDir = PATHS.geminiSettings.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === geminiDir) return true;
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

    writeToGemini(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.sentry).toEqual({
      httpUrl: "https://mcp.sentry.dev/mcp",
    });
  });

  it("converts sse servers to url", () => {
    let written = "";
    const geminiDir = PATHS.geminiSettings.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === geminiDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "asana",
        transport: "sse",
        url: "https://mcp.asana.com/sse",
      }),
    ];

    writeToGemini(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.asana).toEqual({
      url: "https://mcp.asana.com/sse",
    });
  });

  it("skips existing servers", () => {
    const geminiDir = PATHS.geminiSettings.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === geminiDir) return true;
      if (String(p) === PATHS.geminiSettings) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ mcpServers: { context7: { command: "npx" } } })
    );

    const servers: UnifiedMcpServer[] = [makeServer({ name: "context7", command: "npx" })];

    const result = writeToGemini(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["context7 (already exists)"]);
  });

  it("does not write in dry-run mode", () => {
    const geminiDir = PATHS.geminiSettings.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === geminiDir) return true;
      return false;
    });

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    writeToGemini(servers, true);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when gemini directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    const result = writeToGemini(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
  });

  it("converts env var syntax from ${VAR} to $VAR", () => {
    let written = "";
    const geminiDir = PATHS.geminiSettings.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === geminiDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "tool",
        command: "npx",
        env: { TOKEN: "${MY_TOKEN}" },
      }),
    ];

    writeToGemini(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.tool.env.TOKEN).toBe("$MY_TOKEN");
  });
});
