import { describe, expect, it } from "vitest";
import { contrast, onAccent } from "./accent";

describe("contrast", () => {
  it("is 21 for black on white and 1 for a color on itself", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#1f6fe5", "#1f6fe5")).toBe(1);
  });
});

describe("onAccent", () => {
  it("puts white on dark accents and near-black on light ones", () => {
    expect(onAccent("#1f6fe5")).toBe("#ffffff");
    expect(onAccent("#6aa7ff")).toBe("#111111");
  });
});
