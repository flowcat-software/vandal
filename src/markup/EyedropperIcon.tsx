/**
 * The eyedropper, filled: the custom color picker's button (PLAN 3U) and the
 * toolbar's (PLAN 3Y.3) draw the same one. Filled inline, so it stays filled
 * where the surrounding styles stroke their icons (the toolbar's).
 */
export function EyedropperIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={{ fill: "currentColor", stroke: "none" }}
      aria-hidden
    >
      <path d="M20.71 5.63l-2.34-2.34a1 1 0 0 0-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12a1 1 0 0 0 .01-1.42zM6.92 19L5 17.08l8.06-8.06 1.92 1.92z" />
    </svg>
  );
}
