// Pure geometry for the markup tools, in source-image pixels.

import {
  bentCurve,
  cubicPoint,
  cubicPoints,
  measure,
  reverseBend,
  reverseCubic,
  subCubic,
  type Cubic,
} from "./bend";
import {
  STANDARD_HEAD,
  type Annotation,
  type ArrowEnds,
  type ArrowHead,
  type Bend,
  type HeadShape,
  type Point,
  type Rect,
} from "./model/types";
import { clampHeadShape } from "./headStyles";
import { textBoxPadding } from "./textMeasure";

/** Rect spanned by a drag from `a` to `b`. With `square`, the shorter side grows to match. */
export function rectFromDrag(a: Point, b: Point, square = false): Rect {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = side * (Math.sign(dx) || 1);
    dy = side * (Math.sign(dy) || 1);
  }
  return {
    x: Math.min(a.x, a.x + dx),
    y: Math.min(a.y, a.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Axis-aligned box of `r` rotated by `degrees` about its centre. */
export function rotatedBounds(r: Rect, degrees: number): Rect {
  if (!degrees) return r;
  const t = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(t));
  const sin = Math.abs(Math.sin(t));
  const w = r.width * cos + r.height * sin;
  const h = r.width * sin + r.height * cos;
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

function pointsBounds(xs: number[], ys: number[]): Rect {
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Approximate on-image bounds, for box selection. Stroke width is ignored. */
export function annotationBounds(a: Annotation): Rect {
  switch (a.kind) {
    case "rect":
    case "ellipse":
      return rotatedBounds(a.rect, a.rotation);
    case "redact":
    case "spotlight":
      return a.rect;
    case "step":
      return { x: a.x - a.size / 2, y: a.y - a.size / 2, width: a.size, height: a.size };
    case "line":
    case "arrow": {
      const curve = bentCurve(a.from, a.to, a.bend);
      const pts = curve ? cubicPoints(curve) : [a.from, a.to];
      return pointsBounds(
        pts.map((p) => p.x),
        pts.map((p) => p.y),
      );
    }
    case "pen":
    case "highlighter":
      return pointsBounds(
        a.points.filter((_, i) => i % 2 === 0),
        a.points.filter((_, i) => i % 2 === 1),
      );
    case "text": {
      // Approximate: counts hard line breaks, not word wrapping.
      const lines = Math.max(1, a.text.split("\n").length);
      const height = lines * textLineHeight(a.fontSize);
      const t = (a.rotation * Math.PI) / 180;
      const cos = Math.cos(t);
      const sin = Math.sin(t);
      const corners = [
        [0, 0],
        [a.width, 0],
        [a.width, height],
        [0, height],
      ].map(([u, v]) => ({ x: a.x + u * cos - v * sin, y: a.y + u * sin + v * cos }));
      return pointsBounds(
        corners.map((c) => c.x),
        corners.map((c) => c.y),
      );
    }
    case "callout": {
      // Approximate like text, with the box's padding and the tip.
      const lines = Math.max(1, a.text.split("\n").length);
      const pad = textBoxPadding(textPx(a.fontSize));
      const x0 = a.x - pad;
      const y0 = a.y - pad;
      const x1 = a.x + a.width + pad;
      const y1 = a.y + lines * textLineHeight(a.fontSize) + pad;
      return pointsBounds([x0, x1, a.tip.x], [y0, y1, a.tip.y]);
    }
  }
}

/** Line height as a multiple of the font size, shared by the canvas and the text editor. */
export const TEXT_LINE_HEIGHT = 1.2;

/** Font size in source px for a size in pt (at 96 dpi, like Windows at 100%). */
export function textPx(fontSize: number): number {
  return (fontSize * 96) / 72;
}

/** Height of one line of text in source px. */
export function textLineHeight(fontSize: number): number {
  return textPx(fontSize) * TEXT_LINE_HEIGHT;
}

/**
 * `a` moved by (dx, dy). A callout's tip moves too, unless `leaveTip` (a
 * callout moved on its own keeps pointing at the same spot, PLAN 3E).
 */
export function translateAnnotation<A extends Annotation>(
  a: A,
  dx: number,
  dy: number,
  leaveTip = false,
): A {
  const p = (q: Point) => ({ x: q.x + dx, y: q.y + dy });
  switch (a.kind) {
    case "rect":
    case "ellipse":
    case "redact":
    case "spotlight":
      return { ...a, rect: { ...a.rect, x: a.rect.x + dx, y: a.rect.y + dy } };
    case "line":
    case "arrow":
      return { ...a, from: p(a.from), to: p(a.to) };
    case "pen":
    case "highlighter":
      return { ...a, points: a.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) };
    case "text":
    case "step":
      return { ...a, x: a.x + dx, y: a.y + dy };
    case "callout":
      return { ...a, x: a.x + dx, y: a.y + dy, tip: leaveTip ? a.tip : p(a.tip) };
  }
  return a;
}

/**
 * `p` moved onto the nearest `stepDeg` direction from `anchor`, keeping its
 * distance (Shift while drawing or dragging an endpoint).
 */
export function snapAngle(anchor: Point, p: Point, stepDeg = 45): Point {
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return p;
  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: anchor.x + len * Math.cos(angle), y: anchor.y + len * Math.sin(angle) };
}

/**
 * Arrow head size for a line width: length along the shaft and half its width,
 * for the standard head or one in proportion to it (PLAN 3W): `shape.width`
 * is a % of how far the standard head sticks out past the line.
 */
export function arrowHeadSize(
  width: number,
  shape: HeadShape = STANDARD_HEAD,
  head: ArrowHead = "filled",
): { length: number; halfWidth: number } {
  // Pasted or hand-edited markup may hold any numbers.
  if (shape !== STANDARD_HEAD) shape = clampHeadShape(shape);
  // The width % scales what sticks out past the line, not the whole head: a
  // narrow head on a thick line still clears it as far, in proportion.
  const line = width / 2;
  const k = shape.width / 100;
  // An open head's strokes are as thick as the line and fill in a narrow V,
  // so the part that grows with the line narrows only half as much.
  const kThick = head === "open" && k < 1 ? k + (1 - k) * OPEN_NARROWS_LESS : k;
  return {
    length: ((6 + 3 * width) * shape.length) / 100,
    halfWidth: line + 4 * k + 0.75 * width * kThick,
  };
}

/** How much of a narrowing an open head gives back on thick lines (see arrowHeadSize). */
const OPEN_NARROWS_LESS = 0.5;

/** The line to stroke: straight, or a cubic Bézier when bent (PLAN 3D.6). */
export type Shaft =
  { kind: "line"; points: [number, number, number, number] } | { kind: "curve"; curve: Cubic };

function reverseShaft(s: Shaft): Shaft {
  if (s.kind === "curve") return { kind: "curve", curve: reverseCubic(s.curve) };
  const [x1, y1, x2, y2] = s.points;
  return { kind: "line", points: [x2, y2, x1, y1] };
}

export interface ArrowGeometry {
  shaft: Shaft;
  /**
   * Head outlines [left, tip, right] (filled triangles or open chevrons): the
   * `to` end first, then the `from` end for a two-ended arrow.
   */
  heads: [Point, Point, Point][];
}

/** A head with its tip at `tip` and its base's middle at `base`. */
function headOutline(tip: Point, base: Point, hw: number): [Point, Point, Point] {
  const len = Math.hypot(tip.x - base.x, tip.y - base.y) || 1;
  const vx = (tip.x - base.x) / len;
  const vy = (tip.y - base.y) / len;
  return [
    { x: base.x - vy * hw, y: base.y + vx * hw },
    { ...tip },
    { x: base.x + vy * hw, y: base.y - vx * hw },
  ];
}

/** Below this many head lengths of arrow (per head), the head scales down with it. */
const HEAD_FULL_AT = 2;
/** The smallest a head scales to while there's room for it, as a share of full size. */
const HEAD_MIN_SCALE = 0.5;
/** A head never takes more than this share of its arrow (or of its half, with two). */
const HEAD_MAX_SHARE = 0.8;

/**
 * How much to scale a head of length `headLength` on `len` px of arrow (per
 * head): full size down to `HEAD_FULL_AT` head lengths, then in proportion to
 * the arrow so a short one keeps some shaft, but no smaller than
 * `HEAD_MIN_SCALE` (it'd stop reading as an arrow) unless the arrow is too
 * short even for that.
 */
function shortArrowScale(len: number, headLength: number): number {
  const k = Math.max(HEAD_MIN_SCALE, len / (HEAD_FULL_AT * headLength));
  return Math.min(1, k, (len * HEAD_MAX_SHARE) / headLength);
}

/**
 * Where to draw a line or arrow, straight or bent into a curve. A filled
 * head's shaft stops at the head's base (along the curve, when bent) so a round
 * cap never pokes through the tip. Heads scale down on short arrows
 * (`shortArrowScale`).
 */
export function arrowGeometry(
  from: Point,
  to: Point,
  head: ArrowHead | "none",
  width: number,
  ends: ArrowEnds = "end",
  bend?: Bend,
  shape?: HeadShape,
): ArrowGeometry {
  // A head at the start is an arrow drawn the other way.
  if (ends === "start") {
    const g = arrowGeometry(to, from, head, width, "end", reverseBend(bend), shape);
    return { shaft: reverseShaft(g.shaft), heads: g.heads };
  }
  const curve = bentCurve(from, to, bend);
  const measured = curve && measure(curve);
  const len = measured ? measured.length : Math.hypot(to.x - from.x, to.y - from.y);
  const whole: Shaft = curve
    ? { kind: "curve", curve }
    : { kind: "line", points: [from.x, from.y, to.x, to.y] };
  if (head === "none" || len === 0) return { shaft: whole, heads: [] };

  const both = ends === "both";
  const size = arrowHeadSize(width, shape, head === "open" ? "open" : "filled");
  const k = shortArrowScale(len / (both ? 2 : 1), size.length);
  const hl = size.length * k;
  // Narrower too, though never narrower than the line.
  const hw = width / 2 + (size.halfWidth - width / 2) * k;
  const filled = head === "filled";

  if (!curve || !measured) {
    const ux = (to.x - from.x) / len;
    const uy = (to.y - from.y) / len;
    const frontBase = { x: to.x - ux * hl, y: to.y - uy * hl };
    const backBase = { x: from.x + ux * hl, y: from.y + uy * hl };
    const a = both && filled ? backBase : from;
    const b = filled ? frontBase : to;
    return {
      shaft: { kind: "line", points: [a.x, a.y, b.x, b.y] },
      heads: both
        ? [headOutline(to, frontBase, hw), headOutline(from, backBase, hw)]
        : [headOutline(to, frontBase, hw)],
    };
  }

  // Bent: each head's base is `hl` back along the curve from its tip.
  const frontBase = measured.paramAt(len - hl);
  const backBase = measured.paramAt(hl);
  const shaft: Shaft = {
    kind: "curve",
    curve: subCubic(curve, both && filled ? backBase : 0, filled ? frontBase : 1),
  };
  const front = headOutline(to, cubicPoint(curve, frontBase), hw);
  return {
    shaft,
    heads: both ? [front, headOutline(from, cubicPoint(curve, backBase), hw)] : [front],
  };
}

/** Distance from `p` to the segment `a`–`b`. */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * A freehand path (flat `[x0, y0, x1, y1, …]`) with points dropped wherever
 * the result stays within `tolerance` of the original (Ramer–Douglas–Peucker).
 * The first and last points are always kept.
 */
export function simplifyPath(points: number[], tolerance: number): number[] {
  const n = points.length / 2;
  if (n <= 2) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let worst = -1;
    let dist = tolerance;
    for (let k = i + 1; k < j; k++) {
      const d = segmentDistance(
        points[2 * k],
        points[2 * k + 1],
        points[2 * i],
        points[2 * i + 1],
        points[2 * j],
        points[2 * j + 1],
      );
      if (d > dist) {
        dist = d;
        worst = k;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([i, worst], [worst, j]);
    }
  }
  const out: number[] = [];
  for (let k = 0; k < n; k++) if (keep[k]) out.push(points[2 * k], points[2 * k + 1]);
  return out;
}
