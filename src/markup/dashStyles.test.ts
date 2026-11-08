import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASH_STYLES,
  canvasDash,
  clampDash,
  dashOf,
  matchingDash,
  storedDash,
  svgDash,
} from "./dashStyles";
import type { Annotation } from "./model/types";

describe("dash styles", () => {
  it("turns line widths into the canvas's dash, round ends included", () => {
    // Dashed 3/2 on a 4 px line: each round end adds 2 px, so 8 + 2 + 2 = 12 drawn.
    expect(canvasDash({ dash: 3, gap: 2 }, 4)).toEqual([8, 12]);
    // A dash of 1 is a dot: nothing between the round ends.
    expect(canvasDash({ dash: 1, gap: 1.5 }, 2)).toEqual([0, 5]);
    expect(canvasDash(null, 4)).toBeUndefined();
    expect(svgDash({ dash: 1, gap: 1.5 }, 2.5)).toBe("0 6.25");
  });

  it("keeps patterns within the limits", () => {
    expect(clampDash({ dash: 0, gap: 100 })).toEqual({ dash: 1, gap: 20 });
    expect(clampDash({ dash: NaN, gap: -1 })).toEqual({ dash: 3, gap: 0.5 });
    expect(canvasDash({ dash: 0.2, gap: 0 }, 2)).toEqual([0, 3]);
  });

  it("matches a pattern to its style, solid to none", () => {
    expect(matchingDash(DEFAULT_DASH_STYLES, { dash: 1, gap: 1.5 })?.label).toBe("Dotted");
    expect(matchingDash(DEFAULT_DASH_STYLES, { dash: 1, gap: 2 })).toBeUndefined();
    expect(matchingDash(DEFAULT_DASH_STYLES, null)).toBeUndefined();
    expect(storedDash(null)).toBeUndefined();
  });

  it("reads a mark's pattern: a stroke's, a callout's, none for the rest", () => {
    const style = { color: "#000000", width: 2, opacity: 1, dash: { dash: 3, gap: 2 } };
    const line = { id: "l", kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, style };
    expect(dashOf(line as Annotation)).toEqual({ dash: 3, gap: 2 });
    expect(dashOf({ ...line, style: { ...style, dash: undefined } } as Annotation)).toBeNull();
    expect(dashOf({ id: "p", kind: "pen", points: [], style } as unknown as Annotation)).toBeNull();
  });
});
