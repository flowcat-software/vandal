// A group's Reset (PLAN 3V.4, Razorcat's): the settings a group's items stand
// for, whether any differs from how it was installed, and the settings with
// them put back. The heading shows the link only while something differs. Pure.

import type { Settings } from "../shared/ipc";
import type { Group, Item } from "./schema";

/**
 * The settings `item` stands for, as dot paths: its own, a markup shortcut's,
 * or a tool's own style; none for items that aren't settings (the About card,
 * the buttons, read-only lists).
 */
export function itemPaths(item: Item): string[] {
  if (item.kind === "toolStyle") return [`styles.tools.${item.tool}`];
  if (item.kind === "shortcut") return [`shortcuts.${item.shortcut}`];
  return "path" in item ? [item.path] : [];
}

/** The settings `group` stands for. */
export function groupPaths(group: Group): string[] {
  return group.items.flatMap(itemPaths);
}

function at(obj: unknown, path: string): unknown {
  let cur = obj;
  for (const key of path.split(".")) cur = (cur as Record<string, unknown> | undefined)?.[key];
  return cur;
}

/** `obj` with `value` at `path`, each object along it copied; `undefined` leaves the key out. */
function put<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const current = { ...(obj as Record<string, unknown>) };
  const next = rest.length ? put(current[head] ?? {}, rest.join("."), value) : value;
  if (next === undefined) delete current[head];
  else current[head] = next;
  return current as T;
}

/** Equal as settings: the same values, object keys in any order, null as missing. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b || (a == null && b == null)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  return [...keys].every((k) => same(ra[k], rb[k]));
}

/** Whether any of `group`'s settings differs from `defaults`. */
export function groupDiffers(group: Group, settings: Settings, defaults: Settings): boolean {
  return groupPaths(group).some((p) => !same(at(settings, p), at(defaults, p)));
}

/** `settings` with `group`'s settings as in `defaults`. */
export function resetGroup(group: Group, settings: Settings, defaults: Settings): Settings {
  return groupPaths(group).reduce((s, p) => put(s, p, structuredClone(at(defaults, p))), settings);
}
