// The markup's edits in the log (PLAN 3V.8, Razorcat's actionLog), so a crash report shows
// what led up to it. Every edit of the document is a named method of the store (`add`,
// `update`, `reorder`...): each is wrapped once to log its name and the mark count when it
// changed something. A drag is one line at its end. Never the arguments: they hold text and
// places.

import { logLine } from "../shared/log";
import { docStore, type DocState } from "./model/store";
import type { Doc } from "./model/types";
import { useToolStore } from "./toolStore";

/** Methods that only select or mark the doc saved; and gestures, logged as drags. */
const QUIET = new Set(["select", "markOutput", "beginGesture"]);

const counts = (doc: Doc) => `${doc.annotations.length} marks`;

/** Starts logging the markup's edits and tool changes. Once per page, at startup. */
export function logActions() {
  // The first edit of the drag under way, logged when it ends.
  let drag: string | null = null;
  const wrapped: Record<string, unknown> = {};
  for (const [name, method] of Object.entries(docStore.getState())) {
    if (typeof method !== "function" || QUIET.has(name)) continue;
    wrapped[name] = (...args: unknown[]) => {
      const before = docStore.getState();
      const result: unknown = (method as (...a: unknown[]) => unknown)(...args);
      const after = docStore.getState();
      if (name === "endGesture") {
        if (drag && after.doc !== before.gestureStart) {
          logLine(`[edit] ${drag} (drag) · ${counts(after.doc)}`);
        }
        drag = null;
      } else if (name === "cancelGesture") {
        if (drag) logLine(`[edit] ${drag} (drag cancelled)`);
        drag = null;
      } else if (after.doc !== before.doc) {
        if (before.gestureStart) drag ??= name;
        else logLine(`[edit] ${name} · ${counts(after.doc)}`);
      }
      return result;
    };
  }
  docStore.setState(wrapped as Partial<DocState>);
  useToolStore.subscribe((s, prev) => {
    if (s.tool !== prev.tool) logLine(`[tool] ${s.tool}`);
  });
}
