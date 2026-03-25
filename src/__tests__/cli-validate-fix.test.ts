import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockReadClaudeMcpServers = vi.fn();
const mockValidateServersForTargets = vi.fn();
const mockRunAutoFix = vi.fn();

vi.mock("../reader.js", () => ({
  readClaudeMcpServers: mockReadClaudeMcpServers,
}));

vi.mock("../validation.js", () => ({
  validateServersForTargets: mockValidateServersForTargets,
}));

vi.mock("../fix.js", () => ({
  runAutoFix: mockRunAutoFix,
}));

describe("cli validate --fix", () => {
  const originalArgv = process.argv.slice();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv.slice();
  });

  it("runs auto-fix when validation passes with zero issues", async () => {
    mockReadClaudeMcpServers.mockReturnValue([]);
    mockValidateServersForTargets.mockReturnValue({
      issues: [],
      errorCount: 0,
      warningCount: 0,
    });
    mockRunAutoFix.mockReturnValue({ status: "noop" });

    process.argv = ["node", "sync-agents", "validate", "--fix", "--target", "gemini"];

    await import("../cli.js");

    expect(mockRunAutoFix).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "validate",
        targets: ["gemini"],
      })
    );
  });

  it("does not print zero-summary noise when validate --fix has no issues", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockReadClaudeMcpServers.mockReturnValue([]);
    mockValidateServersForTargets.mockReturnValue({
      issues: [],
      errorCount: 0,
      warningCount: 0,
    });
    mockRunAutoFix.mockReturnValue({ status: "noop" });

    process.argv = ["node", "sync-agents", "validate", "--fix", "--target", "gemini"];

    await import("../cli.js");

    expect(logSpy).not.toHaveBeenCalledWith("Summary: 0 error(s), 0 warning(s)");
  });

  it("prints parse-specific message when validate --fix fails due to doctor parse errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code ?? 0}`);
    }) as never);

    mockReadClaudeMcpServers.mockReturnValue([]);
    mockValidateServersForTargets.mockReturnValue({
      issues: [],
      errorCount: 0,
      warningCount: 0,
    });
    mockRunAutoFix.mockReturnValue({ status: "failed", reason: "doctor_parse" });

    process.argv = ["node", "sync-agents", "validate", "--fix", "--target", "gemini"];

    await expect(import("../cli.js")).rejects.toThrow("EXIT:2");
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(errorSpy).toHaveBeenCalledWith(
      "❌ Auto-fix failed: target config parse error. Fix target config and retry."
    );
  });

  it("prints validation-specific message when validate --fix fails due to validation errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code ?? 0}`);
    }) as never);

    mockReadClaudeMcpServers.mockReturnValue([]);
    mockValidateServersForTargets.mockReturnValue({
      issues: [],
      errorCount: 0,
      warningCount: 0,
    });
    mockRunAutoFix.mockReturnValue({ status: "failed", reason: "validation" });

    process.argv = ["node", "sync-agents", "validate", "--fix", "--target", "gemini"];

    await expect(import("../cli.js")).rejects.toThrow("EXIT:2");
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(errorSpy).toHaveBeenCalledWith("❌ Auto-fix failed: validation errors detected.");
  });
});
