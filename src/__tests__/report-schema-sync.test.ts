import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import { checkReportSchemaUpToDate } from "../report-schema-sync.js";

vi.mock("node:fs");
const mockFs = vi.mocked(fs);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkReportSchemaUpToDate", () => {
  it("returns outdated when schema file is missing", () => {
    mockFs.existsSync.mockReturnValue(false);
    const result = checkReportSchemaUpToDate("docs/report-schema.md");
    expect(result.upToDate).toBe(false);
    expect(result.reason).toBe("missing");
  });

  it("returns outdated when content differs", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("# stale schema\n");
    const result = checkReportSchemaUpToDate("docs/report-schema.md");
    expect(result.upToDate).toBe(false);
    expect(result.reason).toBe("diff");
  });
});
