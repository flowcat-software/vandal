import { describe, expect, it } from "vitest";
import { resizeDoc, versionsIn } from "./resize";
import { createDocStore } from "./store";
import { emptyDoc, type Annotation, type Doc } from "./types";

const style = { color: "#ff0000", width: 4, opacity: 1 };

/** A 400×300 image cropped to its 200×100 middle, at (100, 100). */
function doc(...annotations: Annotation[]): Doc {
  return {
    ...emptyDoc({ width: 400, height: 300 }, { x: 100, y: 100, width: 200, height: 100 }),
    annotations,
  };
}

const half = { version: 3, width: 100, height: 50 };

describe("resizeDoc", () => {
  it("makes the resized image the whole source, crop and version", () => {
    const out = resizeDoc(doc(), half);
    expect(out.source).toEqual({ width: 100, height: 50 });
    expect(out.crop).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(out.imageVersion).toBe(3);
  });

  it("moves points from the crop's corner and scales them", () => {
    const out = resizeDoc(
      doc(
        {
          id: "a",
          kind: "arrow",
          from: { x: 100, y: 100 },
          to: { x: 300, y: 200 },
          head: "filled",
          ends: "end",
          bend: { t: 0.5, d: 20 },
          style,
        },
        { id: "p", kind: "pen", points: [110, 120, 150, 140], style },
      ),
      half,
    );
    const [arrow, pen] = out.annotations;
    expect(arrow).toMatchObject({
      from: { x: 0, y: 0 },
      to: { x: 100, y: 50 },
      bend: { t: 0.5, d: 10 },
      style: { width: 2 },
    });
    expect(pen).toMatchObject({ points: [5, 10, 25, 20], style: { width: 2 } });
  });

  it("scales sizes: shapes, text, callouts, steps, spotlight, redaction", () => {
    const out = resizeDoc(
      doc(
        {
          id: "r",
          kind: "rect",
          rect: { x: 120, y: 110, width: 40, height: 20 },
          rotation: 30,
          fill: "none",
          fillColor: "#000",
          cornerRadius: 8,
          style,
        },
        {
          id: "t",
          kind: "text",
          x: 140,
          y: 120,
          width: 60,
          autoWidth: false,
          text: "Hi",
          fontFamily: "Arial",
          fontSize: 24,
          bold: false,
          italic: false,
          align: "left",
          rotation: 0,
          color: "#000",
          background: false,
          backgroundColor: "#fff",
        },
        {
          id: "c",
          kind: "callout",
          x: 100,
          y: 100,
          width: 80,
          autoWidth: true,
          text: "Hi",
          fontFamily: "Arial",
          fontSize: 14,
          bold: false,
          italic: false,
          align: "left",
          shape: "box",
          color: "#000",
          textColor: "#fff",
          lineWidth: 3,
          cornerRadius: 6,
          tip: { x: 200, y: 150 },
          end: "dot",
        },
        {
          id: "s",
          kind: "step",
          x: 200,
          y: 150,
          seq: 1,
          size: 32,
          shape: "circle",
          color: "#f00",
          textColor: "#fff",
          fontFamily: "Arial",
          format: "numbers",
          start: 1,
        },
        {
          id: "o",
          kind: "spotlight",
          rect: { x: 100, y: 100, width: 100, height: 50 },
          shape: "rect",
          dim: 50,
          cornerRadius: 4,
        },
        {
          id: "x",
          kind: "redact",
          rect: { x: 100, y: 100, width: 20, height: 20 },
          mode: "pixelate",
          strength: 10,
        },
      ),
      half,
    );
    const [rect, text, callout, step, spot, redact] = out.annotations;
    expect(rect).toMatchObject({
      rect: { x: 10, y: 5, width: 20, height: 10 },
      rotation: 30,
      cornerRadius: 4,
      style: { width: 2 },
    });
    expect(text).toMatchObject({ x: 20, y: 10, width: 30, fontSize: 12 });
    expect(callout).toMatchObject({
      x: 0,
      y: 0,
      width: 40,
      fontSize: 7,
      lineWidth: 1.5,
      cornerRadius: 3,
      tip: { x: 50, y: 25 },
    });
    expect(step).toMatchObject({ x: 50, y: 25, size: 16 });
    expect(spot).toMatchObject({ rect: { x: 0, y: 0, width: 50, height: 25 }, cornerRadius: 2 });
    expect(redact).toMatchObject({ rect: { x: 0, y: 0, width: 10, height: 10 }, strength: 5 });
  });

  it("keeps a redaction hiding at tiny sizes", () => {
    const tiny = { version: 1, width: 10, height: 5 };
    const out = resizeDoc(
      doc({
        id: "x",
        kind: "redact",
        rect: { x: 100, y: 100, width: 20, height: 20 },
        mode: "pixelate",
        strength: 10,
      }),
      tiny,
    );
    expect(out.annotations[0]).toMatchObject({ strength: 2 });
  });

  it("stretches positions per axis, and sizes by the mean, without the lock", () => {
    // 200×100 → 400×100: x doubles, y stays, sizes ×√2.
    const out = resizeDoc(
      doc({ id: "l", kind: "line", from: { x: 150, y: 150 }, to: { x: 200, y: 200 }, style }),
      { version: 1, width: 400, height: 100 },
    );
    expect(out.annotations[0]).toMatchObject({
      from: { x: 100, y: 50 },
      to: { x: 200, y: 100 },
      style: { width: 5.66 },
    });
  });

  it("is one undo step in the store, and undo brings the old image back", () => {
    const store = createDocStore(doc());
    store.getState().resize(half);
    expect(store.getState().doc.imageVersion).toBe(3);
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().doc.imageVersion).toBeUndefined();
    expect(store.getState().doc.source).toEqual({ width: 400, height: 300 });
  });
});

describe("versionsIn", () => {
  it("lists the resized versions a history reaches, not the loaded image", () => {
    const a = doc();
    const b = { ...a, imageVersion: 2 };
    const c = { ...a, imageVersion: 5 };
    expect(versionsIn([a, b, c, b]).sort()).toEqual([2, 5]);
  });
});
