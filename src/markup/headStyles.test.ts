import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEAD_STYLES,
  clampHeadShape,
  headIcon,
  matchingStyle,
  storedShape,
} from "./headStyles";
import { STANDARD_HEAD } from "./model/types";

describe("head styles", () => {
  it("keeps shapes within the limits", () => {
    expect(clampHeadShape({ width: 50, length: 125 })).toEqual({ width: 50, length: 125 });
    expect(clampHeadShape({ width: 5, length: 1000 })).toEqual({ width: 25, length: 100 });
    expect(clampHeadShape({ width: 1000, length: 1 })).toEqual({ width: 200, length: 50 });
    // Neither side more than 4 times the other.
    expect(clampHeadShape({ width: 30, length: 250 })).toEqual({ width: 30, length: 120 });
    expect(clampHeadShape({ width: NaN, length: Infinity })).toEqual({ width: 100, length: 100 });
  });

  it("stores nothing for the standard head", () => {
    expect(storedShape(STANDARD_HEAD)).toBeUndefined();
    expect(storedShape({ width: 50, length: 125 })).toEqual({ width: 50, length: 125 });
  });

  it("finds the style a head matches, by fill and shape", () => {
    const narrowOpen = matchingStyle(DEFAULT_HEAD_STYLES, "open", { width: 70, length: 150 });
    expect(narrowOpen?.label).toBe("Narrow Open");
    expect(matchingStyle(DEFAULT_HEAD_STYLES, "open", { width: 60, length: 150 })).toBeUndefined();
  });

  it("draws icons in the head's proportions, a filled head's shaft stopping at its base", () => {
    expect(headIcon("filled", STANDARD_HEAD)).toEqual({
      shaft: "M3 12H14",
      head: "M14 7L20 12L14 17Z",
    });
    expect(headIcon("open", { width: 50, length: 125 })).toEqual({
      shaft: "M3 12H20",
      head: "M12.5 9.1L20 12L12.5 14.9",
    });
  });
});
