import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const lines: string[] = [];
vi.mock("../shared/log", () => ({ logLine: (text: string) => lines.push(text) }));

const { logActions } = await import("./actionLog");
const { docStore } = await import("./model/store");
const { emptyDoc } = await import("./model/types");
const { useToolStore } = await import("./toolStore");

const s = () => docStore.getState();
const rect = {
  kind: "rect" as const,
  rect: { x: 0, y: 0, width: 10, height: 10 },
  rotation: 0,
  fill: "none" as const,
  fillColor: "#000000",
  style: { color: "#ff0000", width: 4, opacity: 1 },
};

describe("the action log", () => {
  beforeAll(() => logActions());
  beforeEach(() => {
    s().load(emptyDoc({ width: 100, height: 100 }));
    lines.length = 0;
  });

  it("logs an edit by name and the mark count, never its contents", () => {
    s().add(rect);
    expect(lines).toEqual(["[edit] add · 1 marks"]);
  });

  it("logs nothing for a selection, or an edit that changes nothing", () => {
    const id = s().add(rect);
    lines.length = 0;
    s().select([id]);
    s().remove([]);
    expect(lines).toEqual([]);
  });

  it("logs a drag once, at its end", () => {
    const id = s().add(rect);
    lines.length = 0;
    s().beginGesture();
    s().update(id, (a) => ({ ...a, rotation: 10 }));
    s().update(id, (a) => ({ ...a, rotation: 20 }));
    s().endGesture();
    expect(lines).toEqual(["[edit] update (drag) · 1 marks"]);
  });

  it("logs the tool picked", () => {
    useToolStore.getState().setTool("arrow");
    useToolStore.getState().setTool("pen");
    expect(lines).toContain("[tool] pen");
  });
});
