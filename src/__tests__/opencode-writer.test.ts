import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToOpenCode } from "../writers/opencode.js";
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

describe("writeToOpenCode", () => {
  const openCodeDir = PATHS.openCodeConfig.replace(/\/[^/]+$/, "");

  it("converts stdio servers to local type with merged command array", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === openCodeDir) return true;
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

    const result = writeToOpenCode(servers, false);

    expect(result.added).toEqual(["context7"]);
    const parsed = JSON.parse(written);
    expect(parsed.mcp.context7.type).toBe("local");
    expect(parsed.mcp.context7.command).toEqual(["npx", "-y", "@upstash/context7-mcp"]);
  });

  it("converts env to environment field", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === openCodeDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "n8n",
        command: "npx",
        args: ["n8n-mcp"],
        env: { API_KEY: "secret" },
      }),
    ];

    writeToOpenCode(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.mcp.n8n.environment).toEqual({ API_KEY: "secret" });
    expect(parsed.mcp.n8n.env).toBeUndefined();
  });

  it("converts http servers to remote type", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === openCodeDir) return true;
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

    writeToOpenCode(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.mcp.sentry.type).toBe("remote");
    expect(parsed.mcp.sentry.url).toBe("https://mcp.sentry.dev/mcp");
  });

  it("preserves headers for http servers", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === openCodeDir) return true;
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

    writeToOpenCode(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.mcp.custom.headers).toEqual({ Authorization: "Bearer token123" });
  });

  it("skips existing servers", () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === openCodeDir) return true;
      if (String(p) === PATHS.openCodeConfig) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ mcp: { context7: { type: "local", command: ["npx"] } } })
    );

    const servers: UnifiedMcpServer[] = [makeServer({ name: "context7", command: "npx" })];

    const result = writeToOpenCode(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["context7 (already exists)"]);
  });

  it("does not write in dry-run mode", () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === openCodeDir) return true;
      return false;
    });

    writeToOpenCode([makeServer({ name: "test", command: "node" })], true);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when opencode directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    const result = writeToOpenCode(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
  });

  it("preserves existing config fields", () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === openCodeDir) return true;
      if (String(p) === PATHS.openCodeConfig) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ model: "anthropic/claude-sonnet-4-5", mcp: {} })
    );
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    writeToOpenCode(servers, false);

    const parsed = JSON.parse(written);
    expect(parsed.model).toBe("anthropic/claude-sonnet-4-5");
    expect(parsed.mcp.test).toBeDefined();
  });
});
