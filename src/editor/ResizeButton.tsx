import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { hint } from "../markup/HintLine";
import { docStore } from "../markup/model/store";
import { usePopover } from "../markup/usePopover";
import { resizeImage } from "./imageVersions";
import {
  fieldsFor,
  sizeOf,
  sizeProblem,
  typed,
  type ResizeFields,
  type ResizeUnit,
  type Size,
} from "./resizeMath";
import markupStyles from "../markup/markup.module.css";
import styles from "./ResizeButton.module.css";

/** Whether the popover is open: the button and Ctrl+Alt+I both toggle it. */
export const useResizeStore = create<{ open: boolean }>(() => ({ open: false }));

export function toggleResize(): void {
  useResizeStore.setState((s) => ({ open: !s.open }));
}

const closeResize = () => useResizeStore.setState({ open: false });

/**
 * Resize image (PLAN 3Z): the toolbar button and its popover. Width and
 * height in pixels or percent of the visible image, linked by the lock;
 * Resize or Enter applies (one undo step), Esc or a click elsewhere cancels.
 */
export function ResizeButton({ disabled }: { disabled: boolean }) {
  const open = useResizeStore((s) => s.open) && !disabled;
  const rootRef = useRef<HTMLDivElement>(null);
  // Closed when it can't be used (crop mode, an empty editor).
  useEffect(() => {
    if (disabled) closeResize();
  }, [disabled]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={markupStyles.tool}
        {...hint("tool.resize")}
        aria-label="Resize image (Ctrl+Alt+I)"
        aria-pressed={open}
        aria-expanded={open}
        title="Resize image (Ctrl+Alt+I)"
        disabled={disabled}
        onClick={toggleResize}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="11" width="10" height="10" rx="1.5" />
          <path d="M13 11l7-7" />
          <path d="M14.5 4H20v5.5" />
        </svg>
      </button>
      {open && <ResizePanel rootRef={rootRef} />}
    </div>
  );
}

function ResizePanel({ rootRef }: { rootRef: React.RefObject<HTMLDivElement | null> }) {
  // The visible image, as when the popover opened.
  const [base] = useState<Size>(() => {
    const { crop } = docStore.getState().doc;
    return { width: Math.round(crop.width), height: Math.round(crop.height) };
  });
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

  useEffect(() => {
    widthRef.current?.select();
  }, []);

  const apply = async () => {
    if (!size || !canApply) return;
    setBusy(true);
    setError(null);
    try {
      await resizeImage(size.width, size.height);
      closeResize();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  // Enter applies (a size that can't be made keeps the popover open); Esc and
  // a click elsewhere cancel.
  usePopover(
    true,
    rootRef,
    (keep) => {
      if (!keep) closeResize();
      else if (canApply) void apply();
      else if (unchanged) closeResize();
    },
    "cancel",
  );

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

  const field = (side: keyof ResizeFields, label: string) => (
    <>
      <span className={styles.label}>{label}</span>
      <label className={styles.field}>
        <input
          ref={side === "width" ? widthRef : undefined}
          inputMode="decimal"
          aria-label={`${label} (${unit === "px" ? "pixels" : "percent"})`}
          value={fields[side]}
          disabled={busy}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const text = e.target.value.replace(unit === "px" ? /[^\d]/g : /[^\d.]/g, "");
            setFields((f) => typed(f, side, text, base, unit, locked));
            setError(null);
          }}
        />
        <span className={styles.suffix}>{unit}</span>
      </label>
    </>
  );

  return (
    <div className={styles.panel} role="dialog" aria-label="Resize image">
      <div className={styles.title}>Resize image</div>
      <div className={styles.units} role="group" aria-label="Unit">
        {(["px", "%"] as const).map((u) => (
          <button
            key={u}
            type="button"
            className={styles.unit}
            aria-pressed={unit === u}
            onClick={() => setUnitTo(u)}
          >
            {u === "px" ? "Pixels" : "Percent"}
          </button>
        ))}
      </div>
      <div className={styles.sizes}>
        {field("width", "Width")}
        <button
          type="button"
          className={styles.lock}
          aria-pressed={locked}
          aria-label="Keep proportions"
          title={locked ? "Proportions kept: click to set each side" : "Keep proportions"}
          onClick={toggleLock}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d={locked ? "M8 11V8a4 4 0 0 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.6-1.8"} />
          </svg>
        </button>
        {field("height", "Height")}
      </div>
      <div className={`${styles.caption} ${error || problem ? styles.error : ""}`}>
        {error ??
          problem ??
          (size
            ? `${base.width} × ${base.height} → ${size.width} × ${size.height} px`
            : `${base.width} × ${base.height} px now`)}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={closeResize}>
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={!canApply}
          onClick={() => void apply()}
        >
          {busy ? "Resizing…" : "Resize"}
        </button>
      </div>
    </div>
  );
}
