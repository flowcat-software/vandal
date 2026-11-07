// Arrow head styles (PLAN 3W): filled or open, in proportion to the standard
// head. An arrow keeps a copy of its style's shape, so editing or removing a
// style never changes arrows already drawn.

import { STANDARD_HEAD, type ArrowAnnotation, type ArrowHead, type HeadShape } from "./model/types";

export interface HeadStyle {
  label: string;
  head: ArrowHead;
  /** % of the standard head's width and length. */
  width: number;
  length: number;
}

/** Until Settings holds the list (PLAN 3W.2). */
export const DEFAULT_HEAD_STYLES: HeadStyle[] = [
  { label: "Regular Filled", head: "filled", width: 100, length: 100 },
  { label: "Narrow Filled", head: "filled", width: 50, length: 125 },
  { label: "Regular Open", head: "open", width: 100, length: 100 },
  { label: "Narrow Open", head: "open", width: 50, length: 125 },
];

/** Limits, so a head still reads as one and never balloons (mirrored in Rust). */
export const HEAD_WIDTH = { min: 25, max: 200 };
export const HEAD_LENGTH = { min: 50, max: 250 };
/** Neither side more than this many times the other, compared with the standard head. */
export const HEAD_MAX_RATIO = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** `s` within the limits (a stored or pasted shape may not be). */
export function clampHeadShape(s: HeadShape): HeadShape {
  const fine = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  const width = clamp(fine(s.width, 100), HEAD_WIDTH.min, HEAD_WIDTH.max);
  let length = clamp(fine(s.length, 100), HEAD_LENGTH.min, HEAD_LENGTH.max);
  length = clamp(length, width / HEAD_MAX_RATIO, width * HEAD_MAX_RATIO);
  // Width's range allows every length, so clamping length alone settles the ratio.
  return { width, length };
}

/** An arrow's head shape, the standard one when it has none. */
export function headShapeOf(a: Pick<ArrowAnnotation, "headShape">): HeadShape {
  return a.headShape ?? STANDARD_HEAD;
}

export function sameShape(a: HeadShape, b: HeadShape): boolean {
  return a.width === b.width && a.length === b.length;
}

/** What an arrow stores for `s`: nothing for the standard head. */
export function storedShape(s: HeadShape): HeadShape | undefined {
  return sameShape(s, STANDARD_HEAD) ? undefined : { width: s.width, length: s.length };
}

/** The style a head matches, if any (the dropdown shows "Custom" otherwise). */
export function matchingStyle(
  styles: readonly HeadStyle[],
  head: ArrowHead,
  shape: HeadShape,
): HeadStyle | undefined {
  return styles.find((s) => s.head === head && sameShape(s, shape));
}

/**
 * A style's icon in a 24 × 24 box, in the head's true proportions: the shaft
 * from x = 3, the tip at x = 20 (the standard head is 6 long and 10 wide).
 * As on the canvas, the width % scales what sticks out past the line (the
 * icons' strokes are 1.6 wide).
 */
export function headIcon(head: ArrowHead, shape: HeadShape): { shaft: string; head: string } {
  const l = (6 * shape.length) / 100;
  const hw = 0.8 + (4.2 * shape.width) / 100;
  const n = (v: number) => +v.toFixed(2);
  const base = n(20 - l);
  const wing = `M${base} ${n(12 - hw)}L20 12L${base} ${n(12 + hw)}`;
  return {
    // A filled head's shaft stops at its base, as on the canvas.
    shaft: `M3 12H${head === "filled" ? base : 20}`,
    head: head === "filled" ? `${wing}Z` : wing,
  };
}
