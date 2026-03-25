import { describe, it, expect } from "vitest";
import { parseJsonReport, parseKnownJsonReport } from "../report-parser.js";

describe("parseJsonReport", () => {
  it("parses valid v1 report", () => {
    const input = JSON.stringify({
      schemaVersion: 1,
      command: "validate",
      issues: [],
      errorCount: 0,
      warningCount: 0,
    });

    const result = parseJsonReport(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.schemaVersion).toBe(1);
      expect(result.data.command).toBe("validate");
    }
  });

  it("rejects report without schemaVersion", () => {
    const input = JSON.stringify({ command: "validate" });
    const result = parseJsonReport(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_SCHEMA_VERSION");
    }
  });

  it("rejects unsupported schemaVersion", () => {
    const input = JSON.stringify({ schemaVersion: 2, command: "validate" });
    const result = parseJsonReport(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_SCHEMA_VERSION");
    }
  });

  it("rejects invalid json", () => {
    const result = parseJsonReport("{not-json}");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_JSON");
    }
  });

  it("rejects validate report without required counters", () => {
    const input = JSON.stringify({
      schemaVersion: 1,
      command: "validate",
      issues: [],
      // errorCount / warningCount missing
    });
    const result = parseJsonReport(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_COMMAND_PAYLOAD");
    }
  });

  it("rejects doctor report without hasDrift/hasErrors", () => {
    const input = JSON.stringify({
      schemaVersion: 1,
      command: "doctor",
      resultCount: 1,
      results: [],
    });
    const result = parseJsonReport(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_COMMAND_PAYLOAD");
    }
  });

  it("rejects sync report without targets array", () => {
    const input = JSON.stringify({
      schemaVersion: 1,
      command: "sync",
      sourceCount: 1,
      dryRun: true,
      skipOAuth: false,
    });
    const result = parseJsonReport(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_COMMAND_PAYLOAD");
    }
  });
});

describe("parseKnownJsonReport", () => {
  it("accepts known command payload", () => {
    const input = JSON.stringify({
      schemaVersion: 1,
      command: "validate",
      issues: [],
      errorCount: 0,
      warningCount: 0,
    });
    const result = parseKnownJsonReport(input);
    expect(result.ok).toBe(true);
  });

  it("rejects unknown command payload", () => {
    const input = JSON.stringify({
      schemaVersion: 1,
      command: "future-command",
    });
    const result = parseKnownJsonReport(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_COMMAND");
    }
  });
});
