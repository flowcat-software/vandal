// The eyedropper's loupe (PLAN 3U): the pixels around the pointer, read from
// the frame the overlay already holds. Rust reads the picked pixel itself.

/** RGBA pixels, `width * 4` per row. */
export interface FramePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * The `n`×`n` pixels centred on (`cx`, `cy`) as RGBA. Pixels off the frame
 * are transparent, so the loupe's own background shows at the screen edges.
 */
export function loupePixels(frame: FramePixels, cx: number, cy: number, n: number) {
  const out = new Uint8ClampedArray(n * n * 4);
  const half = Math.floor(n / 2);
  for (let row = 0; row < n; row++) {
    const y = cy - half + row;
    if (y < 0 || y >= frame.height) continue;
    for (let col = 0; col < n; col++) {
      const x = cx - half + col;
      if (x < 0 || x >= frame.width) continue;
      const from = (y * frame.width + x) * 4;
      const to = (row * n + col) * 4;
      out[to] = frame.data[from];
      out[to + 1] = frame.data[from + 1];
      out[to + 2] = frame.data[from + 2];
      out[to + 3] = 255;
    }
  }
  return out;
}

/** The pixel at (`x`, `y`) as `#rrggbb`, or null off the frame. */
export function hexAt(frame: FramePixels, x: number, y: number): string | null {
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return null;
  const i = (y * frame.width + x) * 4;
  const hex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hex(frame.data[i])}${hex(frame.data[i + 1])}${hex(frame.data[i + 2])}`;
}
