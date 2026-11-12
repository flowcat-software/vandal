import { hint } from "./HintLine";
import type { ReactNode } from "react";
import { pickIntoChip } from "./eyedropper";
import { EyedropperIcon } from "./EyedropperIcon";
import { canRedo, canUndo, docStore, useDoc } from "./model/store";
import { keySuffix } from "./shortcuts";
import { useStyleConfig } from "./styles";
import { TOOL_BUTTONS } from "./toolIcons";
import { useToolStore, type ToolId } from "./toolStore";
import styles from "./markup.module.css";

interface Props {
  /** Host-only buttons after the tools (the editor's crop). */
  extra?: ReactNode;
  /** False while a host mode (crop) is active instead of a tool. */
  toolsActive?: boolean;
  /** Before a tool is picked (the editor applies a crop in progress). */
  onPickTool?: (tool: ToolId) => void;
  /** Nothing to mark up (an empty editor, PLAN 3G): every button is off. */
  disabled?: boolean;
  /** The eyedropper's button after the tools (PLAN 3Y.3). */
  eyedropper?: boolean;
}

/** Tools, then undo/redo. Shared by quick edit and the editor (PLAN §4.6). */
export function Toolbar({
  extra,
  toolsActive = true,
  onPickTool,
  disabled = false,
  eyedropper = false,
}: Props) {
  const tool = useToolStore((s) => s.tool);
  const undoable = useDoc(canUndo);
  const redoable = useDoc(canRedo);
  const keys = useStyleConfig((s) => s.shortcuts);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Tools">
      {TOOL_BUTTONS.map((b) => (
        <button
          key={b.id}
          type="button"
          className={styles.tool}
          {...hint(`tool.${b.id}`)}
          aria-label={`${b.label}${keySuffix(keys[b.id])}`}
          aria-pressed={toolsActive && !disabled && tool === b.id}
          title={`${b.label}${keySuffix(keys[b.id])}`}
          disabled={disabled}
          onClick={() => {
            onPickTool?.(b.id);
            useToolStore.getState().setTool(b.id);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            {b.icon}
          </svg>
        </button>
      ))}
      {extra}
      {eyedropper && (
        <button
          type="button"
          className={styles.tool}
          {...hint("tool.eyedropper")}
          aria-label={`Eyedropper${keySuffix(keys.eyedropper)}`}
          title={`Pick a color from the screen${keySuffix(keys.eyedropper)}`}
          disabled={disabled}
          onClick={() => void pickIntoChip()}
        >
          <EyedropperIcon className={styles.filledTool} />
        </button>
      )}
      <span className={styles.toolbarDivider} />
      <button
        type="button"
        className={styles.tool}
        {...hint("undo")}
        aria-label="Undo (Ctrl+Z)"
        title="Undo (Ctrl+Z)"
        disabled={disabled || !undoable}
        onClick={() => docStore.getState().undo()}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
        </svg>
      </button>
      <button
        type="button"
        className={styles.tool}
        {...hint("redo")}
        aria-label="Redo (Ctrl+Y)"
        title="Redo (Ctrl+Y)"
        disabled={disabled || !redoable}
        onClick={() => docStore.getState().redo()}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M15 14l5-5-5-5" />
          <path d="M20 9H10a6 6 0 0 0 0 12h3" />
        </svg>
      </button>
    </div>
  );
}
