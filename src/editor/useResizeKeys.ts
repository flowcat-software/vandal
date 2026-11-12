// Resize mode's keys (PLAN 3Z), as crop mode's (useCropKeys.ts). Ctrl+Alt+I
// enters and leaves it. While resizing: Enter resizes, Esc leaves, a tool's
// shortcut leaves for that tool and crop's for crop mode; the fields take
// typing. Other markup shortcuts are held back (nothing to select or
// restyle), but saving, copying, undo, zooming and panning still work.

import { useEffect, useRef } from "react";
import { shortcutOf } from "../markup/shortcuts";
import { useStyleConfig } from "../markup/styles";
import { isTool, useToolStore } from "../markup/toolStore";
import { isTyping } from "../shared/dom";
import { beginCrop } from "./cropStore";
import { resizeAction } from "./ResizeOptions";
import { endResize, isResizing, toggleResize } from "./resizeStore";

/** `active` (read on each key) switches them off, e.g. in an empty editor. */
export function useResizeKeys(active?: () => boolean): void {
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeRef.current && !activeRef.current()) return;
      // As Photoshop's Image Size and Affinity's Resize Document.
      if (e.ctrlKey && e.altKey && !e.shiftKey && e.code === "KeyI") {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleResize();
        return;
      }
      if (!isResizing()) return;
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        resizeAction.apply?.();
        return;
      }
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        endResize();
        return;
      }
      // The fields' own typing, and Ctrl's editor shortcuts (copy, save, undo, zoom).
      if (isTyping(e.target) || e.ctrlKey || e.code === "Space") return;
      const id = shortcutOf(e, useStyleConfig.getState().shortcuts);
      e.stopImmediatePropagation();
      e.preventDefault();
      if (id === "crop") {
        endResize();
        beginCrop();
      } else if (id && isTool(id)) {
        endResize();
        useToolStore.getState().setTool(id);
      }
    };
    // Capture phase: ahead of the markup's and crop's own shortcuts.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
