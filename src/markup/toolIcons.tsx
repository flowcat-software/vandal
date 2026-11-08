// The tools' buttons, in the toolbar's order, with their icons (24 × 24, drawn
// with 1.6 strokes). Settings shows the icons beside the tools' names too.

import type { ReactNode } from "react";
import type { ToolId } from "./toolStore";

export const TOOL_BUTTONS: { id: ToolId; label: string; icon: ReactNode }[] = [
  { id: "select", label: "Select", icon: <path d="M6 5l12 7.2-5.4 1.4-2.6 5.4z" /> },
  {
    id: "pen",
    label: "Pen",
    icon: (
      <>
        <path d="M4 20l1-4L16 5l3 3L8 19z" />
        <path d="M14 7l3 3" />
      </>
    ),
  },
  {
    id: "highlighter",
    label: "Highlighter",
    icon: (
      <>
        <path d="M9 15l-2 5h5l1-2" />
        <path d="M9 15l8-11 4 3-8 11z" />
      </>
    ),
  },
  { id: "line", label: "Line", icon: <path d="M5 19L19 5" /> },
  {
    id: "arrow",
    label: "Arrow",
    icon: (
      <>
        <path d="M5 19L19 5" />
        <path d="M10 5h9v9" />
      </>
    ),
  },
  {
    id: "rect",
    label: "Rectangle",
    icon: <rect x="4" y="6" width="16" height="12" rx="1" />,
  },
  {
    id: "ellipse",
    label: "Ellipse",
    icon: <ellipse cx="12" cy="12" rx="8.5" ry="6.5" />,
  },
  {
    id: "text",
    label: "Text",
    icon: <path d="M5 7V5h14v2M12 5v14M9 19h6" />,
  },
  {
    id: "callout",
    label: "Callout",
    // A box of text with a pointer down to the left.
    icon: (
      <>
        <rect x="9" y="3.5" width="12" height="9" rx="2" />
        <path d="M12 8h6M12.5 12.5L4 20.5" />
        <circle cx="4" cy="20.5" r="0.6" />
      </>
    ),
  },
  {
    id: "redact",
    label: "Redact",
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 12h16M12 4v16" />
        <path d="M4.8 4.8h7.2v7.2H4.8zM12 12h7.2v7.2H12z" fill="currentColor" opacity="0.45" />
      </>
    ),
  },
  {
    id: "spotlight",
    label: "Spotlight",
    icon: (
      <>
        <path
          d="M3 5h18v14H3zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z"
          fill="currentColor"
          fillRule="evenodd"
          stroke="none"
          opacity="0.45"
        />
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="12" cy="12" r="4" />
      </>
    ),
  },
  {
    id: "step",
    label: "Step",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M10.3 9.4L12.6 7.8v8.4" />
      </>
    ),
  },
];

/** A tool's toolbar icon, as an SVG. */
export function ToolIcon({ tool, className }: { tool: ToolId; className?: string }) {
  const icon = TOOL_BUTTONS.find((b) => b.id === tool)?.icon;
  return icon ? (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      {icon}
    </svg>
  ) : null;
}
