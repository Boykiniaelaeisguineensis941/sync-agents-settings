import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readClaudeMcpServers } from "../reader.js";
import * as fs from "node:fs";
import { PATHS } from "../paths.js";

vi.mock("node:fs");

const mockFs = vi.mocked(fs);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readClaudeMcpServers", () => {
  it("reads stdio servers from .claude.json", () => {
    // .claude.json exists with MCP servers
    mockFs.existsSync.mockImplementation((p) => {
      if (p === PATHS.claudeJson) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === PATHS.claudeJson) {
        return JSON.stringify({
          mcpServers: {
            "my-tool": {
              command: "npx",
              args: ["-y", "my-tool-mcp"],
              env: { API_KEY: "test" },
            },
          },
        });
      }
      return "";
    });

    const servers = readClaudeMcpServers();

    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({
      name: "my-tool",
      transport: "stdio",
      source: "claude-config",
      command: "npx",
      args: ["-y", "my-tool-mcp"],
      env: { API_KEY: "test" },
    });
  });

  it("reads http servers from .claude.json", () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (p === PATHS.claudeJson) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === PATHS.claudeJson) {
        return JSON.stringify({
          mcpServers: {
            sentry: {
              type: "http",
              url: "https://mcp.sentry.dev/mcp",
            },
          },
        });
      }
      return "";
    });

    const servers = readClaudeMcpServers();

    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({
      name: "sentry",
      transport: "http",
      url: "https://mcp.sentry.dev/mcp",
    });
  });

  it("returns empty array when .claude.json does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers = readClaudeMcpServers();
    expect(servers).toHaveLength(0);
  });

  it("reads from enabled plugin .mcp.json files", () => {
    // Settings with enabled plugin
    mockFs.existsSync.mockImplementation((p) => {
      if (p === PATHS.claudeJson) return true;
      if (p === PATHS.claudeSettings) return true;
      if (p === PATHS.claudePluginCache) return true;
      if (String(p).endsWith(".mcp.json")) return true;
      return false;
    });

    mockFs.readFileSync.mockImplementation((p) => {
      if (p === PATHS.claudeJson) {
        return JSON.stringify({ mcpServers: {} });
      }
      if (p === PATHS.claudeSettings) {
        return JSON.stringify({
          enabledPlugins: { "context7@my-marketplace": true },
        });
      }
      if (String(p).endsWith(".mcp.json")) {
        return JSON.stringify({
          context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp"],
          },
        });
      }
      return "";
    });

    // Mock directory reading for plugin cache
    mockFs.readdirSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path === PATHS.claudePluginCache) {
        return [{ name: "my-marketplace", isDirectory: () => true }] as any;
      }
      if (path.endsWith("my-marketplace")) {
        return [{ name: "context7", isDirectory: () => true }] as any;
      }
      if (path.endsWith("context7")) {
        return [{ name: "1.0.0", isDirectory: () => true }] as any;
      }
      return [];
    });

    const servers = readClaudeMcpServers();
    const pluginServer = servers.find((s) => s.name === "context7");

    expect(pluginServer).toBeDefined();
    expect(pluginServer!.source).toBe("claude-plugin");
    expect(pluginServer!.command).toBe("npx");
  });

  it("handles nested mcpServers format in plugin .mcp.json", () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (p === PATHS.claudeJson) return true;
      if (p === PATHS.claudeSettings) return true;
      if (p === PATHS.claudePluginCache) return true;
      if (String(p).endsWith(".mcp.json")) return true;
      return false;
    });

    mockFs.readFileSync.mockImplementation((p) => {
      if (p === PATHS.claudeJson) return JSON.stringify({ mcpServers: {} });
      if (p === PATHS.claudeSettings) {
        return JSON.stringify({
          enabledPlugins: { "sentry@mkt": true },
        });
      }
      if (String(p).endsWith(".mcp.json")) {
        return JSON.stringify({
          mcpServers: {
            sentry: { type: "http", url: "https://mcp.sentry.dev/mcp" },
          },
        });
      }
      return "";
    });

    mockFs.readdirSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path === PATHS.claudePluginCache) {
        return [{ name: "mkt", isDirectory: () => true }] as any;
      }
      if (path.endsWith("mkt")) {
        return [{ name: "sentry", isDirectory: () => true }] as any;
      }
      if (path.endsWith("sentry")) {
        return [{ name: "1.0.0", isDirectory: () => true }] as any;
      }
      return [];
    });

    const servers = readClaudeMcpServers();
    const sentry = servers.find((s) => s.name === "sentry");
    expect(sentry).toBeDefined();
    expect(sentry!.transport).toBe("http");
    expect(sentry!.url).toBe("https://mcp.sentry.dev/mcp");
  });
});
