import { describe, it, expect } from "vitest";
import { renderReportRequiredFieldsMarkdown } from "../report-schema-renderer.js";

describe("renderReportRequiredFieldsMarkdown", () => {
  it("renders required fields section for all known commands", () => {
    const md = renderReportRequiredFieldsMarkdown();

    expect(md).toContain("## Required Fields (Generated)");
    expect(md).toContain("### `sync`");
    expect(md).toContain("### `diff`");
    expect(md).toContain("### `doctor`");
    expect(md).toContain("### `validate`");
    expect(md).toContain("### `reconcile`");
    expect(md).toContain("### `sync-instructions`");
    expect(md).toContain("- `targets`");
    expect(md).toContain("- `errorCount`");
    expect(md).toContain("- `warningCount`");
  });
});
