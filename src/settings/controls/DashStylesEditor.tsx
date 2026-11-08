import type { PathSink } from "../../markup/dashCorners";
import { traceDashedRect } from "../../markup/dashCorners";
import {
  clampDash,
  DASH_GAP,
  DASH_LENGTH,
  MAX_DASH_LABEL,
  MAX_DASH_STYLES,
  svgDash,
  type DashStyle,
} from "../../markup/dashStyles";
import type { DashPattern } from "../../markup/model/types";
import { PlusIcon } from "../icons";
import type { DashStylesItem } from "../schema";
import { useSettingsStore } from "../store";
import type { ControlProps } from "./index";
import { moved, RowButtons, typedNumber, ValueField } from "./StyleList";
import { useDraft } from "./useDraft";
import styles from "./controls.module.css";

/** The shared dash styles (PLAN 3X): what the line style dropdown lists after Solid. */
export function DashStylesSetting({ item, id, disabled }: ControlProps<DashStylesItem>) {
  const list = useSettingsStore((s) => s.settings!.styles.dashes);
  const set = useSettingsStore((s) => s.set);
  return (
    <DashStylesList
      id={id}
      list={list}
      disabled={disabled}
      onChange={(next) => void set(item.path as never, next as never)}
    />
  );
}

/**
 * A list of dash styles, in the dropdown's order: the shared one, or a tool's
 * own ("Custom styles"). Each row previews its style as you type; Rust keeps
 * the values within the limits when they're saved. It may be emptied: Solid
 * is always there.
 */
export function DashStylesList({
  id,
  list,
  disabled,
  onChange,
}: {
  id?: string;
  list: DashStyle[];
  disabled: boolean;
  onChange: (list: DashStyle[]) => void;
}) {
  const change = (i: number, patch: Partial<DashStyle>) =>
    onChange(list.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <div id={id} className={styles.headStyles}>
      {list.map((d, i) => (
        <DashRow
          // By position: a row's drafts follow the style it shows (useDraft).
          key={i}
          style={d}
          index={i}
          count={list.length}
          disabled={disabled}
          onChange={(patch) => change(i, patch)}
          onMove={(by) => onChange(moved(list, i, by))}
          onRemove={() => onChange(list.filter((_, j) => j !== i))}
        />
      ))}
      <button
        type="button"
        className={styles.headAdd}
        disabled={disabled || list.length >= MAX_DASH_STYLES}
        title={list.length >= MAX_DASH_STYLES ? `At most ${MAX_DASH_STYLES} styles` : undefined}
        onClick={() => onChange([...list, { label: `Style ${list.length + 1}`, dash: 3, gap: 2 }])}
      >
        <PlusIcon />
        Add style
      </button>
      <p className={styles.help}>
        Dash and gap are in line widths, so a style looks the same on thin and thick lines: a dash
        of 1 is a dot. Dash {DASH_LENGTH.min}–{DASH_LENGTH.max}, gap {DASH_GAP.min}–{DASH_GAP.max}.
        Marks you&apos;ve drawn keep their dashes when you change a style.
      </p>
    </div>
  );
}

function DashRow({
  style,
  index,
  count,
  disabled,
  onChange,
  onMove,
  onRemove,
}: {
  style: DashStyle;
  index: number;
  count: number;
  disabled: boolean;
  onChange: (patch: Partial<DashStyle>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useDraft(style.label);
  const [dash, setDash] = useDraft(String(style.dash));
  const [gap, setGap] = useDraft(String(style.gap));
  // The preview follows what's typed, within the limits Rust will apply.
  const pattern = clampDash({
    dash: typedNumber(dash, style.dash),
    gap: typedNumber(gap, style.gap),
  });
  const commit = () => {
    const patch: Partial<DashStyle> = {};
    if (label.trim() !== style.label) patch.label = label.trim();
    if (pattern.dash !== style.dash) patch.dash = pattern.dash;
    if (pattern.gap !== style.gap) patch.gap = pattern.gap;
    if (Object.keys(patch).length) onChange(patch);
    else revert();
  };
  const revert = () => {
    setLabel(style.label);
    setDash(String(style.dash));
    setGap(String(style.gap));
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") revert();
  };
  const name = style.label || `Style ${index + 1}`;

  return (
    <div className={styles.headRow}>
      <DashPreview pattern={pattern} />
      <input
        className={`${styles.input} ${styles.headLabel}`}
        value={label}
        maxLength={MAX_DASH_LABEL}
        aria-label={`Style ${index + 1}: name`}
        spellCheck={false}
        disabled={disabled}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={keys}
      />
      <span className={styles.headShapeFields}>
        <ValueField
          label="Dash"
          title={`Dash length in line widths (${DASH_LENGTH.min}–${DASH_LENGTH.max}; 1 is a dot)`}
          ariaLabel={`${name}: dash length in line widths`}
          value={dash}
          disabled={disabled}
          onChange={setDash}
          onCommit={commit}
          onKeyDown={keys}
        />
        <ValueField
          label="Gap"
          title={`Gap in line widths (${DASH_GAP.min}–${DASH_GAP.max})`}
          ariaLabel={`${name}: gap in line widths`}
          value={gap}
          disabled={disabled}
          onChange={setGap}
          onCommit={commit}
          onKeyDown={keys}
        />
      </span>
      <RowButtons
        name={name}
        index={index}
        count={count}
        disabled={disabled}
        canRemove
        onMove={onMove}
        onRemove={onRemove}
      />
    </div>
  );
}

/** Builds an SVG path from what `traceDashedRect` draws. */
function svgPath(): { sink: PathSink; d: () => string } {
  const parts: string[] = [];
  const n = (v: number) => +v.toFixed(2);
  return {
    sink: {
      moveTo: (x, y) => parts.push(`M${n(x)} ${n(y)}`),
      lineTo: (x, y) => parts.push(`L${n(x)} ${n(y)}`),
      arc: (cx, cy, r, a0, a1) => {
        const p = (a: number) => `${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`;
        parts.push(`L${p(a0)}A${n(r)} ${n(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`);
      },
    },
    d: () => parts.join(""),
  };
}

/** The style on a thin and a thicker line, and on a rounded box's corners, as the canvas draws them. */
function DashPreview({ pattern }: { pattern: DashPattern }) {
  const box = svgPath();
  traceDashedRect(box.sink, 150, 7, 64, 30, 6, pattern, 3);
  return (
    <svg className={styles.headPreview} viewBox="0 0 220 44" aria-hidden>
      <path d="M4 14H134" strokeWidth={2} strokeDasharray={svgDash(pattern, 2)} />
      <path d="M5 31H133" strokeWidth={5} strokeDasharray={svgDash(pattern, 5)} />
      <path d={box.d()} strokeWidth={3} strokeLinejoin="miter" />
    </svg>
  );
}
