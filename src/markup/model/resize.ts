// Resize image (PLAN 3Z): the document moved onto a resampled image. Rust
// resamples the visible part (the crop) to the new size; the new image is the
// whole source, so the crop covers it, and every mark scales with it, so the
// picture looks the same, only bigger or smaller.

import { redactStrength } from "../redact";
import type { Annotation, Bend, Doc, Point, Rect } from "./types";

/** The resampled image Rust made: its version and size. */
export interface ResizedImage {
  version: number;
  width: number;
  height: number;
}

/** Sizes are kept to 2 decimals: scaled marks look the same, without 13.333333…. */
const round = (v: number) => Math.round(v * 100) / 100;

/**
 * `doc` on the resized image. Positions scale per axis; sizes that have no
 * direction (line widths, fonts, markers, radii, blur) by the geometric mean
 * of the two, which is the factor itself when the aspect ratio is kept.
 */
export function resizeDoc(doc: Doc, image: ResizedImage): Doc {
  const { crop } = doc;
  const sx = image.width / crop.width;
  const sy = image.height / crop.height;
  const s = Math.sqrt(sx * sy);
  const size = (v: number) => round(v * s);
  const point = (p: Point): Point => ({
    x: round((p.x - crop.x) * sx),
    y: round((p.y - crop.y) * sy),
  });
  const rect = (r: Rect): Rect => ({
    ...point(r),
    width: round(r.width * sx),
    height: round(r.height * sy),
  });
  const bend = (b: Bend | undefined) => b && { t: b.t, d: size(b.d) };
  const points = (flat: number[]) =>
    flat.map((v, i) => round(i % 2 === 0 ? (v - crop.x) * sx : (v - crop.y) * sy));

  const scale = (a: Annotation): Annotation => {
    switch (a.kind) {
      case "pen":
      case "highlighter":
        return {
          ...a,
          points: points(a.points),
          style: { ...a.style, width: size(a.style.width) },
        };
      case "line":
        return {
          ...a,
          from: point(a.from),
          to: point(a.to),
          ...(a.bend && { bend: bend(a.bend) }),
          style: { ...a.style, width: size(a.style.width) },
        };
      case "arrow":
        return {
          ...a,
          from: point(a.from),
          to: point(a.to),
          ...(a.bend && { bend: bend(a.bend) }),
          style: { ...a.style, width: size(a.style.width) },
        };
      case "rect":
      case "ellipse":
        return {
          ...a,
          rect: rect(a.rect),
          ...(a.cornerRadius !== undefined && { cornerRadius: size(a.cornerRadius) }),
          style: { ...a.style, width: size(a.style.width) },
        };
      case "text":
        return {
          ...a,
          ...point(a),
          width: round(a.width * sx),
          fontSize: size(a.fontSize),
        };
      case "callout":
        return {
          ...a,
          ...point(a),
          width: round(a.width * sx),
          fontSize: size(a.fontSize),
          lineWidth: size(a.lineWidth),
          cornerRadius: size(a.cornerRadius),
          tip: point(a.tip),
        };
      case "redact":
        return { ...a, rect: rect(a.rect), strength: redactStrength(a.mode, a.strength * s) };
      case "spotlight":
        return {
          ...a,
          rect: rect(a.rect),
          ...(a.cornerRadius !== undefined && { cornerRadius: size(a.cornerRadius) }),
        };
      case "step":
        return { ...a, ...point(a), size: size(a.size) };
    }
  };

  return {
    ...doc,
    source: { width: image.width, height: image.height },
    crop: { x: 0, y: 0, width: image.width, height: image.height },
    imageVersion: image.version,
    annotations: doc.annotations.map(scale),
  };
}

/** The image versions a set of documents (the history) shows: Rust keeps these. */
export function versionsIn(docs: readonly Doc[]): number[] {
  return [...new Set(docs.map((d) => d.imageVersion ?? 0))].filter((v) => v !== 0);
}
