import { describe, it, expect } from "vitest";
import { compareNameSets } from "../diff.js";

describe("compareNameSets", () => {
  it("returns shared / onlyInSource / onlyInTarget", () => {
    const result = compareNameSets(new Set(["a", "b", "c"]), new Set(["b", "c", "x"]));

    expect(result.shared).toEqual(["b", "c"]);
    expect(result.onlyInSource).toEqual(["a"]);
    expect(result.onlyInTarget).toEqual(["x"]);
  });
});
