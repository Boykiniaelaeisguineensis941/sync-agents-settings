import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToWindsurf, resolveWindsurfMcpConfigPath } from "../writers/windsurf.js";
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

describe("resolveWindsurfMcpConfigPath", () => {
  it("defaults to ~/.codeium/windsurf/mcp_config.json", () => {
    const path = resolveWindsurfMcpConfigPath();
    expect(path).toMatch(/\.codeium\/windsurf\/mcp_config\.json$/);
  });

  it("uses custom windsurf home", () => {
    const path = resolveWindsurfMcpConfigPath("/tmp/my-windsurf");
    expect(path).toBe("/tmp/my-windsurf/mcp_config.json");
  });
});

describe("writeToWindsurf", () => {
  it("converts stdio servers with command/args/env", () => {
    let written = "";
    const wsDir = "/tmp/ws-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === wsDir) return true;
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

    const result = writeToWindsurf(servers, false, "/tmp/ws-home");

    expect(result.configPath).toBe("/tmp/ws-home/mcp_config.json");
    expect(result.added).toEqual(["context7"]);
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.context7).toEqual({
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
      env: { KEY: "value" },
    });
  });

  it("converts http servers to serverUrl", () => {
    let written = "";
    const wsDir = "/tmp/ws-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === wsDir) return true;
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
        headers: { Authorization: "Bearer abc" },
      }),
    ];

    writeToWindsurf(servers, false, "/tmp/ws-home");

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.sentry).toEqual({
      serverUrl: "https://mcp.sentry.dev/mcp",
      headers: { Authorization: "Bearer abc" },
    });
  });

  it("converts sse servers to serverUrl", () => {
    let written = "";
    const wsDir = "/tmp/ws-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === wsDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "linear",
        transport: "sse",
        url: "https://mcp.linear.app/sse",
      }),
    ];

    writeToWindsurf(servers, false, "/tmp/ws-home");

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.linear).toEqual({
      serverUrl: "https://mcp.linear.app/sse",
    });
  });

  it("converts env var syntax from ${VAR} to ${env:VAR}", () => {
    let written = "";
    const wsDir = "/tmp/ws-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === wsDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "tool",
        command: "npx",
        env: { TOKEN: "${MY_TOKEN}", PLAIN: "literal-value" },
      }),
    ];

    writeToWindsurf(servers, false, "/tmp/ws-home");

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.tool.env.TOKEN).toBe("${env:MY_TOKEN}");
    expect(parsed.mcpServers.tool.env.PLAIN).toBe("literal-value");
  });

  it("preserves existing settings", () => {
    let written = "";
    const wsDir = "/tmp/ws-home";
    const configPath = "/tmp/ws-home/mcp_config.json";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === wsDir) return true;
      if (String(p) === configPath) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ mcpServers: { existing: { command: "node" } } })
    );
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [makeServer({ name: "new-tool", command: "npx" })];

    writeToWindsurf(servers, false, "/tmp/ws-home");

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.existing).toEqual({ command: "node" });
    expect(parsed.mcpServers["new-tool"]).toEqual({ command: "npx" });
  });

  it("skips existing servers", () => {
    const wsDir = "/tmp/ws-home";
    const configPath = "/tmp/ws-home/mcp_config.json";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === wsDir) return true;
      if (String(p) === configPath) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ mcpServers: { context7: { command: "npx" } } })
    );

    const result = writeToWindsurf(
      [makeServer({ name: "context7", command: "npx" })],
      false,
      "/tmp/ws-home"
    );
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["context7 (already exists)"]);
  });

  it("does not write in dry-run mode", () => {
    const wsDir = "/tmp/ws-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === wsDir) return true;
      return false;
    });

    writeToWindsurf([makeServer({ name: "test", command: "node" })], true, "/tmp/ws-home");
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when windsurf directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = writeToWindsurf(
      [makeServer({ name: "test", command: "node" })],
      false,
      "/tmp/missing-ws"
    );
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
    expect(result.skipped[0]).toContain("Windsurf");
  });

  it("skips OAuth-only servers", () => {
    const wsDir = "/tmp/ws-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === wsDir) return true;
      return false;
    });

    const result = writeToWindsurf(
      [makeServer({ name: "oauth-only", transport: "http", oauth: { clientId: "abc" } })],
      false,
      "/tmp/ws-home"
    );
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("requires manual OAuth");
  });
});
