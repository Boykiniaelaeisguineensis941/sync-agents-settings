import { describe, it, expectTypeOf } from "vitest";
import { parseKnownJsonReport } from "../report-parser.js";

describe("parseJsonReport type narrowing", () => {
  it("narrows validate payload fields by command discriminator", () => {
    const parsed = parseKnownJsonReport(
      JSON.stringify({
        schemaVersion: 1,
        command: "validate",
        issues: [],
        errorCount: 0,
        warningCount: 0,
      })
    );

    if (!parsed.ok) return;
    if (parsed.data.command !== "validate") return;

    expectTypeOf(parsed.data.errorCount).toEqualTypeOf<number>();
    expectTypeOf(parsed.data.warningCount).toEqualTypeOf<number>();
    expectTypeOf(parsed.data.issues).toEqualTypeOf<unknown[]>();
  });
});
