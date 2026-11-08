import { describe, expect, it } from "vitest";
import {
  ellipseDash,
  ellipsePerimeter,
  fittedDashes,
  traceDashedRect,
  type PathSink,
} from "./dashCorners";

/** Records the path: each subpath's points (arcs as their ends). */
function recorder() {
  const subpaths: [number, number][][] = [];
  const at = (x: number, y: number): [number, number] => [+x.toFixed(3), +y.toFixed(3)];
  const sink: PathSink = {
    moveTo: (x, y) => subpaths.push([at(x, y)]),
    lineTo: (x, y) => subpaths[subpaths.length - 1].push(at(x, y)),
    arc: (cx, cy, r, a0, a1) =>
      subpaths[subpaths.length - 1].push(
        at(cx + r * Math.cos(a0), cy + r * Math.sin(a0)),
        at(cx + r * Math.cos(a1), cy + r * Math.sin(a1)),
      ),
  };
  return { sink, subpaths };
}

describe("fittedDashes (PLAN 3X)", () => {
  it("centres a dash on every corner and spaces the rest evenly", () => {
    // A 10 + 10 period: 100 fits 5 times; 52 rounds to 3 (a little longer).
    const d = fittedDashes([100, 52], 10, 10);
    // The short side's dashes shrink with its period: half of 10 × (52/3) / 20.
    const half = 52 / 3 / 4;
    expect(d[0]).toEqual([-half, 5]);
    expect(d.slice(1, 5)).toEqual([
      [15, 25],
      [35, 45],
      [55, 65],
      [75, 85],
    ]);
    expect(d[5]).toEqual([95, 100 + half]);
    expect(d).toHaveLength(8);
  });

  it("keeps at least the corners on a side shorter than one period", () => {
    expect(fittedDashes([3, 3, 3, 3], 10, 10)).toHaveLength(4);
  });
});

describe("traceDashedRect", () => {
  it("turns each square corner with one dash", () => {
    const { sink, subpaths } = recorder();
    // Width 2, Dashed 3/2: canvas dash 4, gap 6; 100 × 50 fits 10 and 5.
    traceDashedRect(sink, 0, 0, 100, 50, 0, { dash: 3, gap: 2 }, 2);
    expect(subpaths).toHaveLength(30);
    // The top-left corner's dash wraps round: up the left side, then along the top.
    expect(subpaths[0]).toEqual([
      [0, 2],
      [0, 0],
      [2, 0],
    ]);
    // The top-right one goes through its corner.
    expect(subpaths[10]).toEqual([
      [98, 0],
      [100, 0],
      [100, 2],
    ]);
  });

  it("draws a dot as a zero-length stroke, also on a rounded corner", () => {
    const { sink, subpaths } = recorder();
    traceDashedRect(sink, 0, 0, 100, 100, 20, { dash: 1, gap: 1.5 }, 4);
    for (const s of subpaths) expect(new Set(s.map(String)).size).toBe(1);
    // The first dot sits on the middle of the top-left corner.
    const m = 20 - 20 * Math.SQRT1_2;
    expect(subpaths[0][0][0]).toBeCloseTo(m, 3);
    expect(subpaths[0][0][1]).toBeCloseTo(m, 3);
  });

  it("handles a rectangle drawn backwards", () => {
    const a = recorder();
    const b = recorder();
    traceDashedRect(a.sink, 0, 0, 100, 50, 0, { dash: 3, gap: 2 }, 2);
    traceDashedRect(b.sink, 100, 50, -100, -50, 0, { dash: 3, gap: 2 }, 2);
    expect(b.subpaths).toEqual(a.subpaths);
  });
});

describe("ellipseDash", () => {
  it("fits a whole number of periods round, four by four", () => {
    const { dash, offset } = ellipseDash({ dash: 3, gap: 2 }, 2, 50, 30);
    const periods = ellipsePerimeter(50, 30) / (dash[0] + dash[1]);
    expect(periods).toBeCloseTo(Math.round(periods), 9);
    expect(Math.round(periods) % 4).toBe(0);
    expect(offset).toBeCloseTo(dash[0] / 2, 9);
    expect(ellipsePerimeter(10, 10)).toBeCloseTo(20 * Math.PI, 9);
  });
});
