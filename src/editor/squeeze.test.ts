import { describe, expect, it } from "vitest";
import { squeeze } from "./squeeze";

/** A bar `width` wide whose content takes `needs[step]` at each squeeze step. */
function bar(width: number, needs: number[]) {
  const dataset: DOMStringMap = {};
  return {
    dataset,
    clientWidth: width,
    get scrollWidth() {
      return Math.max(width, needs[Number(dataset.fit)]);
    },
  };
}

describe("squeeze", () => {
  it("takes the least squeeze that fits", () => {
    const b = bar(800, [1000, 900, 780]);
    expect(squeeze(b, 2)).toBe(2);
    expect(b.dataset.fit).toBe("2");
    expect(squeeze(bar(950, [1000, 900, 780]), 2)).toBe(1);
  });

  it("doesn't squeeze what fits", () => {
    const b = bar(1200, [1000, 900, 780]);
    expect(squeeze(b, 2)).toBe(0);
    expect(b.dataset.fit).toBe("0");
  });

  it("stops at the last step when nothing fits", () => {
    const b = bar(500, [1000, 900, 780]);
    expect(squeeze(b, 2)).toBe(2);
    expect(b.dataset.fit).toBe("2");
  });
});
