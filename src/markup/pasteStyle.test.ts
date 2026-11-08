import { beforeEach, describe, expect, it, vi } from "vitest";
import { docStore } from "./model/store";
import { emptyDoc, type Annotation, type ShapeAnnotation } from "./model/types";
import { copiedStyle, copyStyle, pasteStyle, stylePatchFor } from "./pasteStyle";

const body = { x: 0, y: 0, width: 50, autoWidth: true, text: "Hi" };
const text: Annotation = {
  id: "t",
  kind: "text",
  ...body,
  fontFamily: "Georgia",
  fontSize: 24,
  bold: true,
  italic: false,
  align: "center",
  rotation: 0,
  color: "#111111",
  background: true,
  backgroundColor: "#ffff00",
};
const callout: Annotation = {
  id: "c",
  kind: "callout",
  ...body,
  fontFamily: "Arial",
  fontSize: 14,
  bold: false,
  italic: true,
  align: "left",
  shape: "outline",
  color: "#0000ff",
  textColor: "#ffffff",
  lineWidth: 3,
  cornerRadius: 6,
  end: "dot",
  tip: { x: 100, y: 100 },
};
const rect: Annotation = {
  id: "r",
  kind: "rect",
  rect: { x: 0, y: 0, width: 10, height: 10 },
  rotation: 0,
  fill: "both",
  fillColor: "#00ff00",
  cornerRadius: 4,
  style: { color: "#ff0000", width: 8, opacity: 1 },
};
const arrow: Annotation = {
  id: "a",
  kind: "arrow",
  from: { x: 0, y: 0 },
  to: { x: 10, y: 10 },
  head: "open",
  ends: "both",
  style: { color: "#ff00ff", width: 5, opacity: 1 },
};
const step: Annotation = {
  id: "s",
  kind: "step",
  x: 0,
  y: 0,
  seq: 1,
  size: 32,
  shape: "square",
  color: "#e53935",
  textColor: "#000000",
  fontFamily: "Segoe UI",
  format: "letters",
  start: 3,
};

describe("Paste Style", () => {
  it("gives the same kind the whole style, never the text or the place", () => {
    expect(stylePatchFor(text, { ...text, id: "t2" })).toEqual({
      color: "#111111",
      fontFamily: "Georgia",
      fontSize: 24,
      bold: true,
      italic: false,
      align: "center",
      background: true,
      backgroundColor: "#ffff00",
    });
    expect(stylePatchFor(rect, { ...rect, id: "r2" })).toEqual({
      color: "#ff0000",
      width: 8,
      fill: "both",
      fillColor: "#00ff00",
      cornerRadius: 4,
      dash: null,
    });
    expect(stylePatchFor(arrow, { ...arrow, id: "a2" })).toMatchObject({
      head: "open",
      ends: "both",
    });
  });

  it("keeps the step labels' shared format and start to themselves", () => {
    const patch = stylePatchFor(step, { ...step, id: "s2" });
    expect(patch).toEqual({
      color: "#e53935",
      textColor: "#000000",
      fontFamily: "Segoe UI",
      stepShape: "square",
      stepSize: 32,
    });
  });

  it("carries text colour, background and font to callouts, the background to the box", () => {
    expect(stylePatchFor(text, callout)).toEqual({
      color: "#ffff00",
      textColor: "#111111",
      fontFamily: "Georgia",
      fontSize: 24,
      bold: true,
      italic: false,
      align: "center",
    });
    // Back: the callout's text colour is the text's ink; an outlined box isn't a background.
    expect(stylePatchFor(callout, text)).toEqual({
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: 14,
      bold: false,
      italic: true,
      align: "left",
    });
  });

  it("gives a callout's box or a step marker a fill, else a line colour", () => {
    // Solid strokes make the pointer solid too (PLAN 3X).
    expect(stylePatchFor(arrow, callout)).toEqual({ color: "#ff00ff", width: 5, dash: null });
    expect(stylePatchFor(rect, callout)).toEqual({
      color: "#00ff00",
      width: 8,
      cornerRadius: 4,
      dash: null,
    });
    // A text's background is a step marker's fill.
    expect(stylePatchFor(text, step)).toEqual({
      color: "#ffff00",
      textColor: "#111111",
      fontFamily: "Georgia",
    });
    expect(stylePatchFor(arrow, step)).toEqual({ color: "#ff00ff" });
  });

  it("carries fills between shapes, and gives an outlined shape another kind's fill", () => {
    const ellipse = { ...rect, id: "e", kind: "ellipse", fill: "none" } as Annotation;
    const solid = { ...rect, fill: "solid" } as Annotation;
    expect(stylePatchFor(solid, ellipse)).toEqual({
      color: "#ff0000",
      width: 8,
      fill: "solid",
      fillColor: "#00ff00",
      dash: null,
    });
    // A text's background, its colour not: the border stays.
    expect(stylePatchFor(text, ellipse)).toEqual({ fill: "both", fillColor: "#ffff00" });
    // A solid shape's colour is its fill.
    expect(stylePatchFor(callout, solid)).toEqual({
      color: "#0000ff",
      width: 3,
      cornerRadius: 6,
      dash: null,
    });
  });

  it("carries line colour and width between shapes and lines, and fills to text backgrounds", () => {
    expect(stylePatchFor(rect, arrow)).toEqual({ color: "#ff0000", width: 8, dash: null });
    expect(stylePatchFor(arrow, rect)).toEqual({ color: "#ff00ff", width: 5, dash: null });
    // Text takes only a text colour: a shape's fill as its background, its border nothing.
    expect(stylePatchFor(rect, text)).toEqual({ background: true, backgroundColor: "#00ff00" });
    expect(stylePatchFor(arrow, text)).toEqual({});
    // Nor does a text's colour go to a line (its background would, as a fill).
    expect(stylePatchFor({ ...text, background: false } as Annotation, arrow)).toEqual({});
    expect(stylePatchFor(text, arrow)).toEqual({ color: "#ffff00" });
  });
});

