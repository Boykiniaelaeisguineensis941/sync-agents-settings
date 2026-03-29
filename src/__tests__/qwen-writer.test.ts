import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToQwen, resolveQwenSettingsPath } from "../writers/qwen.js";
import * as fs from "node:fs";
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

describe("resolveQwenSettingsPath", () => {
  it("defaults to ~/.qwen/settings.json", () => {
    const path = resolveQwenSettingsPath();
    expect(path).toMatch(/\.qwen\/settings\.json$/);
  });

  it("uses custom qwen home", () => {
    const path = resolveQwenSettingsPath("/tmp/my-qwen");
    expect(path).toBe("/tmp/my-qwen/settings.json");
  });
});

describe("writeToQwen", () => {
  it("converts stdio servers with command/args/env", () => {
    let written = "";
    const qwenDir = "/tmp/qwen-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === qwenDir) return true;
      if (String(p) === `${qwenDir}/settings.json`) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ theme: "monokai" }));
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

    const result = writeToQwen(servers, false, "/tmp/qwen-home");

    expect(result.configPath).toBe("/tmp/qwen-home/settings.json");
    expect(result.added).toEqual(["context7"]);
    const parsed = JSON.parse(written);
    expect(parsed.theme).toBe("monokai"); // preserves existing settings
    expect(parsed.mcpServers.context7).toEqual({
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
      env: { KEY: "value" },
    });
  });

  it("converts http servers to httpUrl", () => {
    let written = "";
    const qwenDir = "/tmp/qwen-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === qwenDir) return true;
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

    writeToQwen(servers, false, "/tmp/qwen-home");

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.sentry).toEqual({
      httpUrl: "https://mcp.sentry.dev/mcp",
    });
  });

  it("converts sse servers to url", () => {
    let written = "";
    const qwenDir = "/tmp/qwen-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === qwenDir) return true;
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
        headers: { Authorization: "Bearer abc" },
      }),
    ];

    writeToQwen(servers, false, "/tmp/qwen-home");

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.asana).toEqual({
      url: "https://mcp.asana.com/sse",
      headers: { Authorization: "Bearer abc" },
    });
  });

  it("skips existing servers", () => {
    const qwenDir = "/tmp/qwen-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === qwenDir) return true;
      if (String(p) === `${qwenDir}/settings.json`) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ mcpServers: { context7: { command: "npx" } } })
    );

    const servers: UnifiedMcpServer[] = [makeServer({ name: "context7", command: "npx" })];

    const result = writeToQwen(servers, false, "/tmp/qwen-home");
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["context7 (already exists)"]);
  });

  it("does not write in dry-run mode", () => {
    const qwenDir = "/tmp/qwen-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === qwenDir) return true;
      return false;
    });

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    writeToQwen(servers, true, "/tmp/qwen-home");
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when qwen directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    const result = writeToQwen(servers, false, "/tmp/missing-qwen");
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
    expect(result.skipped[0]).toContain("Qwen Code");
  });

  it("converts env var syntax from ${VAR} to $VAR", () => {
    let written = "";
    const qwenDir = "/tmp/qwen-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === qwenDir) return true;
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

    writeToQwen(servers, false, "/tmp/qwen-home");

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.tool.env.TOKEN).toBe("$MY_TOKEN");
  });

  it("skips OAuth-only servers", () => {
    const qwenDir = "/tmp/qwen-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === qwenDir) return true;
      return false;
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "oauth-only",
        transport: "http",
        oauth: { clientId: "abc" },
        // no command, no url
      }),
    ];

    const result = writeToQwen(servers, false, "/tmp/qwen-home");
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("requires manual OAuth");
  });
});
