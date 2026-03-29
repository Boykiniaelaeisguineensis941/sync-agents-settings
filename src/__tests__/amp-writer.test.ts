import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToAmp, resolveAmpSettingsPath } from "../writers/amp.js";
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

describe("resolveAmpSettingsPath", () => {
  it("defaults to ~/.config/amp/settings.json", () => {
    const path = resolveAmpSettingsPath();
    expect(path).toMatch(/\.config\/amp\/settings\.json$/);
  });

  it("uses custom amp home", () => {
    const path = resolveAmpSettingsPath("/tmp/my-amp");
    expect(path).toBe("/tmp/my-amp/settings.json");
  });
});

describe("writeToAmp", () => {
  it("converts stdio servers with command/args/env under amp.mcpServers key", () => {
    let written = "";
    const ampDir = "/tmp/amp-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === ampDir) return true;
      if (String(p) === `${ampDir}/settings.json`) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ "editor.fontSize": 14 }));
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

    const result = writeToAmp(servers, false, "/tmp/amp-home");

    expect(result.configPath).toBe("/tmp/amp-home/settings.json");
    expect(result.added).toEqual(["context7"]);
    const parsed = JSON.parse(written);
    expect(parsed["editor.fontSize"]).toBe(14); // preserves existing settings
    expect(parsed["amp.mcpServers"].context7).toEqual({
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
      env: { KEY: "value" },
    });
  });

  it("converts http/sse servers to url with headers", () => {
    let written = "";
    const ampDir = "/tmp/amp-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === ampDir) return true;
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

    writeToAmp(servers, false, "/tmp/amp-home");

    const parsed = JSON.parse(written);
    expect(parsed["amp.mcpServers"].sentry).toEqual({
      url: "https://mcp.sentry.dev/mcp",
      headers: { Authorization: "Bearer abc" },
    });
  });

  it("converts sse servers to url", () => {
    let written = "";
    const ampDir = "/tmp/amp-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === ampDir) return true;
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

    writeToAmp(servers, false, "/tmp/amp-home");

    const parsed = JSON.parse(written);
    expect(parsed["amp.mcpServers"].linear).toEqual({
      url: "https://mcp.linear.app/sse",
    });
  });

  it("preserves ${VAR} env syntax (no conversion needed)", () => {
    let written = "";
    const ampDir = "/tmp/amp-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === ampDir) return true;
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

    writeToAmp(servers, false, "/tmp/amp-home");

    const parsed = JSON.parse(written);
    // Amp uses same ${VAR} syntax as Claude — no conversion
    expect(parsed["amp.mcpServers"].tool.env.TOKEN).toBe("${MY_TOKEN}");
  });

  it("skips existing servers", () => {
    const ampDir = "/tmp/amp-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === ampDir) return true;
      if (String(p) === `${ampDir}/settings.json`) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ "amp.mcpServers": { context7: { command: "npx" } } })
    );

    const servers: UnifiedMcpServer[] = [makeServer({ name: "context7", command: "npx" })];

    const result = writeToAmp(servers, false, "/tmp/amp-home");
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["context7 (already exists)"]);
  });

  it("does not write in dry-run mode", () => {
    const ampDir = "/tmp/amp-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === ampDir) return true;
      return false;
    });

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    writeToAmp(servers, true, "/tmp/amp-home");
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when amp directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    const result = writeToAmp(servers, false, "/tmp/missing-amp");
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
    expect(result.skipped[0]).toContain("Amp");
  });

  it("skips OAuth-only servers", () => {
    const ampDir = "/tmp/amp-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === ampDir) return true;
      return false;
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "oauth-only",
        transport: "http",
        oauth: { clientId: "abc" },
      }),
    ];

    const result = writeToAmp(servers, false, "/tmp/amp-home");
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("requires manual OAuth");
  });
});
