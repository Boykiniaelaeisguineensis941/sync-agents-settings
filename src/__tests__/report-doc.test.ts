import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("report schema documentation", () => {
  it("documents schemaVersion and all report-enabled commands", () => {
    const path = resolve(process.cwd(), "docs", "report-schema.md");
    expect(existsSync(path)).toBe(true);

    const content = readFileSync(path, "utf-8");
    expect(content).toContain("schemaVersion");
    expect(content).toContain("sync --report json");
    expect(content).toContain("diff --report json");
    expect(content).toContain("doctor --report json");
    expect(content).toContain("validate --report json");
    expect(content).toContain("reconcile --report json");
    expect(content).toContain("sync-instructions --report json");
  });
});
