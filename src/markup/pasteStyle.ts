// Copy Style / Paste Style (PLAN 3V.7, Razorcat's 4.5d3): one mark's style onto others. The same
// kind takes it whole (a rectangle and an ellipse count as one); another kind takes what it has a
// place for, by colour's role: a line (a stroke, a border, a pointer), a fill (a shape's, a text's
// background, a callout's box, a step marker) and text. A callout's box and a step marker take a
// fill, else a line; an outlined shape given a fill gets one. Text colour is an island: it goes
// only to text (a text's colour, a callout's or a step's label) and text takes no other
// (an arrow's colour turned a text yellow but no label, and a text's turned a line its
// colour). A text's background is a fill, and goes as one. Never the text, the shape drawn or the
// place.

import { docStore } from "./model/store";
import type { Annotation } from "./model/types";
import { headShapeOf } from "./headStyles";
import { patchAnnotation, styleTarget, type StylePatch } from "./restyle";

/** What an item's style says, by role rather than by field. */
interface Style {
  /** A stroke, a shape's border, a callout's pointer. */
  line?: string;
  /** A shape's fill, a text's background (when shown), a filled callout box, a step marker. */
  fill?: string;
  /** The colour text is in: a text's ink, a callout's or a step's label. */
  text?: string;
  width?: number;
  font?: { fontFamily: string; fontSize?: number; bold?: boolean; italic?: boolean };
  align?: StylePatch["align"];
  cornerRadius?: number;
}

function styleOf(a: Annotation): Style {
  switch (a.kind) {
    case "text":
      return {
        text: a.color,
        fill: a.background ? a.backgroundColor : undefined,
        font: { fontFamily: a.fontFamily, fontSize: a.fontSize, bold: a.bold, italic: a.italic },
        align: a.align,
      };
    case "callout":
      return {
        line: a.color,
        fill: a.shape === "box" ? a.color : undefined,
        text: a.textColor,
        width: a.lineWidth,
        font: { fontFamily: a.fontFamily, fontSize: a.fontSize, bold: a.bold, italic: a.italic },
        align: a.align,
        cornerRadius: a.cornerRadius,
      };
    case "step":
      return { fill: a.color, text: a.textColor, font: { fontFamily: a.fontFamily } };
    case "rect":
    case "ellipse":
      // Solid: no border, the shape's colour its fill.
      return {
        line: a.fill === "solid" ? undefined : a.style.color,
        fill: a.fill === "solid" ? a.style.color : a.fill === "both" ? a.fillColor : undefined,
        width: a.style.width,
        cornerRadius: a.cornerRadius,
      };
    case "arrow":
    case "line":
    case "pen":
    case "highlighter":
      return { line: a.style.color, width: a.style.width };
    case "redact":
    case "spotlight":
      return { cornerRadius: a.kind === "spotlight" ? a.cornerRadius : undefined };
  }
}

/** The kind's own settings, carried only to the same kind. */
function ownOf(a: Annotation): StylePatch {
  switch (a.kind) {
    case "text":
      return { background: a.background, backgroundColor: a.backgroundColor };
    case "callout":
      return { calloutShape: a.shape, pointerEnd: a.end };
    case "step":
      // Not the labels' format and start: every marker shares those.
      return { stepShape: a.shape, stepSize: a.size };
    case "rect":
    case "ellipse":
      return { fill: a.fill, fillColor: a.fillColor };
    case "arrow":
      return { head: a.head, headShape: headShapeOf(a), ends: a.ends };
    case "redact":
      return { redactMode: a.mode, strength: a.strength };
    case "spotlight":
      // Not the darkness: every spotlight shares it.
      return { spotlightShape: a.shape };
    default:
      return {};
  }
}

const shape = (a: Annotation) => a.kind === "rect" || a.kind === "ellipse";

/** The patch that gives `target` the style of `source`, as far as its kind has a place for it. */
export function stylePatchFor(source: Annotation, target: Annotation): StylePatch {
  const s = styleOf(source);
  const same = source.kind === target.kind || (shape(source) && shape(target));
  const patch: StylePatch = same ? ownOf(source) : {};
  const t = target.kind;
  const textual = t === "text" || t === "callout";
  let color: string | undefined;
  if (t === "text") {
    color = s.text;
    // Another kind's fill: a background (a text's own comes whole, shown or not, above).
    if (!same && s.fill !== undefined) {
      patch.background = true;
      patch.backgroundColor = s.fill;
    }
  } else if (t === "callout" || t === "step") {
    color = s.fill ?? s.line;
    if (s.text !== undefined) patch.textColor = s.text;
  } else if (target.kind === "rect" || target.kind === "ellipse") {
    if (same && "style" in source) color = source.style.color;
    else if (target.fill === "solid") color = s.fill ?? s.line;
    else {
      color = s.line;
      if (s.fill !== undefined) {
        patch.fill = "both";
        patch.fillColor = s.fill;
      }
    }
  } else color = s.line ?? s.fill;
  if (color !== undefined) patch.color = color;
  if (s.width !== undefined && t !== "text" && t !== "step" && t !== "redact" && t !== "spotlight")
    patch.width = s.width;
  if (s.font && (textual || t === "step")) {
    patch.fontFamily = s.font.fontFamily;
    if (textual) {
      if (s.font.fontSize !== undefined) patch.fontSize = s.font.fontSize;
      if (s.font.bold !== undefined) patch.bold = s.font.bold;
      if (s.font.italic !== undefined) patch.italic = s.font.italic;
    }
  }
  if (s.align && textual) patch.align = s.align;
  if (s.cornerRadius !== undefined && (t === "rect" || t === "spotlight" || t === "callout"))
    patch.cornerRadius = s.cornerRadius;
  return patch;
}

/**
 * Where the copied style is kept: the mark it came from, as JSON. Local
 * storage, so the editor and quick edit (pages of one origin) share it, and
 * the system clipboard keeps its image.
 */
const COPIED_KEY = "vandal.copiedStyle";

let notify: ((text: string) => void) | null = null;

/** Where Copy Style says it's done (the editor's status bar; quick edit has none). */
export function setStyleNotify(next: ((text: string) => void) | null): void {
  notify = next;
}

/** The mark whose style was last copied, if any. */
export function copiedStyle(): Annotation | null {
  try {
    const json = localStorage.getItem(COPIED_KEY);
    return json ? (JSON.parse(json) as Annotation) : null;
  } catch {
    return null;
  }
}

/**
 * Ctrl+Alt+C: the selected mark's style is the one Paste Style gives (with
 * several selected, the one whose values the options bar shows). False with
 * nothing selected.
 */
export function copyStyle(): boolean {
  const { doc, selection } = docStore.getState();
  if (!selection.length) return false;
  const lead = styleTarget(doc, selection, "select", null)?.ids[0];
  const source = doc.annotations.find((a) => a.id === lead);
  if (!source) return false;
  localStorage.setItem(COPIED_KEY, JSON.stringify(source));
  notify?.("Style copied");
  return true;
}

/**
 * Ctrl+Alt+V: the copied style onto every selected mark, as far as each has
 * a place for it (`stylePatchFor`), one undo step. False with no style copied
 * or nothing selected.
 */
export function pasteStyle(): boolean {
  const source = copiedStyle();
  const store = docStore.getState();
  if (!source || !store.selection.length) return false;
  store.beginGesture();
  for (const id of store.selection) {
    store.update(id, (a) => patchAnnotation(a, stylePatchFor(source, a)));
  }
  store.endGesture();
  return true;
}
