// Resize mode (PLAN 3Z): like crop mode, a host mode instead of a tool. The
// options bar shows its fields, the marks can't be touched, and it ends with
// Resize (Enter) or without resizing (Esc, a tool, crop). Never applies on its
// own: unlike a crop, a resize resamples pixels.

import { create } from "zustand";
import { finishTextEdit } from "../markup/textEditing";
import { docStore } from "../markup/model/store";
import { useToolStore } from "../markup/toolStore";
import { applyCrop } from "./cropStore";

export const useResizeStore = create<{ active: boolean }>(() => ({ active: false }));

export function isResizing(): boolean {
  return useResizeStore.getState().active;
}

/** Enter resize mode (a crop in progress is applied first, as switching tools does). */
export function beginResize(): void {
  if (isResizing()) return;
  applyCrop();
  if (useToolStore.getState().editing) finishTextEdit();
  docStore.getState().select([]);
  useResizeStore.setState({ active: true });
}

/** Leave resize mode, resized or not. */
export function endResize(): void {
  useResizeStore.setState({ active: false });
}

/** The button and Ctrl+Alt+I. */
export function toggleResize(): void {
  if (isResizing()) endResize();
  else beginResize();
}
