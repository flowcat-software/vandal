// Remembered tool styles (PLAN 2A.6d): load them when the editor opens, and
// hand every change back to Rust shortly after it happens (and on close), so
// the next window starts the same. Rust ignores both when
// `editor.rememberToolStyles` is off.

import { forgetToolMemory, restoreToolMemory, snapshotToolMemory } from "../markup/toolMemory";
import { useToolStore } from "../markup/toolStore";
import { commands, events } from "../shared/ipc";

/** Changes within this long are saved together. */
const SAVE_DELAY_MS = 300;

let timer: number | undefined;
let pending: string | null = null;
/** The memory as last loaded or saved, to tell style changes from other ones. */
let last = "";

function save(): Promise<void> {
  window.clearTimeout(timer);
  timer = undefined;
  const json = pending;
  pending = null;
  return json ? commands.setToolStyles(json) : Promise.resolve();
}

/** Save a change still waiting for its delay (call before the window closes). */
export function flushToolStyles(): Promise<void> {
  return save();
}

/**
 * Load the remembered styles again (a quick-edit overlay page lives across
 * captures, so each capture picks up what other windows saved since).
 */
export async function loadToolStyles(): Promise<void> {
  const json = await commands.getToolStyles();
  if (json) {
    try {
      restoreToolMemory(JSON.parse(json));
    } catch {
      // Unreadable: start from the defaults; the next change overwrites it.
    }
  }
  last = JSON.stringify(snapshotToolMemory());
}

/** Load the remembered styles, then keep saving changes. Returns a stop function. */
export function startToolStylesSync(): () => void {
  last = JSON.stringify(snapshotToolMemory());
  let unsubscribe = () => {};
  let stopped = false;
  // Settings › About's resets (PLAN 3V.3): the tools as installed too. Rust
  // has forgotten the file; what the tools then hold is saved as usual.
  const unlistenReset = events.toolStylesReset.listen(() => forgetToolMemory());

  void loadToolStyles().then(() => {
    if (stopped) return;
    // Only after loading, so the defaults never overwrite what was remembered.
    unsubscribe = useToolStore.subscribe(() => {
      const json = JSON.stringify(snapshotToolMemory());
      if (json === last) return; // e.g. the active tool changed, not a style
      last = json;
      pending = json;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void save(), SAVE_DELAY_MS);
    });
  });

  return () => {
    stopped = true;
    unsubscribe();
    void unlistenReset.then((f) => f());
    void save();
  };
}
