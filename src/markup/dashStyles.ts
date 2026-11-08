// Dash styles (PLAN 3X): dashed and dotted strokes for lines, arrows, shape
// outlines and callouts. Dash and gap are in line widths, so a pattern keeps
// its look at any width; a dash of 1 is a dot (the ends are round). A mark
// keeps a copy of its pattern, so editing a style never changes marks drawn.

import type { Annotation, DashPattern } from "./model/types";
import type { ToolId } from "./toolStore";

export interface DashStyle {
  label: string;
  /** In line widths: 1 is a dot. */
  dash: number;
  /** The space between, in line widths. */
  gap: number;
}

/** Until Settings holds the list (PLAN 3X.2). Solid isn't in it: it's always first. */
export const DEFAULT_DASH_STYLES: DashStyle[] = [
  { label: "Dashed", dash: 3, gap: 2 },
  { label: "Dotted", dash: 1, gap: 1.5 },
  { label: "Long dash", dash: 6, gap: 3 },
];

/** Limits (`styles.rs` keeps the setting within them). */
export const DASH_LENGTH = { min: 1, max: 20 };
export const DASH_GAP = { min: 0.5, max: 20 };
export const MAX_DASH_STYLES = 10;
export const MAX_DASH_LABEL = 20;

/** The tools whose strokes can be dashed. */
export const DASH_TOOLS: readonly ToolId[] = ["line", "arrow", "rect", "ellipse", "callout"];

export function isDashTool(tool: ToolId): boolean {
  return DASH_TOOLS.includes(tool);
}

const clamp = (v: number, lo: number, hi: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

/** `p` within the limits (a stored or pasted pattern may not be). */
export function clampDash(p: DashPattern): DashPattern {
  return {
    dash: clamp(p.dash, DASH_LENGTH.min, DASH_LENGTH.max, 3),
    gap: clamp(p.gap, DASH_GAP.min, DASH_GAP.max, 2),
  };
}

export function isDashPattern(v: unknown): v is DashPattern {
  const p = v as DashPattern;
  return !!v && typeof v === "object" && typeof p.dash === "number" && typeof p.gap === "number";
}

/**
 * The canvas's line dash for `p` on a `width` px line with round ends: each
 * end adds half a width, so the drawn dash is one width shorter and the gap
 * one wider. Undefined for a solid line.
 */
export function canvasDash(p: DashPattern | null | undefined, width: number): number[] | undefined {
  if (!p) return undefined;
  const { dash, gap } = clampDash(p);
  return [(dash - 1) * width, (gap + 1) * width];
}

export function sameDash(a: DashPattern | null | undefined, b: DashPattern | null | undefined) {
  if (!a || !b) return !a && !b;
  return a.dash === b.dash && a.gap === b.gap;
}

/** The style a pattern matches, if any (solid matches none: it's its own entry). */
export function matchingDash(
  styles: readonly DashStyle[],
  p: DashPattern | null | undefined,
): DashStyle | undefined {
  return p ? styles.find((s) => sameDash(s, p)) : undefined;
}

/** A mark's pattern: null for solid, or for kinds without a dashable stroke. */
export function dashOf(a: Annotation): DashPattern | null {
  switch (a.kind) {
    case "line":
    case "arrow":
    case "rect":
    case "ellipse":
      return a.style.dash ?? null;
    case "callout":
      return a.dash ?? null;
    default:
      return null;
  }
}

/** Kinds whose stroke can be dashed. */
export function isDashable(a: Annotation): boolean {
  return (
    a.kind === "line" ||
    a.kind === "arrow" ||
    a.kind === "rect" ||
    a.kind === "ellipse" ||
    a.kind === "callout"
  );
}

/** What a mark stores for a pattern: nothing for solid. */
export function storedDash(p: DashPattern | null | undefined): DashPattern | undefined {
  return p ? { dash: p.dash, gap: p.gap } : undefined;
}

/** The SVG `stroke-dasharray` for a pattern on a `width` line (icons and previews). */
export function svgDash(p: DashPattern | null | undefined, width: number): string | undefined {
  return canvasDash(p, width)
    ?.map((v) => +v.toFixed(2))
    .join(" ");
}