describe("Paste Style's dashes (PLAN 3X)", () => {
  it("carries a pattern between lines, shapes and callouts, and not to the rest", () => {
    const dashed = {
      ...arrow,
      style: { ...(arrow as { style: object }).style, dash: { dash: 1, gap: 1.5 } },
    } as Annotation;
    expect(stylePatchFor(dashed, rect).dash).toEqual({ dash: 1, gap: 1.5 });
    expect(stylePatchFor(dashed, callout).dash).toEqual({ dash: 1, gap: 1.5 });
    expect(stylePatchFor(dashed, step)).not.toHaveProperty("dash");
    expect(stylePatchFor(dashed, text)).not.toHaveProperty("dash");
    // Nothing to say about dashes: a step marker's style leaves a line's alone.
    expect(stylePatchFor(step, dashed)).not.toHaveProperty("dash");
  });
});

describe("Copy Style and Paste Style", () => {
  beforeEach(() => {
    const kept = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => kept.set(k, v),
    });
    docStore.getState().load(emptyDoc({ width: 100, height: 100 }));
  });

  const add = (a: Annotation) => docStore.getState().add(a);
  const get = (id: string) =>
    docStore.getState().doc.annotations.find((a) => a.id === id) as ShapeAnnotation;

  it("copies nothing with nothing selected, and pastes nothing before a copy", () => {
    expect(copyStyle()).toBe(false);
    expect(copiedStyle()).toBeNull();
    docStore.getState().select([add(rect)]);
    expect(pasteStyle()).toBe(false);
  });

  it("pastes the copied style onto every selected mark as one undo step", () => {
    const from = add(rect);
    const a = add({ ...rect, style: { color: "#000000", width: 2, opacity: 1 }, fill: "none" });
    const b = add({ ...rect, kind: "ellipse", style: { color: "#000000", width: 2, opacity: 1 } });
    docStore.getState().select([from]);
    expect(copyStyle()).toBe(true);
    docStore.getState().select([a, b]);
    const before = docStore.getState().past.length;
    expect(pasteStyle()).toBe(true);
    for (const id of [a, b]) {
      expect(get(id).style).toMatchObject({ color: "#ff0000", width: 8 });
      expect(get(id).fill).toBe("both");
    }
    expect(docStore.getState().past.length).toBe(before + 1);
  });
});
