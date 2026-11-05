// Accent colors (PLAN 3A.2): the text color on one. A picked accent is used as it is, in
// both themes: it's the user's choice, bright or not (Richard, 2026-10-23; it
// used to be darkened or lightened to stand out, which muted bright colors).
// The Windows accent comes with Windows' own shades.

type Rgb = [number, number, number];

function parse(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance, 0–1. */
function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, 1–21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export interface AccentShades {
  /** For light mode. */
  light: string;
  /** For dark mode. */
  dark: string;
}

/** Text on an accent-filled button: white or near-black, whichever reads better. */
export function onAccent(hex: string): string {
  return contrast(hex, "#ffffff") >= contrast(hex, "#111111") ? "#ffffff" : "#111111";
}
