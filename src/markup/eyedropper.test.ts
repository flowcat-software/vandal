import { beforeEach, describe, expect, it } from "vitest";
import { applyPickedColor } from "./eyedropper";
import { docStore } from "./model/store";
import { emptyDoc, type Annotation, type ShapeAnnotation } from "./model/types";
import { DEFAULT_STYLE_CONFIG, useStyleConfig } from "./styles";
import { useToolStore } from "./toolStore";

const initial = useToolStore.getState();
const PICKED = "#123456"; // not a preset

const rect: Annotation = {
  id: "r",
  kind: "rect",
  rect: { x: 0, y: 0, width: 10, height: 10 },
  rotation: 0,
  fill: "both",
  fillColor: "#00ff00",
  style: { color: "#ff0000", width: 4, opacity: 1 },
};

describe("the markup's eyedropper", () => {
  beforeEach(() => {
    useToolStore.setState(initial, true);
    useStyleConfig.setState(DEFAULT_STYLE_CONFIG, true);
    docStore.getState().load(emptyDoc({ width: 100, height: 100 }));
  });

  const get = (id: string) =>
    docStore.getState().doc.annotations.find((a) => a.id === id) as ShapeAnnotation;

  it("does nothing with Select and nothing selected", () => {
    useToolStore.getState().setTool("select");
    expect(applyPickedColor(PICKED, "first")).toBe(false);
  });

  it("sets a one-color tool's color, a right-click too, on its custom swatch", () => {
    useToolStore.getState().setTool("arrow");
    expect(applyPickedColor(PICKED, "second")).toBe(true);
    const t = useToolStore.getState();
    expect(t.sharedColor ?? t.colors.arrow).toBe(PICKED);
    expect(t.customColors.shared).toBe(PICKED);
    expect(t.customSecondColors.shared).toBeUndefined();
  });

  it("sets a selected shape's fill (click) or border (right-click), and switches the chip", () => {
    const id = docStore.getState().add(rect);
    docStore.getState().select([id]);
    const before = docStore.getState().past.length;

    applyPickedColor(PICKED, "second");
    expect(get(id).style.color).toBe(PICKED);
    expect(get(id).fillColor).toBe("#00ff00");
    expect(useToolStore.getState().colorSlot).toBe("second");
    expect(useToolStore.getState().customSecondColors.shared).toBe(PICKED);
    expect(docStore.getState().past.length).toBe(before + 1);

    applyPickedColor("#654321", "first");
    expect(get(id).fillColor).toBe("#654321");
    expect(useToolStore.getState().colorSlot).toBe("first");
    expect(useToolStore.getState().customColors.shared).toBe("#654321");
  });

  it("leaves the custom swatch alone for a preset", () => {
    useToolStore.getState().setTool("arrow");
    const preset = DEFAULT_STYLE_CONFIG.styles.palette[0];
    applyPickedColor(preset, "first");
    expect(useToolStore.getState().customColors.shared).toBeUndefined();
  });
});
