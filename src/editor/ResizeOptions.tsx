import { useEffect, useRef, useState } from "react";
import { useDoc } from "../markup/model/store";
import { resizeImage } from "./imageVersions";
import { endResize } from "./resizeStore";
import { tabBetweenSizeBoxes } from "./sizeTab";
import {
  fieldsFor,
  sizeOf,
  sizeProblem,
  typed,
  type ResizeFields,
  type ResizeUnit,
  type Size,
} from "./resizeMath";
import styles from "../markup/options.module.css";

/**
 * Resize mode's options bar (PLAN 3Z): Pixels or Percent of the visible
 * image, width and height with a padlock between them that keeps the
 * proportions, what the size becomes, and Resize (Enter). Esc, a tool or crop
 * leave without resizing.
 */
export function ResizeOptions() {
  const crop = useDoc((s) => s.doc.crop);
  const base: Size = { width: Math.round(crop.width), height: Math.round(crop.height) };
  // Remounted (fresh fields) when the image under it changes: an undo, a crop.
  return <ResizeBar key={`${base.width}x${base.height}`} base={base} />;
}

function ResizeBar({ base }: { base: Size }) {
  const [unit, setUnit] = useState<ResizeUnit>("px");
  const [locked, setLocked] = useState(true);
  const [fields, setFields] = useState<ResizeFields>(() => fieldsFor(base, base, "px"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widthRef = useRef<HTMLInputElement>(null);

  const size = sizeOf(fields, base, unit);
  const problem = size && sizeProblem(size);
  const unchanged = !!size && size.width === base.width && size.height === base.height;
  const canApply = !!size && !problem && !unchanged && !busy;

  // Ready to type a width straight away.
  useEffect(() => {
    widthRef.current?.focus();
    widthRef.current?.select();
  }, []);

  const apply = async () => {
    // Nothing to change: Enter just leaves, as crop's does.
    if (unchanged) return endResize();
    if (!size || !canApply) return;
    setBusy(true);
    setError(null);
    try {
      await resizeImage(size.width, size.height);
      endResize();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  // The mode's Enter (useResizeKeys) applies through here.
  useEffect(() => {
    resizeAction.apply = () => void apply();
    return () => {
      resizeAction.apply = null;
    };
  });

  const setUnitTo = (next: ResizeUnit) => {
    if (next === unit) return;
    // The same size, spelled in the other unit.
    setFields(fieldsFor(size ?? base, base, next));
    setUnit(next);
  };

  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    // Locking again: the height follows the width.
    if (next) setFields((f) => typed(f, "width", f.width, base, unit, true));
  };

  const field = (side: keyof ResizeFields) => (
    <input
      ref={side === "width" ? widthRef : undefined}
      className={styles.colorField}
      inputMode="decimal"
      aria-label={`${side === "width" ? "Width" : "Height"} (${unit === "px" ? "pixels" : "percent"})`}
      value={fields[side]}
      disabled={busy}
      onFocus={(e) => e.target.select()}
      onKeyDown={tabBetweenSizeBoxes}
      onChange={(e) => {
        const text = e.target.value.replace(unit === "px" ? /[^\d]/g : /[^\d.]/g, "");
        setFields((f) => typed(f, side, text, base, unit, locked));
        setError(null);
      }}
    />
  );

  const message = error ?? problem;
  return (
    <div className={styles.options}>
      <div className={styles.group} role="radiogroup" aria-label="Unit">
        {(["px", "%"] as const).map((u) => (
          <button
            key={u}
            type="button"
            role="radio"
            className={`${styles.toggle} ${styles.ratio}`}
            aria-checked={unit === u}
            aria-pressed={unit === u}
            onClick={() => setUnitTo(u)}
          >
            {u === "px" ? "Pixels" : "Percent"}
          </button>
        ))}
      </div>
      <span className={styles.sep} />
      {/* "W × H", then the two boxes and the padlock as one unit, and the
          unit once at the end: one size, linked. */}
      <span className={styles.sizePair}>
        <span className={styles.sizeLabel} aria-hidden>
          W × H
        </span>
        {field("width")}
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={locked}
          // Tab goes between the boxes only, for now (sizeTab.ts).
          tabIndex={-1}
          aria-label="Keep proportions"
          title={locked ? "Proportions kept: click to set each side" : "Keep proportions"}
          onClick={toggleLock}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d={locked ? "M8 11V8a4 4 0 0 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.6-1.8"} />
          </svg>
        </button>
        {field("height")}
        <span className={styles.sizeLabel}>{unit}</span>
      </span>
      <span className={styles.sep} />
      <span className={message ? styles.resizeError : styles.resizeCaption} role="status">
        {message ??
          (size ? (
            <>
              {base.width} × {base.height}
              {/* Set apart, so the line doesn't run together into one gray blur. */}
              <span className={`${styles.resizeDim} ${styles.resizeArrow}`} aria-label="becomes">
                →
              </span>
              {size.width} × {size.height} px
            </>
          ) : (
            `${base.width} × ${base.height} px`
          ))}
      </span>
      <span className={styles.optionsSpacer} />
      <button
        type="button"
        className={styles.accentButton}
        title="Resize (Enter)"
        disabled={!canApply}
        onClick={() => void apply()}
      >
        {busy ? "Resizing…" : "Resize"}
      </button>
    </div>
  );
}

/** How the mode's keys reach the bar's Resize. */
export const resizeAction: { apply: (() => void) | null } = { apply: null };
