import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAutoFix } from "../fix.js";
import * as doctor from "../doctor.js";
import * as reconcile from "../reconcile.js";
import * as validation from "../validation.js";
import * as reader from "../reader.js";
import type { UnifiedMcpServer } from "../types.js";

vi.mock("../doctor.js");
vi.mock("../reconcile.js");
vi.mock("../validation.js");
vi.mock("../reader.js");

const mockRunDoctor = vi.mocked(doctor.runDoctor);
const mockReconcileTargets = vi.mocked(reconcile.reconcileTargets);
const mockValidateServersForTargets = vi.mocked(validation.validateServersForTargets);
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

describe("runAutoFix", () => {
  it("doctor mode returns noop when no drift", () => {
    mockRunDoctor.mockReturnValue({
      sourceCount: 1,
      sourceNames: ["a"],
      hasDrift: false,
      hasErrors: false,
      results: [{ target: "gemini", status: "ok", missing: [], extra: [] }],
    });

    const result = runAutoFix({
      mode: "doctor",
      targets: ["gemini"],
    });

    expect(result.status).toBe("noop");
    expect(mockReconcileTargets).not.toHaveBeenCalled();
  });

  it("doctor mode triggers reconcile when drift exists", () => {
    mockRunDoctor.mockReturnValue({
      sourceCount: 1,
      sourceNames: ["a"],
      hasDrift: true,
      hasErrors: false,
      results: [{ target: "gemini", status: "drift", missing: ["a"], extra: [] }],
    });
    mockReconcileTargets.mockReturnValue({
      status: "reconciled",
      validation: { issues: [], errorCount: 0, warningCount: 0 },
      syncResults: [],
    });

    const result = runAutoFix({
      mode: "doctor",
      targets: ["gemini"],
      dryRun: true,
    });

    expect(result.status).toBe("reconciled");
    expect(mockReconcileTargets).toHaveBeenCalledWith(["gemini"], {
      dryRun: true,
      skipBackup: undefined,
      skipOAuth: undefined,
      codexHome: undefined,
    });
  });

  it("validate mode fails immediately when validation has errors", () => {
    mockReadClaudeMcpServers.mockReturnValue([makeServer("bad")]);
    mockValidateServersForTargets.mockReturnValue({
      issues: [
        {
          target: "gemini",
          server: "bad",
          severity: "error",
          code: "INVALID_STDIO_COMMAND_REQUIRED",
          message: "broken",
        },
      ],
      errorCount: 1,
      warningCount: 0,
    });

    const result = runAutoFix({
      mode: "validate",
      targets: ["gemini"],
    });

    expect(result.status).toBe("failed");
    expect(result.reason).toBe("validation");
    expect(mockReconcileTargets).not.toHaveBeenCalled();
  });

  it("validate mode returns noop when reconcile finds no drift", () => {
    mockReadClaudeMcpServers.mockReturnValue([makeServer("ok")]);
    mockValidateServersForTargets.mockReturnValue({
      issues: [],
      errorCount: 0,
      warningCount: 0,
    });
    mockReconcileTargets.mockReturnValue({
      status: "noop",
      validation: { issues: [], errorCount: 0, warningCount: 0 },
      syncResults: [],
    });

    const result = runAutoFix({
      mode: "validate",
      targets: ["gemini"],
    });

    expect(result.status).toBe("noop");
    expect(result.reconcile?.status).toBe("noop");
  });

  it("doctor mode maps reconcile validation failure to failed validation reason", () => {
    mockRunDoctor.mockReturnValue({
      sourceCount: 1,
      sourceNames: ["a"],
      hasDrift: true,
      hasErrors: false,
      results: [{ target: "gemini", status: "drift", missing: ["a"], extra: [] }],
    });
    mockReconcileTargets.mockReturnValue({
      status: "validation_failed",
      validation: { issues: [], errorCount: 1, warningCount: 0 },
      syncResults: [],
    });

    const result = runAutoFix({
      mode: "doctor",
      targets: ["gemini"],
    });

    expect(result.status).toBe("failed");
    expect(result.reason).toBe("validation");
  });
});
