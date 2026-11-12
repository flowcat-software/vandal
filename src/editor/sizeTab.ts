import type { KeyboardEvent } from "react";

/**
 * Tab (or Shift+Tab) in one of a size's two boxes (crop's, resize's) goes to
 * the other one, back and forth, skipping the buttons between and around
 * them. The bars' buttons aren't keyboard-usable yet (Space pans, no focus
 * style; PLAN: keyboard use review), so only the boxes take Tab.
 */
export function tabBetweenSizeBoxes(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key !== "Tab" || e.ctrlKey || e.altKey) return;
  const boxes = e.currentTarget.parentElement?.querySelectorAll("input");
  if (!boxes || boxes.length !== 2) return;
  e.preventDefault();
  (boxes[0] === e.currentTarget ? boxes[1] : boxes[0]).focus();
}
