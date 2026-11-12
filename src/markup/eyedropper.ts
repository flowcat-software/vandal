// The markup's eyedropper (PLAN 3Y.3): pick a pixel anywhere on screen into
// the chip, as the custom color picker would: a click sets the first color,
// a right-click the second, each through its custom swatch.

import { parseHex } from "./color";
import { docStore } from "./model/store";
import { applyStyle, colorSlots, styleTarget, targetSections, targetValues } from "./restyle";
import { paletteFor, paletteKey, setCustomColor, type ColorSlotPosition } from "./styles";
import { useToolStore } from "./toolStore";
import { setPickingFromScreen } from "./usePopover";
import { pickChipColor } from "../shared/ipc";

/** Pick from the screen into the current target's colors. */
export async function pickIntoChip(): Promise<void> {
  setPickingFromScreen(true);
  try {
    const picked = await pickChipColor();
    const hex = parseHex(picked?.color ?? "");
    if (picked && hex) applyPickedColor(hex, picked.second ? "second" : "first");
  } catch (e) {
    console.error("Eyedropper failed:", e);
  } finally {
    // After the click or Esc that ended it has gone past any popover.
    setTimeout(() => setPickingFromScreen(false));
  }
}

/**
 * `hex` into the target's first or second color (the first when there's only
 * one), selected marks included, and onto that color's custom swatch unless
 * it's a preset. The chip switches to it. False with nothing to color (Select
 * with nothing selected).
 */
export function applyPickedColor(hex: string, position: ColorSlotPosition): boolean {
  const target = styleTarget();
  if (!target) return false;
  const slots = colorSlots(targetValues(target, docStore.getState().doc), targetSections(target));
  const second = position === "second" && slots.second;
  const slot = second || slots.first;
  const at: ColorSlotPosition = second ? "second" : "first";
  applyStyle({ [slot.key]: hex }, target);
  const preset = paletteFor(target.tool).some((c) => c.toLowerCase() === hex.toLowerCase());
  if (!preset) setCustomColor(paletteKey(target.tool), hex, at, slot.key);
  if (slots.second) useToolStore.setState({ colorSlot: at });
  return true;
}
