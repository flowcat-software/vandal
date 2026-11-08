import { arrowGeometry } from "../../markup/geometry";
import {
  clampHeadShape,
  HEAD_LENGTH,
  HEAD_WIDTH,
  MAX_HEAD_LABEL,
  MAX_HEAD_STYLES,
  type HeadStyle,
} from "../../markup/headStyles";
import type { ArrowHead, HeadShape } from "../../markup/model/types";
import { PlusIcon } from "../icons";
import type { ArrowHeadsItem } from "../schema";
import { useSettingsStore } from "../store";
import type { ControlProps } from "./index";
import { Switch } from "./Switch";
import { moved, RowButtons, typedNumber, ValueField } from "./StyleList";
import { useDraft } from "./useDraft";
import styles from "./controls.module.css";

/**
 * The arrow's head styles (PLAN 3W): the options bar's list, in its order.
 * Each row previews its style on thin, medium and thick lines as you type;
 * Rust keeps the values within the limits when they're saved.
 */
export function ArrowHeadsSetting({ item, id, disabled }: ControlProps<ArrowHeadsItem>) {
  const list = useSettingsStore((s) => s.settings!.styles.arrowHeads);
  const set = useSettingsStore((s) => s.set);
  const update = (next: HeadStyle[]) => void set(item.path as never, next as never);
  const change = (i: number, patch: Partial<HeadStyle>) =>
    update(list.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const move = (i: number, by: number) => update(moved(list, i, by));

  return (
    <div id={id} className={styles.headStyles}>
      {list.map((h, i) => (
        <HeadRow
          // By position: a row's drafts follow the style it shows (useDraft).
          key={i}
          style={h}
          index={i}
          count={list.length}
          disabled={disabled}
          onChange={(patch) => change(i, patch)}
          onMove={(by) => move(i, by)}
          onRemove={() => update(list.filter((_, j) => j !== i))}
        />
      ))}
      <button
        type="button"
        className={styles.headAdd}
        disabled={disabled || list.length >= MAX_HEAD_STYLES}
        title={list.length >= MAX_HEAD_STYLES ? `At most ${MAX_HEAD_STYLES} styles` : undefined}
        onClick={() =>
          update([
            ...list,
            { label: `Style ${list.length + 1}`, head: "filled", width: 100, length: 100 },
          ])
        }
      >
        <PlusIcon />
        Add style
      </button>
      <p className={styles.help}>
        Width and length are a percentage of the regular head: width {HEAD_WIDTH.min}–
        {HEAD_WIDTH.max}%, length {HEAD_LENGTH.min}–{HEAD_LENGTH.max}%. Arrows you&apos;ve drawn
        keep their heads when you change a style.
      </p>
    </div>
  );
}

function HeadRow({
  style,
  index,
  count,
  disabled,
  onChange,
  onMove,
  onRemove,
}: {
  style: HeadStyle;
  index: number;
  count: number;
  disabled: boolean;
  onChange: (patch: Partial<HeadStyle>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useDraft(style.label);
  const [width, setWidth] = useDraft(String(style.width));
  const [length, setLength] = useDraft(String(style.length));
  const num = (text: string, fallback: number) => typedNumber(text, fallback, "%");
  // The preview follows what's typed, within the limits Rust will apply.
  const shape = clampHeadShape({
    width: num(width, style.width),
    length: num(length, style.length),
  });
  const commit = () => {
    const patch: Partial<HeadStyle> = {};
    if (label.trim() !== style.label) patch.label = label.trim();
    if (shape.width !== style.width) patch.width = shape.width;
    if (shape.length !== style.length) patch.length = shape.length;
    if (Object.keys(patch).length) onChange(patch);
    else revert();
  };
  const revert = () => {
    setLabel(style.label);
    setWidth(String(style.width));
    setLength(String(style.length));
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") revert();
  };
  const name = style.label || `Style ${index + 1}`;

  return (
    <div className={styles.styleRow}>
      <HeadPreview head={style.head} shape={shape} />
      <span className={styles.styleMain}>
        <input
          className={`${styles.input} ${styles.styleLabel}`}
          value={label}
          maxLength={MAX_HEAD_LABEL}
          aria-label={`Style ${index + 1}: name`}
          spellCheck={false}
          disabled={disabled}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={keys}
        />
        <span className={styles.styleFields}>
          <label className={styles.headOpen}>
            Open
            <Switch
              checked={style.head === "open"}
              showState={false}
              disabled={disabled}
              label={`${name}: open head`}
              onChange={(open) => onChange({ head: open ? "open" : "filled" })}
            />
          </label>
          <span className={styles.styleFieldGroup}>
            <ValueField
              label="W"
              unit="%"
              title={`Width (${HEAD_WIDTH.min}–${HEAD_WIDTH.max}%)`}
              ariaLabel={`${name}: width in percent`}
              value={width}
              disabled={disabled}
              onChange={setWidth}
              onCommit={commit}
              onKeyDown={keys}
            />
            <ValueField
              label="L"
              unit="%"
              title={`Length (${HEAD_LENGTH.min}–${HEAD_LENGTH.max}%)`}
              ariaLabel={`${name}: length in percent`}
              value={length}
              disabled={disabled}
              onChange={setLength}
              onCommit={commit}
              onKeyDown={keys}
            />
          </span>
        </span>
      </span>
      <RowButtons
        name={name}
        index={index}
        count={count}
        disabled={disabled}
        canRemove={count > 1}
        removeTitle="The list needs at least one style"
        onMove={onMove}
        onRemove={onRemove}
      />
    </div>
  );
}

/** The preview: one arrow on a medium line (the options bar shows the rest). */
const PREVIEW_WIDTH = 4;
const PREVIEW_LENGTH = 64;

function previewArrow(head: ArrowHead, shape: HeadShape) {
  return arrowGeometry(
    { x: PREVIEW_WIDTH / 2, y: 0 },
    { x: PREVIEW_LENGTH - PREVIEW_WIDTH / 2, y: 0 },
    head,
    PREVIEW_WIDTH,
    "end",
    undefined,
    shape,
  );
}

/**
 * Half the preview's height: room for the widest head allowed (open heads'
 * strokes included), so every style shows at the same scale.
 */
const PREVIEW_HALF = Math.max(
  ...(["filled", "open"] as const).flatMap((head) =>
    previewArrow(head, { width: HEAD_WIDTH.max, length: 100 }).heads.flatMap((pts) =>
      pts.map((p) => Math.abs(p.y) + PREVIEW_WIDTH / 2),
    ),
  ),
);

/** The style drawn by the canvas's own geometry, so it looks as it will. */
function HeadPreview({ head, shape }: { head: ArrowHead; shape: HeadShape }) {
  const g = previewArrow(head, shape);
  if (g.shaft.kind !== "line") return null;
  const [x1, y1, x2, y2] = g.shaft.points;
  const wings = g.heads.map(([l, t, r]) => `M${l.x} ${l.y}L${t.x} ${t.y}L${r.x} ${r.y}`);
  const h = Math.ceil(PREVIEW_HALF);
  return (
    <svg
      className={styles.stylePreview}
      viewBox={`0 ${-h} ${PREVIEW_LENGTH} ${2 * h}`}
      strokeWidth={PREVIEW_WIDTH}
      aria-hidden
    >
      <path d={`M${x1} ${y1}L${x2} ${y2}${head === "open" ? wings.join("") : ""}`} />
      {head === "filled" && <path className={styles.headFill} d={`${wings.join("Z")}Z`} />}
    </svg>
  );
}
