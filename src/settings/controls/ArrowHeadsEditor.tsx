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
import { Segmented } from "./Segmented";
import { moved, RowButtons, typedNumber, ValueField } from "./StyleList";
import { useDraft } from "./useDraft";
import styles from "./controls.module.css";

const FILLS = [
  { value: "filled", label: "Filled" },
  { value: "open", label: "Open" },
] as const;

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
    <div className={styles.headRow}>
      <HeadPreview head={style.head} shape={shape} />
      <input
        className={`${styles.input} ${styles.headLabel}`}
        value={label}
        maxLength={MAX_HEAD_LABEL}
        aria-label={`Style ${index + 1}: name`}
        spellCheck={false}
        disabled={disabled}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={keys}
      />
      <span className={styles.headShapeFields}>
        <Segmented
          label={`${name}: head`}
          options={FILLS}
          value={style.head}
          disabled={disabled}
          onChange={(head) => onChange({ head })}
        />
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

/**
 * The preview's line width and arrow length: long enough for most heads to
 * show at full size, not scaled down for a short arrow. One medium arrow
 * (Richard): the options bar is where to try a style on other widths.
 */
const PREVIEW_ARROWS = [{ width: 5, length: 80 }];
const PREVIEW_GAP = 16;
/** Tall enough for the widest head allowed on the thickest line. */
const PREVIEW_HEIGHT = 58;

/** The style drawn by the canvas's own geometry, so it looks as it will. */
function HeadPreview({ head, shape }: { head: ArrowHead; shape: HeadShape }) {
  const starts = PREVIEW_ARROWS.map((_, i) =>
    PREVIEW_ARROWS.slice(0, i).reduce((x, a) => x + a.length + PREVIEW_GAP, 0),
  );
  const w = starts[starts.length - 1] + PREVIEW_ARROWS[PREVIEW_ARROWS.length - 1].length;
  const y = PREVIEW_HEIGHT / 2;
  return (
    <svg
      className={`${styles.headPreview} ${styles.arrowPreview}`}
      viewBox={`0 0 ${w} ${PREVIEW_HEIGHT}`}
      aria-hidden
    >
      {PREVIEW_ARROWS.map(({ width: lw, length }, i) => {
        const x = starts[i];
        const g = arrowGeometry(
          { x: x + lw / 2, y },
          { x: x + length, y },
          head,
          lw,
          "end",
          undefined,
          shape,
        );
        if (g.shaft.kind !== "line") return null;
        const [x1, y1, x2, y2] = g.shaft.points;
        const wings = g.heads.map(([l, t, r]) => `M${l.x} ${l.y}L${t.x} ${t.y}L${r.x} ${r.y}`);
        return (
          <g key={lw} strokeWidth={lw}>
            <path d={`M${x1} ${y1}L${x2} ${y2}${head === "open" ? wings.join("") : ""}`} />
            {head === "filled" && <path className={styles.headFill} d={`${wings.join("Z")}Z`} />}
          </g>
        );
      })}
    </svg>
  );
}
