import { hint } from "../markup/HintLine";
import { toggleResize, useResizeStore } from "./resizeStore";
import markupStyles from "../markup/markup.module.css";

/** The toolbar draws 1.6-unit round strokes; this icon is pixel-snapped instead. */
const CRISP = { strokeWidth: 1, strokeLinecap: "butt", strokeLinejoin: "miter" } as const;

/**
 * Resize image (PLAN 3Z): the toolbar button for resize mode, pressed while
 * it's on, as Crop's. Its controls are in the options bar (ResizeOptions).
 */
export function ResizeButton({ disabled }: { disabled: boolean }) {
  const active = useResizeStore((s) => s.active);
  return (
    <button
      type="button"
      className={markupStyles.tool}
      {...hint("tool.resize")}
      aria-label="Resize image (Ctrl+Alt+I)"
      aria-pressed={active}
      title="Resize image (Ctrl+Alt+I)"
      disabled={disabled}
      onClick={toggleResize}
    >
      {/* Drawn on the 20 px it's shown at, 1 px lines on half-pixels, so
          the dots stay crisp at 100% (on 24 units they smeared). */}
      <svg viewBox="0 0 20 20" style={CRISP} aria-hidden>
        {/* The image now (solid), growing into its new size (dotted, open
            where the solid one covers its corner). */}
        <path d="M6.5 10.5V2.5h11v11h-8" strokeDasharray="1 1" strokeDashoffset="0.5" />
        <rect x="2.5" y="10.5" width="7" height="7" />
        <path d="M9.5 10.5l4-4" />
        <path d="M10.5 6.5h3v3" />
      </svg>
    </button>
  );
}
