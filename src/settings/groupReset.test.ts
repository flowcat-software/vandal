import { describe, expect, it } from "vitest";
import type { Settings } from "../shared/ipc";
import { groupDiffers, groupPaths, resetGroup, same } from "./groupReset";
import type { Group } from "./schema";

const defaults = {
  editor: { shareColor: false, showShortcutHints: true },
  save: { directory: "" },
  shortcuts: { pen: "P" },
  styles: { palette: ["#ff0000"], tools: { highlighter: { palette: ["#ffeb3b"] } } },
} as unknown as Settings;

const group: Group = {
  title: "Behavior",
  items: [
    { id: "a", kind: "toggle", label: "A", path: "editor.shareColor" },
    { id: "b", kind: "toggle", label: "B", path: "editor.showShortcutHints" },
    { id: "c", kind: "toolStyle", label: "C", tool: "highlighter", widths: true },
    { id: "d", kind: "shortcut", label: "D", shortcut: "pen" },
    { id: "e", kind: "about", label: "E" },
  ],
};

describe("a group's reset", () => {
  it("stands for its items' settings, a shortcut's and a tool's own style", () => {
    expect(groupPaths(group)).toEqual([
      "editor.shareColor",
      "editor.showShortcutHints",
      "styles.tools.highlighter",
      "shortcuts.pen",
    ]);
  });

  it("shows only while something in the group differs", () => {
    expect(groupDiffers(group, structuredClone(defaults), defaults)).toBe(false);
    const changed = structuredClone(defaults);
    changed.save.directory = "D:/Shots"; // not this group's
    expect(groupDiffers(group, changed, defaults)).toBe(false);
    changed.shortcuts.pen = "Ctrl+P";
    expect(groupDiffers(group, changed, defaults)).toBe(true);
  });

  it("puts back only the group's settings", () => {
    const s = structuredClone(defaults);
    s.editor.shareColor = true;
    s.save.directory = "D:/Shots";
    s.styles.tools.highlighter = null as never;
    s.styles.palette = ["#00ff00"];
    const r = resetGroup(group, s, defaults);
    expect(r.editor.shareColor).toBe(false);
    expect(r.styles.tools.highlighter).toEqual({ palette: ["#ffeb3b"] });
    expect(r.save.directory).toBe("D:/Shots");
    expect(r.styles.palette).toEqual(["#00ff00"]);
    expect(s.editor.shareColor).toBe(true);
  });

  it("leaves a tool's style out when it has none by default", () => {
    const g: Group = {
      items: [{ id: "p", kind: "toolStyle", label: "P", tool: "pen", widths: true }],
    };
    const s = structuredClone(defaults);
    (s.styles.tools as Record<string, unknown>).pen = { palette: ["#000000"] };
    expect(groupDiffers(g, s, defaults)).toBe(true);
    expect("pen" in resetGroup(g, s, defaults).styles.tools).toBe(false);
  });

  it("compares objects whatever their keys' order", () => {
    expect(same({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(same({ a: null }, {})).toBe(true);
    expect(same([1, 2], [2, 1])).toBe(false);
  });
});
