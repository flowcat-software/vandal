// Dashes that meet the corners (PLAN 3X): on a rectangle each side's pattern
// is stretched or squeezed a little so that a whole number of periods fits,
// with a dash centred on every corner (it turns the corner), and on an
// ellipse the pattern fits the perimeter, so there's no seam where it starts.
// The canvas's own dashing would end each side wherever the pattern happens
// to be, which leaves corners uneven.

import { canvasDash } from "./dashStyles";
import type { DashPattern } from "./model/types";

/** What drawing a path needs (a canvas context, Konva's included). */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
}

type Piece =
  | { kind: "line"; x0: number; y0: number; x1: number; y1: number; len: number }
  | { kind: "arc"; cx: number; cy: number; r: number; a0: number; a1: number; len: number };

const Q = Math.PI / 4;

/**
 * The outline of a rectangle with `r` corners, clockwise from the middle of
 * the top-left corner, in four sections that each run from one corner's
 * middle to the next.
 */
function outline(x: number, y: number, w: number, h: number, r: number) {
  const arc = (cx: number, cy: number, a0: number, a1: number): Piece => ({
    kind: "arc",
    cx,
    cy,
    r,
    a0,
    a1,
    len: r * (a1 - a0),
  });
  const line = (x0: number, y0: number, x1: number, y1: number): Piece => ({
    kind: "line",
    x0,
    y0,
    x1,
    y1,
    len: Math.hypot(x1 - x0, y1 - y0),
  });
  const [l, t, rt, b] = [x, y, x + w, y + h];
  const sections: Piece[][] = [
    [arc(l + r, t + r, 5 * Q, 6 * Q), line(l + r, t, rt - r, t), arc(rt - r, t + r, 6 * Q, 7 * Q)],
    [arc(rt - r, t + r, 7 * Q, 8 * Q), line(rt, t + r, rt, b - r), arc(rt - r, b - r, 0, Q)],
    [arc(rt - r, b - r, Q, 2 * Q), line(rt - r, b, l + r, b), arc(l + r, b - r, 2 * Q, 3 * Q)],
    [arc(l + r, b - r, 3 * Q, 4 * Q), line(l, b - r, l, t + r), arc(l + r, t + r, 4 * Q, 5 * Q)],
  ];
  return sections;
}

/**
 * Where the dashes go along a perimeter split into `sections` (their
 * lengths), as [start, end] distances from its start: a dash centred on each
 * section's ends (shared with the next section) and evenly between. `dash`
 * and `gap` are the canvas's (the drawn dash without its round ends).
 */
export function fittedDashes(sections: number[], dash: number, gap: number): [number, number][] {
  const period = dash + gap;
  const fit = sections.map((len) => {
    const n = Math.max(1, Math.round(len / period));
    return { len, n, step: len / n, half: (dash * (len / n / period)) / 2 };
  });
  const out: [number, number][] = [];
  let at = 0;
  fit.forEach((s, i) => {
    const before = fit[(i + fit.length - 1) % fit.length];
    // The corner's dash: half from each side (the first one wraps round).
    out.push([at - before.half, at + s.half]);
    for (let j = 1; j < s.n; j++) out.push([at + j * s.step - s.half, at + j * s.step + s.half]);
    at += s.len;
  });
  return out;
}

function pointOn(p: Piece, u: number): [number, number] {
  if (p.kind === "line") {
    const k = p.len > 0 ? u / p.len : 0;
    return [p.x0 + (p.x1 - p.x0) * k, p.y0 + (p.y1 - p.y0) * k];
  }
  const a = p.a0 + (p.len > 0 ? (p.a1 - p.a0) * (u / p.len) : 0);
  return [p.cx + p.r * Math.cos(a), p.cy + p.r * Math.sin(a)];
}

/** Adds the stretch of `pieces` from `s0` to `s1` (it may wrap round) as one subpath. */
function trace(sink: PathSink, pieces: Piece[], total: number, s0: number, s1: number) {
  if (s0 < 0) {
    s0 += total;
    s1 += total;
  }
  let started = false;
  let at = 0;
  // Twice round, for a dash over the start.
  for (let lap = 0; lap < 2; lap++) {
    for (const p of pieces) {
      const ps = at;
      const pe = at + p.len;
      at = pe;
      const from = Math.max(s0, ps);
      const to = Math.min(s1, pe);
      if (to < from || (p.len === 0 && started)) continue;
      if (!started) {
        const [x, y] = pointOn(p, from - ps);
        sink.moveTo(x, y);
        started = true;
        if (s1 - s0 < 1e-6) {
          // A dot: a zero-length stroke, which round caps draw.
          sink.lineTo(x, y);
          return;
        }
      }
      if (p.kind === "line") {
        const [x, y] = pointOn(p, to - ps);
        sink.lineTo(x, y);
      } else if (p.len > 0) {
        const k = (p.a1 - p.a0) / p.len;
        sink.arc(p.cx, p.cy, p.r, p.a0 + (from - ps) * k, p.a0 + (to - ps) * k);
      }
      if (s1 <= pe) return;
    }
  }
}

/**
 * Adds a dashed rectangle's dashes to the current path, as subpaths, to be
 * stroked without a line dash and with round caps (a dot is a dash of length
 * 0). `w` and `h` may be negative, as while one is drawn backwards. `r` is
 * the drawn corner radius.
 */
export function traceDashedRect(
  sink: PathSink,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  pattern: DashPattern,
  width: number,
) {
  const [dash, gap] = canvasDash(pattern, width)!;
  if (w < 0) [x, w] = [x + w, -w];
  if (h < 0) [y, h] = [y + h, -h];
  const sections = outline(x, y, w, h, Math.max(0, r));
  const pieces = sections.flat();
  const lengths = sections.map((s) => s.reduce((sum, p) => sum + p.len, 0));
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total <= 0) return;
  for (const [s0, s1] of fittedDashes(lengths, dash, gap)) trace(sink, pieces, total, s0, s1);
}

/** An ellipse's perimeter (Ramanujan's approximation, well within a pixel here). */
export function ellipsePerimeter(rx: number, ry: number): number {
  const [a, b] = [Math.abs(rx), Math.abs(ry)];
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/**
 * An ellipse's line dash and offset: a whole number of periods round it (a
 * multiple of four when there's room, so the dashes sit evenly on both
 * axes), with a dash centred where the canvas starts it.
 */
export function ellipseDash(
  pattern: DashPattern,
  width: number,
  rx: number,
  ry: number,
): { dash: number[]; offset: number } {
  const [dash, gap] = canvasDash(pattern, width)!;
  const len = ellipsePerimeter(rx, ry);
  const period = dash + gap;
  let n = Math.max(1, Math.round(len / period));
  if (n >= 4) n = Math.max(4, Math.round(n / 4) * 4);
  const k = len > 0 ? len / (n * period) : 1;
  return { dash: [dash * k, gap * k], offset: (dash * k) / 2 };
}
