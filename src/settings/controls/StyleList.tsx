// Pieces the style list editors share (arrow heads, PLAN 3W; dash styles,
// PLAN 3X): a row's move and remove buttons, and its number fields.

import { RemoveIcon } from "../icons";
import styles from "./controls.module.css";

/** Move up, move down and remove, for row `index` of `count`. */
export function RowButtons({
  name,
  index,
  count,
  disabled,
  canRemove,
  removeTitle,
  onMove,
  onRemove,
}: {
  name: string;
  index: number;
  count: number;
  disabled: boolean;
  canRemove: boolean;
  /** Why it can't be removed, when it can't. */
  removeTitle?: string;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  return (
    <span className={`${styles.fontOrder} ${styles.headButtons}`}>
      <button
        type="button"
        className={styles.orderButton}
        aria-label={`Move ${name} up`}
        title="Move up"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        className={styles.orderButton}
        aria-label={`Move ${name} down`}
        title="Move down"
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        className={`${styles.orderButton} ${styles.headRemove}`}
        aria-label={`Remove ${name}`}
        title={canRemove ? "Remove" : removeTitle}
        disabled={disabled || !canRemove}
        onClick={onRemove}
      >
        <RemoveIcon size={10} />
      </button>
    </span>
  );
}

/** A small number field with a label before it and an optional unit after. */
export function ValueField({
  label,
  unit,
  title,
  ariaLabel,
  value,
  disabled,
  onChange,
  onCommit,
  onKeyDown,
}: {
  label: string;
  unit?: string;
  title: string;
  ariaLabel: string;
  value: string;
  disabled: boolean;
  onChange: (text: string) => void;
  onCommit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <label
      className={`${styles.valueChip} ${styles.headPercent} ${unit ? styles.withUnit : ""}`}
      title={title}
    >
      <span className={styles.chipValue}>
        <span className={styles.unit}>{label}</span>
        <input
          className={styles.valueInput}
          value={value}
          inputMode="decimal"
          aria-label={ariaLabel}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={onKeyDown}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
    </label>
  );
}

/** A typed number (a trailing `suffix` allowed), or `fallback` if it isn't one. */
export function typedNumber(text: string, fallback: number, suffix = ""): number {
  let t = text.trim();
  if (suffix && t.endsWith(suffix)) t = t.slice(0, -suffix.length).trim();
  const n = Number(t);
  return t !== "" && Number.isFinite(n) ? n : fallback;
}

/** `list` with rows `i` and `i + by` swapped. */
export function moved<T>(list: readonly T[], i: number, by: number): T[] {
  const next = [...list];
  [next[i], next[i + by]] = [next[i + by], next[i]];
  return next;
}
