import { describe, it, expect, vi, beforeEach } from "vitest";
import { dirname } from "node:path";
import * as fs from "node:fs";
import { PATHS } from "../paths.js";
import { runDoctor } from "../doctor.js";
import * as reader from "../reader.js";
import type { UnifiedMcpServer } from "../types.js";

vi.mock("node:fs");
vi.mock("../reader.js");

const mockFs = vi.mocked(fs);
const mockReadClaudeMcpServers = vi.mocked(reader.readClaudeMcpServers);

function makeServer(name: string): UnifiedMcpServer {
  return {
    name,
    source: "claude-config",
    transport: "stdio",
    command: "npx",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runDoctor", () => {
  it("detects missing and extra servers in gemini", () => {
    const geminiDir = dirname(PATHS.geminiSettings);

    mockReadClaudeMcpServers.mockReturnValue([makeServer("context7"), makeServer("sentry")]);
    mockFs.existsSync.mockImplementation((path) => {
      if (String(path) === geminiDir) return true;
      if (String(path) === PATHS.geminiSettings) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((path) => {
      if (String(path) === PATHS.geminiSettings) {
        return JSON.stringify({
          mcpServers: {
            context7: { command: "npx" },
            rogue: { command: "node" },
          },
        });
      }
      return "";
    });

    const report = runDoctor(["gemini"]);

    expect(report.hasDrift).toBe(true);
    expect(report.hasErrors).toBe(false);
    expect(report.results[0]).toMatchObject({
      target: "gemini",
      status: "drift",
      missing: ["sentry"],
      extra: ["rogue"],
    });
  });

  it("marks target as unavailable when target directory does not exist", () => {
    const geminiDir = dirname(PATHS.geminiSettings);

    mockReadClaudeMcpServers.mockReturnValue([makeServer("context7")]);
    mockFs.existsSync.mockImplementation((path) => String(path) !== geminiDir);

    const report = runDoctor(["gemini"]);

    expect(report.hasDrift).toBe(false);
    expect(report.hasErrors).toBe(false);
    expect(report.results[0].status).toBe("unavailable");
  });

  it("supports custom codex home path", () => {
    const codexHome = "/tmp/custom-codex";
    const codexConfigPath = "/tmp/custom-codex/config.toml";

    mockReadClaudeMcpServers.mockReturnValue([makeServer("context7")]);
    mockFs.existsSync.mockImplementation((path) => {
      if (String(path) === codexHome) return true;
      if (String(path) === codexConfigPath) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((path) => {
      if (String(path) === codexConfigPath) {
        return `
[mcp_servers.context7]
command = "npx"
`;
      }
      return "";
    });

    const report = runDoctor(["codex"], { codexHome });

    expect(report.hasDrift).toBe(false);
    expect(report.hasErrors).toBe(false);
    expect(report.results[0].status).toBe("ok");
  });

  it("marks malformed config as error", () => {
    const geminiDir = dirname(PATHS.geminiSettings);

    mockReadClaudeMcpServers.mockReturnValue([makeServer("context7")]);
    mockFs.existsSync.mockImplementation((path) => {
      if (String(path) === geminiDir) return true;
      if (String(path) === PATHS.geminiSettings) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((path) => {
      if (String(path) === PATHS.geminiSettings) {
        return "{ this is invalid json";
      }
      return "";
    });

    const report = runDoctor(["gemini"]);

    expect(report.hasErrors).toBe(true);
    expect(report.results[0].status).toBe("error");
  });

  it("skipOAuth keeps non-oauth-only servers in source set", () => {
    const geminiDir = dirname(PATHS.geminiSettings);
    mockReadClaudeMcpServers.mockReturnValue([
      {
        ...makeServer("oauth-with-command"),
        oauth: { clientId: "abc" },
      },
    ]);
    mockFs.existsSync.mockImplementation((path) => String(path) !== geminiDir);

    const report = runDoctor(["gemini"], { skipOAuth: true });

    expect(report.sourceNames).toEqual(["oauth-with-command"]);
  });
});
