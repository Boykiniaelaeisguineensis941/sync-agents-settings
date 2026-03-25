import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRunAutoFix = vi.fn();

vi.mock("../fix.js", () => ({
  runAutoFix: mockRunAutoFix,
}));

describe("cli doctor --fix", () => {
  const originalArgv = process.argv.slice();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv.slice();
    vi.restoreAllMocks();
  });

  it("prints reason-specific message when auto-fix fails due to parse errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code ?? 0}`);
    }) as never);

    mockRunAutoFix.mockReturnValue({
      status: "failed",
      reason: "doctor_parse",
    });

    process.argv = ["node", "sync-agents", "doctor", "--fix", "--target", "gemini"];

    await expect(import("../cli.js")).rejects.toThrow("EXIT:2");
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(errorSpy).toHaveBeenCalledWith(
      "❌ Auto-fix failed: target config parse error. Fix target config and retry."
    );
  });
});
