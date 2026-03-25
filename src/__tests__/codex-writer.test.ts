import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToCodex, resolveCodexConfigPath } from "../writers/codex.js";
import * as fs from "node:fs";
import TOML from "@iarna/toml";
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

describe("resolveCodexConfigPath", () => {
  it("defaults to ~/.codex/config.toml", () => {
    const path = resolveCodexConfigPath();
    expect(path).toMatch(/\.codex\/config\.toml$/);
  });

  it("uses custom codex home", () => {
    const path = resolveCodexConfigPath("/tmp/my-codex");
    expect(path).toBe("/tmp/my-codex/config.toml");
  });
});

describe("writeToCodex", () => {
  it("converts stdio servers to TOML", () => {
    let written = "";
    const configPath = resolveCodexConfigPath();
    const codexDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === codexDir) return true;
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

    const result = writeToCodex(servers, false);

    expect(result.added).toEqual(["context7"]);
    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers.context7.command).toBe("npx");
    expect(parsed.mcp_servers.context7.args).toEqual(["-y", "@upstash/context7-mcp"]);
  });

  it("converts http servers with url field", () => {
    let written = "";
    const configPath = resolveCodexConfigPath();
    const codexDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === codexDir) return true;
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

    writeToCodex(servers, false);

    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers.sentry.url).toBe("https://mcp.sentry.dev/mcp");
  });

  it("preserves env vars in TOML", () => {
    let written = "";
    const configPath = resolveCodexConfigPath();
    const codexDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === codexDir) return true;
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
        env: { API_KEY: "secret", URL: "https://example.com" },
      }),
    ];

    writeToCodex(servers, false);

    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers.n8n.env.API_KEY).toBe("secret");
    expect(parsed.mcp_servers.n8n.env.URL).toBe("https://example.com");
  });

  it("skips existing servers", () => {
    const configPath = resolveCodexConfigPath();
    const codexDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === codexDir) return true;
      if (String(p) === configPath) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue('[mcp_servers.context7]\ncommand = "npx"\n');

    const servers: UnifiedMcpServer[] = [makeServer({ name: "context7", command: "npx" })];

    const result = writeToCodex(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["context7 (already exists)"]);
  });

  it("does not write in dry-run mode", () => {
    const configPath = resolveCodexConfigPath();
    const codexDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === codexDir) return true;
      return false;
    });

    writeToCodex([makeServer({ name: "test", command: "node" })], true);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when codex directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    const result = writeToCodex(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
  });

  it("respects custom codex-home", () => {
    const result = writeToCodex(
      [makeServer({ name: "test", command: "node" })],
      true,
      "/tmp/custom-codex"
    );
    expect(result.configPath).toBe("/tmp/custom-codex/config.toml");
  });

  it("expands ${VAR:-default} in URLs to the fallback value", () => {
    let written = "";
    const configPath = resolveCodexConfigPath();
    const codexDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === codexDir) return true;
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

    writeToCodex(servers, false);

    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers.posthog.url).toBe("https://mcp.posthog.com/mcp");
  });

  it("expands ${VAR:-default} using env value when set", () => {
    let written = "";
    const configPath = resolveCodexConfigPath();
    const codexDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === codexDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const originalEnv = process.env.TEST_MCP_URL;
    process.env.TEST_MCP_URL = "https://custom.example.com/mcp";

    try {
      const servers: UnifiedMcpServer[] = [
        makeServer({
          name: "custom",
          transport: "http",
          url: "${TEST_MCP_URL:-https://default.example.com/mcp}",
        }),
      ];

      writeToCodex(servers, false);

      const parsed = TOML.parse(written) as any;
      expect(parsed.mcp_servers.custom.url).toBe("https://custom.example.com/mcp");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.TEST_MCP_URL;
      } else {
        process.env.TEST_MCP_URL = originalEnv;
      }
    }
  });

  it("expands ${VAR} without default to empty string when unset", () => {
    let written = "";
    const configPath = resolveCodexConfigPath();
    const codexDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === codexDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "bare",
        transport: "http",
        url: "https://example.com/${UNSET_VAR_12345}/path",
      }),
    ];

    writeToCodex(servers, false);

    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers.bare.url).toBe("https://example.com//path");
  });

  it("extracts bearer token env var from lowercase authorization header", () => {
    let written = "";
    const configPath = resolveCodexConfigPath();
    const codexDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === codexDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "auth-lowercase",
        transport: "http",
        url: "https://example.com/mcp",
        headers: {
          authorization: "Bearer ${MY_TOKEN}",
        },
      }),
    ];

    writeToCodex(servers, false);

    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers["auth-lowercase"].bearer_token_env_var).toBe("MY_TOKEN");
  });

  it("does not infer bearer token env var from literal authorization header", () => {
    let written = "";
    const configPath = resolveCodexConfigPath();
    const codexDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === codexDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "auth-literal",
        transport: "http",
        url: "https://example.com/mcp",
        headers: {
          Authorization: "Bearer static-token",
        },
      }),
    ];

    writeToCodex(servers, false);

    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers["auth-literal"].bearer_token_env_var).toBeUndefined();
  });
});
