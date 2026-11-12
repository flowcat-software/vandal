// Resize image's fields (PLAN 3Z): pixels or percent of the visible image,
// width and height linked while the aspect ratio is locked, and the limits
// Rust enforces (resample.rs), checked here first so the popover can say why.

export type ResizeUnit = "px" | "%";

export interface Size {
  width: number;
  height: number;
}

/** As `resample::MAX_SIDE` and `MAX_PIXELS`. */
export const MAX_SIDE = 16_384;
export const MAX_PIXELS = 100_000_000;

/** The fields' text: what's typed, in `unit`. */
export interface ResizeFields {
  width: string;
  height: string;
}

const tidy = (v: number) => String(Math.round(v * 100) / 100);

/** The fields for `size` of `base`, in `unit`. */
export function fieldsFor(size: Size, base: Size, unit: ResizeUnit): ResizeFields {
  return unit === "px"
    ? { width: String(size.width), height: String(size.height) }
    : {
        width: tidy((size.width / base.width) * 100),
        height: tidy((size.height / base.height) * 100),
      };
}

/** The size the fields ask for, or null while one isn't a number above 0. */
export function sizeOf(fields: ResizeFields, base: Size, unit: ResizeUnit): Size | null {
  const w = Number(fields.width);
  const h = Number(fields.height);
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  return unit === "px"
    ? { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) }
    : {
        width: Math.max(1, Math.round((base.width * w) / 100)),
        height: Math.max(1, Math.round((base.height * h) / 100)),
      };
}

/**
 * `fields` with one side typed: with the lock, the other side follows (the
 * same % or the proportional px); without it, only that side changes.
 */
export function typed(
  fields: ResizeFields,
  side: keyof ResizeFields,
  text: string,
  base: Size,
  unit: ResizeUnit,
  locked: boolean,
): ResizeFields {
  const next = { ...fields, [side]: text };
  const v = Number(text);
  if (!locked || !(v > 0) || !Number.isFinite(v)) return next;
  const other = side === "width" ? "height" : "width";
  if (unit === "%") return { ...next, [other]: text };
  const ratio = side === "width" ? base.height / base.width : base.width / base.height;
  return { ...next, [other]: String(Math.max(1, Math.round(v * ratio))) };
}

/** Why `size` can't be made (as Rust would refuse it), or null. */
export function sizeProblem(size: Size): string | null {
  if (size.width > MAX_SIDE || size.height > MAX_SIDE)
    return `A side can be at most ${MAX_SIDE.toLocaleString()} pixels.`;
  if (size.width * size.height > MAX_PIXELS)
    return `That's ${Math.round((size.width * size.height) / 1e6)} megapixels; the most is ${MAX_PIXELS / 1e6}.`;
  return null;
}
