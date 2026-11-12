import { describe, expect, it } from "vitest";
import { fieldsFor, sizeOf, sizeProblem, typed } from "./resizeMath";

const base = { width: 1920, height: 1080 };

describe("resize fields", () => {
  it("shows a size in pixels or percent", () => {
    expect(fieldsFor({ width: 960, height: 540 }, base, "px")).toEqual({
      width: "960",
      height: "540",
    });
    expect(fieldsFor({ width: 960, height: 540 }, base, "%")).toEqual({
      width: "50",
      height: "50",
    });
    expect(fieldsFor({ width: 640, height: 360 }, base, "%")).toEqual({
      width: "33.33",
      height: "33.33",
    });
  });

  it("reads the size asked for, rounded, never below 1 px", () => {
    expect(sizeOf({ width: "800", height: "600" }, base, "px")).toEqual({
      width: 800,
      height: 600,
    });
    expect(sizeOf({ width: "50", height: "25" }, base, "%")).toEqual({ width: 960, height: 270 });
    expect(sizeOf({ width: "0.01", height: "0.01" }, base, "%")).toEqual({ width: 1, height: 1 });
    expect(sizeOf({ width: "", height: "10" }, base, "px")).toBeNull();
    expect(sizeOf({ width: "0", height: "10" }, base, "px")).toBeNull();
    expect(sizeOf({ width: "abc", height: "10" }, base, "px")).toBeNull();
  });

  it("keeps the proportions while locked", () => {
    const start = { width: "1920", height: "1080" };
    expect(typed(start, "width", "960", base, "px", true)).toEqual({ width: "960", height: "540" });
    expect(typed(start, "height", "540", base, "px", true)).toEqual({
      width: "960",
      height: "540",
    });
    expect(typed({ width: "100", height: "100" }, "width", "75", base, "%", true)).toEqual({
      width: "75",
      height: "75",
    });
    // Unlocked: only the side typed in.
    expect(typed(start, "width", "960", base, "px", false)).toEqual({
      width: "960",
      height: "1080",
    });
    // Half-typed: the other side waits.
    expect(typed(start, "width", "", base, "px", true)).toEqual({ width: "", height: "1080" });
  });

  it("names Rust's limits", () => {
    expect(sizeProblem({ width: 16_384, height: 6_000 })).toBeNull();
    expect(sizeProblem({ width: 16_385, height: 10 })).toMatch(/16,384 pixels/);
    expect(sizeProblem({ width: 12_000, height: 12_000 })).toMatch(/144 megapixels/);
  });
});
