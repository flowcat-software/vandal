// Typed IPC surface for the frontend. Always go through this module rather than
// raw `invoke` strings; `bindings.ts` is generated from the Rust commands.
import { commands, events, type Settings as SettingsWire } from "./bindings";

export { commands, events } from "./bindings";
export type * from "./bindings";

/**
 * The wire types, tightened to what Rust actually sends:
 * - every field present: the structs are `#[serde(default)]` (so older files
 *   load), which specta renders as optional;
 * - `f64` as `number`: specta types it `number | null` because NaN serializes
 *   as null, but settings never contain NaN (validation replaces it). Array
 *   elements too (picker value lists).
 */
type Complete<T> = T extends readonly (infer U)[]
  ? Complete<NumberNotNull<U>>[]
  : T extends object
    ? { [K in keyof T]-?: Complete<NumberNotNull<Exclude<T[K], undefined>>> }
    : T;
type NumberNotNull<T> = [T] extends [number | null] ? (null extends T ? number : T) : T;

export type Settings = Complete<SettingsWire>;
export type StyleSettings = Settings["styles"];
export type NumberPicker = StyleSettings["width"];

/**
 * The color picker's eyedropper (PLAN 3U): pick a pixel anywhere on screen,
 * this window included. `#rrggbb`, or null if cancelled or it couldn't start
 * (a capture is already on screen).
 */
export async function pickScreenColor(): Promise<string | null> {
  let resolve!: (color: string | null) => void;
  const picked = new Promise<string | null>((r) => (resolve = r));
  // Listening before asking, so the answer can't come first.
  const unlisten = await events.screenColorPicked.listen(({ payload }) => resolve(payload.color));
  try {
    if (!(await commands.pickScreenColor())) return null;
    return await picked;
  } finally {
    unlisten();
  }
}

/**
 * Send raw pixels to Rust through the capture protocol (not JSON IPC, PLAN §1):
 * the editor's annotation layer, POSTed to `EditorInit.layerUrl` right before
 * `commands.editorExport`.
 */
export async function uploadPixels(
  url: string,
  rgba: Uint8ClampedArray<ArrayBuffer>,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: rgba,
  });
  if (!res.ok) throw new Error(`Couldn't send the annotations (HTTP ${res.status}).`);
}
