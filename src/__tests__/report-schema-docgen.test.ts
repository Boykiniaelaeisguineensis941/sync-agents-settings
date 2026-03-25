import { describe, it, expect } from "vitest";
import { generateReportSchemaDocument } from "../report-schema-renderer.js";

describe("generateReportSchemaDocument", () => {
  it("generates full report schema markdown with generated section", () => {
    const md = generateReportSchemaDocument();

    expect(md).toContain("# Report Schema");
    expect(md).toContain("schemaVersion");
    expect(md).toContain("## Required Fields (Generated)");
    expect(md).toContain("### `sync`");
    expect(md).toContain("### `sync-instructions`");
  });
});
