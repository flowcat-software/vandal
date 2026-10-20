import { describe, expect, it } from "vitest";
import { hexAt, loupePixels, type FramePixels } from "./loupe";

// 2×2: red, green / blue, white.
const frame: FramePixels = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 255, 255, 255, 0]),
};

describe("hexAt", () => {
  it("reads a pixel", () => {
    expect(hexAt(frame, 1, 0)).toBe("#00ff00");
    expect(hexAt(frame, 1, 1)).toBe("#ffffff");
  });

  it("is null off the frame", () => {
    expect(hexAt(frame, 2, 0)).toBeNull();
    expect(hexAt(frame, 0, -1)).toBeNull();
  });
});

describe("loupePixels", () => {
  it("centres on the point, opaque, with off-frame pixels transparent", () => {
    // 3×3 around the top-left pixel: only the bottom-right 2×2 is on the frame.
    const px = loupePixels(frame, 0, 0, 3);
    const at = (col: number, row: number) =>
      Array.from(px.slice((row * 3 + col) * 4, (row * 3 + col) * 4 + 4));
    expect(at(0, 0)).toEqual([0, 0, 0, 0]);
    expect(at(2, 0)).toEqual([0, 0, 0, 0]);
    expect(at(1, 1)).toEqual([255, 0, 0, 255]);
    expect(at(2, 1)).toEqual([0, 255, 0, 255]);
    expect(at(1, 2)).toEqual([0, 0, 255, 255]);
    expect(at(2, 2)).toEqual([255, 255, 255, 255]);
  });
});
