// Every setting in the settings window, declared as data. See schema.ts.
//
// Pages follow the capture flow (PLAN §4.7): General (the app itself),
// Capture (taking the shot), Copy & save (where the image goes), Markup (tools
// and styles, shared by quick edit and the editor), Keyboard shortcuts, About.
import { CORNER_ICON, LINE_STYLE_ICON, LINE_WIDTH_ICON } from "../markup/pickerIcons";
import { SHORTCUT_NAMES, type ShortcutId } from "../markup/shortcuts";
import { commands } from "../shared/ipc";
import { EDITOR_KEYS, MARKUP_KEYS, QUICK_EDIT_KEYS } from "./fixedShortcuts";
import {
  PALETTE_ICON,
  AboutIcon,
  CaptureIcon,
  GeneralIcon,
  KeyboardIcon,
  MarkupIcon,
  SaveIcon,
  UpdatesIcon,
} from "./icons";
import type { Section } from "./schema";

/** What clicking the tray icon or opening Vandal does (PLAN 3G). */
const ICON_ACTIONS = [
  { value: "capture", label: "Capture a region" },
  { value: "editor", label: "Open the editor" },
] as const;

/** The color picker's copy formats (PLAN 3Y), as the color #1e88e5 would copy. */
const COLOR_FORMATS = [
  { value: "hexLower", label: "#1e88e5" },
  { value: "hexUpper", label: "#1E88E5" },
  { value: "rgb", label: "rgb(30, 136, 229)" },
  { value: "rgbBare", label: "30, 136, 229" },
  { value: "hsl", label: "hsl(208, 79%, 51%)" },
] as const;

export const sections: Section[] = [
  {
    id: "general",
    title: "General",
    icon: GeneralIcon,
    description: "How the app looks and starts, its notifications and its tray icon.",
    groups: [
      {
        title: "Appearance",
        items: [
          {
            id: "theme",
            kind: "choice",
            path: "appearance.theme",
            label: "Theme",
            options: [
              { value: "system", label: "Follow Windows" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ],
            keywords: ["dark mode", "light mode", "color", "theme", "appearance", "night"],
          },
          {
            id: "accent",
            kind: "accent",
            path: "appearance.accent",
            label: "Accent color",
            description:
              "Used for selected buttons, switches and the Save button. Follows your Windows accent color unless you pick one.",
            keywords: ["accent", "color", "colour", "highlight", "theme", "windows"],
          },
        ],
      },
      {
        title: "Startup",
        items: [
          {
            id: "launch-on-login",
            kind: "toggle",
            path: "startup.launchOnLogin",
            label: "Launch on login",
            description: "Start in the tray when you sign in to Windows.",
            keywords: ["startup", "autostart", "boot"],
          },
        ],
      },
      {
        title: "Tray icon and app icon",
        items: [
          {
            id: "tray-click-action",
            kind: "choice",
            path: "tray.clickAction",
            label: "Clicking the tray icon",
            options: ICON_ACTIONS,
            keywords: ["tray", "click", "editor", "capture"],
          },
          {
            id: "launch-action",
            kind: "choice",
            path: "startup.launchAction",
            label: "Opening Vandal",
            description:
              "From its desktop or Start menu icon. If Vandal isn't running yet, it starts in the tray and only opens the editor, never a capture.",
            options: ICON_ACTIONS,
            keywords: [
              "launch",
              "desktop",
              "start menu",
              "icon",
              "shortcut",
              "double-click",
              "editor",
            ],
          },
        ],
      },
      {
        title: "Notifications",
        items: [
          {
            id: "notify-copied",
            kind: "toggle",
            path: "afterCapture.notifyCopied",
            label: "Notify when a capture is copied",
            keywords: ["toast", "popup", "clipboard", "quiet", "silent"],
          },
          {
            id: "notify-saved",
            kind: "toggle",
            path: "afterCapture.notifySaved",
            label: "Notify when a capture is saved",
            description:
              "A capture that's neither copied nor saved always notifies, so you can still save or edit it. Windows holds notifications back while Do Not Disturb is on.",
            keywords: ["toast", "popup", "file", "quiet", "silent", "do not disturb", "focus"],
          },
          {
            id: "notification-save-button",
            kind: "toggle",
            path: "save.notificationSaveButton",
            label: "Save button on notifications",
            description:
              "When a capture isn't saved automatically, save it from the notification with one click.",
            keywords: ["toast", "popup"],
          },
          {
            id: "notification-edit-button",
            kind: "toggle",
            path: "editor.notificationEditButton",
            label: "Edit button on notifications",
            description:
              "Open a capture in the editor from its notification. Clicking the notification itself does this too.",
            keywords: ["toast", "popup", "editor", "markup"],
          },
        ],
      },
    ],
  },
  {
    id: "capture",
    title: "Capture",
    icon: CaptureIcon,
    description: "Taking a screenshot: the selection screen and quick edit. Also the color picker.",
    groups: [
      {
        title: "Selection screen",
        items: [
          {
            id: "dim-opacity",
            kind: "slider",
            path: "overlay.dimOpacity",
            label: "Dim the screen while selecting",
            description: "How dark the area outside your selection looks.",
            min: 0,
            max: 0.9,
            step: 0.05,
            format: (v) => `${Math.round(v * 100)}%`,
            keywords: ["overlay", "darken", "opacity"],
          },
          {
            id: "show-dimensions",
            kind: "toggle",
            path: "overlay.showDimensions",
            label: "Show selection size",
            description: "Display the width × height in pixels next to the selection.",
            keywords: ["overlay", "pixels", "width", "height"],
          },
        ],
      },
      {
        title: "Quick edit",
        items: [
          {
            id: "quick-edit",
            kind: "toggle",
            path: "quickEdit.enabled",
            label: "Show a toolbar on the selection",
            description:
              "Copy, save or mark up the area right away. When it's off, Enter captures the selection.",
            keywords: ["quick edit", "toolbar", "markup", "annotate"],
          },
          {
            id: "quick-edit-close-copy",
            kind: "toggle",
            path: "quickEdit.closeOnCopy",
            label: "Close after copying",
            description: "Copy (Ctrl+C) also finishes the capture.",
            keywords: ["quick edit", "clipboard"],
            disabled: (s) => !s.quickEdit.enabled,
          },
          {
            id: "quick-edit-close-save",
            kind: "toggle",
            path: "quickEdit.closeOnSave",
            label: "Close after saving",
            description: "Save (Ctrl+S) also finishes the capture.",
            keywords: ["quick edit", "file"],
            disabled: (s) => !s.quickEdit.enabled,
          },
        ],
      },
      {
        // PLAN 3Y.2
        title: "Color picker",
        description:
          "Its shortcut or the tray's Pick a color freezes the screens: click any pixel to copy its color.",
        items: [
          {
            id: "color-picker-hotkey",
            kind: "hotkey",
            path: "hotkeys.colorPicker",
            label: "Shortcut",
            keywords: ["hotkey", "keyboard", "key", "eyedropper", "color picker", "colour"],
          },
          {
            id: "color-picker-format",
            kind: "choice",
            control: "select",
            path: "colorPicker.copyFormat",
            label: "Copy as",
            options: COLOR_FORMATS,
            keywords: [
              "eyedropper",
              "color picker",
              "colour",
              "hex",
              "rgb",
              "hsl",
              "css",
              "clipboard",
            ],
          },
          {
            id: "color-picker-notify",
            kind: "toggle",
            path: "colorPicker.notify",
            label: "Notify when a color is copied",
            keywords: ["eyedropper", "color picker", "colour", "toast", "popup", "quiet", "silent"],
          },
        ],
      },
    ],
  },
  {
    id: "copy-save",
    title: "Copy & save",
    icon: SaveIcon,
    description:
      "What happens to your image after a capture or when you close the editor, and where files go.",
    groups: [
      {
        title: "After a capture",
        items: [
          {
            id: "copy-to-clipboard",
            kind: "toggle",
            path: "afterCapture.copyToClipboard",
            label: "Copy to clipboard",
            keywords: ["paste"],
          },
          {
            id: "auto-save",
            kind: "toggle",
            path: "afterCapture.autoSave",
            label: "Save to a file automatically",
            description: "Every capture is saved to the folder below.",
            keywords: ["auto-save", "autosave", "disk"],
          },
          {
            id: "open-editor",
            kind: "toggle",
            path: "afterCapture.openEditor",
            label: "Open in the editor",
            description:
              "Captures open in the full editor. Copying and saving then happen from the editor instead of right away.",
            keywords: ["edit", "markup", "annotate"],
          },
        ],
      },
      {
        title: "Closing the editor",
        description: "Skipped if you already copied or saved since your last change.",
        items: [
          {
            id: "editor-close-copy",
            kind: "toggle",
            path: "editor.onClose.copy",
            label: "Copy to clipboard",
            keywords: ["close", "exit", "paste", "editor"],
          },
          {
            id: "editor-close-save",
            kind: "toggle",
            path: "editor.onClose.save",
            label: "Save to a file",
            description:
              "Uses the folder and file name below. With neither option on, you're asked before unsaved changes are lost.",
            keywords: ["close", "exit", "auto-save", "autosave", "editor"],
          },
        ],
      },
      {
        title: "Where to save",
        items: [
          {
            id: "save-directory",
            kind: "folder",
            path: "save.directory",
            label: "Folder",
            keywords: ["directory", "path", "location"],
          },
          {
            id: "filename-template",
            kind: "text",
            path: "save.filenameTemplate",
            label: "File name",
            preview: (template) => commands.previewFilename(template),
            help: "Use {yyyy} {MM} {dd} for the date, {HH} {mm} {ss} for the time, and {n} for a number that counts up ({nnn} gives 001, 002…).",
            keywords: ["name", "template", "pattern", "number", "counter", "sequence"],
          },
        ],
      },
      {
        title: "Open and Save As",
        description:
          "Where the editor's dialogs start. If that folder isn't there, Open starts on your Desktop, and Save As next to the opened image or in the save folder.",
        items: [
          {
            id: "open-starts-in",
            kind: "choice",
            control: "select",
            path: "save.openStartsIn",
            label: "Open starts in",
            options: [
              { value: "lastOpened", label: "The last folder you opened from" },
              { value: "saveFolder", label: "The save folder" },
            ],
            keywords: ["open", "dialog", "browse", "folder", "directory", "start", "default"],
          },
          {
            id: "save-as-starts-in",
            kind: "choice",
            control: "select",
            path: "save.saveAsStartsIn",
            label: "Save As starts in",
            description:
              "For a capture, the image's folder is the last folder you opened an image from.",
            options: [
              { value: "lastSaved", label: "The last folder you saved to" },
              { value: "imageFolder", label: "The image's folder" },
              { value: "saveFolder", label: "The save folder" },
            ],
            keywords: ["save as", "dialog", "browse", "folder", "directory", "start", "default"],
          },
        ],
      },
      {
        title: "Opened images",
        items: [
          {
            id: "editor-confirm-overwrite",
            kind: "toggle",
            path: "editor.confirmOverwrite",
            label: "Warn before saving over an opened image",
            description:
              "Save writes the markup into the original file. Off: Save replaces it without asking.",
            keywords: ["overwrite", "replace", "original", "file", "open", "warning", "confirm"],
          },
        ],
      },
    ],
  },
  {
    id: "markup",
    title: "Markup",
    icon: MarkupIcon,
    description: "Tools and styles for quick edit and the editor.",
    groups: [
      {
        title: "Behavior",
        items: [
          {
            id: "editor-drawing-tools-select",
            kind: "toggle",
            path: "editor.drawingToolsSelect",
            label: "Drawing tools select marks under the pointer",
            description:
              "Off: drawing tools always draw, even over other marks, and you select with the Select tool. Hold Ctrl to do the opposite for one click.",
            keywords: ["draw over", "click", "select", "move", "ctrl", "arrow", "overlap"],
          },
          {
            id: "editor-share-color",
            kind: "toggle",
            path: "editor.shareColor",
            label: "All tools use the same color",
            description:
              "Picking a color for one tool picks it for the others too (except tools with their own palette, like the highlighter). Off: each tool keeps its own color.",
            keywords: ["color", "colour", "shared", "same", "sync", "palette"],
          },
          {
            id: "editor-remember-tool-styles",
            kind: "toggle",
            path: "editor.rememberToolStyles",
            label: "Remember tool styles between windows",
            description:
              "New editors start with the colors, widths, fonts and other options you last used, even after a restart. Off: every editor starts from the defaults.",
            keywords: [
              "remember",
              "keep",
              "persist",
              "restore",
              "defaults",
              "color",
              "width",
              "font",
            ],
          },
          {
            id: "editor-shortcut-hints",
            kind: "toggle",
            path: "editor.showShortcutHints",
            label: "Show shortcut hints on the pickers",
            description:
              "Slot numbers on the widths, sizes, colors and fonts while you hold a number key, Ctrl or Alt, and the keys in their tooltips. The shortcuts work either way.",
            keywords: ["shortcut", "hint", "badge", "number", "keyboard", "tooltip", "digit"],
          },
          {
            id: "editor-scroll-hints",
            kind: "toggle",
            path: "editor.scrollHints",
            label: "Scroll long hints",
            description:
              "When a hint is too long for the status bar, rest the pointer for a moment and it glides along to show the rest.",
            keywords: ["hint", "status bar", "scroll", "marquee", "motion", "animation", "cut off"],
          },
          {
            id: "editor-button-units",
            kind: "toggle",
            path: "editor.showButtonUnits",
            label: "Show units on number buttons",
            description:
              'Buttons for sizes, strengths and darkness show their unit after the number, like "50%" or "10px". Off keeps them shorter.',
            keywords: ["unit", "units", "px", "percent", "pt", "button", "number", "label"],
          },
        ],
      },
      {
        title: "Colors",
        icon: PALETTE_ICON,
        items: [
          {
            id: "styles-palette",
            kind: "palette",
            path: "styles.palette",
            label: "Color presets",
            description:
              "The colors the tools offer, in order. Ctrl+1–9 pick the first nine while you draw. Click a color to change or remove it; drag it to reorder.",
            keywords: ["color", "colour", "palette", "preset", "swatch", "reorder"],
          },
          {
            id: "styles-color-control",
            kind: "choice",
            path: "styles.colorControl",
            label: "Show colors as",
            description:
              "Swatches show every color in the options bar. A dropdown takes less room: a button per color that opens the palette. The keys work the same either way. A tool can have its own choice under Per-tool styles.",
            options: [
              { value: "swatches", label: "Swatches" },
              { value: "dropdown", label: "Dropdown" },
            ],
            keywords: [
              "color",
              "colour",
              "swatch",
              "dropdown",
              "menu",
              "compact",
              "space",
              "toolbar",
            ],
          },
        ],
      },
      {
        title: "Line width",
        icon: LINE_WIDTH_ICON,
        items: [
          {
            id: "styles-width",
            kind: "numberPicker",
            path: "styles.width",
            label: "Width choices",
            description:
              "The widths the drawing tools offer, in pixels. Keys 1–9 and 0 pick them while you draw.",
            unit: "px",
            lines: true,
            keywords: [
              "line",
              "width",
              "thickness",
              "stroke",
              "size",
              "picker",
              "slider",
              "buttons",
            ],
          },
        ],
      },
      {
        title: "Line style",
        icon: LINE_STYLE_ICON,
        description:
          "Dashed and dotted styles for lines, arrows, rectangles, ellipses and callouts, listed after Solid in their options in this order. A tool can have its own under Per-tool styles (the arrow's are under Arrows).",
        items: [
          {
            id: "dash-styles",
            kind: "dashStyles",
            path: "styles.dashes",
            label: "Line styles",
            keywords: [
              "dash",
              "dashed",
              "dotted",
              "dots",
              "dotted line",
              "stroke",
              "outline",
              "border",
              "line style",
              "gap",
            ],
          },
        ],
      },
      {
        title: "Rounded corners",
        icon: CORNER_ICON,
        items: [
          {
            id: "styles-corner-radius",
            kind: "numberPicker",
            path: "styles.cornerRadius",
            label: "Corner radius choices",
            description:
              "The corner radii the rectangle and the spotlight's rectangle offer, in pixels. 0 (square corners) is always one of them. Alt+1–9 and Alt+0 pick them while you draw.",
            unit: "px",
            zero: true,
            noButtons: true,
            keywords: ["corner", "round", "rounded", "radius", "rectangle", "spotlight", "square"],
          },
        ],
      },
      {
        title: "Text",
        tool: "text",
        items: [
          {
            id: "styles-fonts",
            kind: "fontPicker",
            path: "styles.font",
            label: "Fonts",
            description:
              "The fonts the text tool offers. With a custom list, Alt+1–9 and Alt+0 pick them while you type.",
            keywords: ["font", "typeface", "family", "text", "list", "installed"],
          },
          {
            id: "styles-font-size",
            kind: "numberPicker",
            path: "styles.fontSize",
            label: "Font sizes",
            description: "The sizes the text tool offers, in points. Keys 1–9 and 0 pick them.",
            unit: "pt",
            keywords: ["font", "size", "text", "points", "pt", "picker"],
          },
        ],
      },
      {
        title: "Arrows",
        tool: "arrow",
        description:
          "The arrow's head styles, listed in the arrow tool's options in this order, and its own colors, widths or line styles.",
        items: [
          {
            id: "arrow-heads",
            kind: "arrowHeads",
            path: "styles.arrowHeads",
            label: "Head styles",
            keywords: [
              "arrow",
              "head",
              "arrowhead",
              "narrow",
              "wide",
              "filled",
              "open",
              "technical",
              "proportions",
            ],
          },
          {
            id: "tool-style-arrow",
            kind: "toolStyle",
            tool: "arrow",
            label: "Arrow",
            widths: true,
            dashes: true,
            keywords: [
              "own",
              "custom",
              "override",
              "per tool",
              "palette",
              "color",
              "width",
              "arrow",
            ],
          },
        ],
      },
      {
        title: "Redact",
        tool: "redact",
        items: [
          {
            id: "styles-pixelate",
            kind: "numberPicker",
            path: "styles.pixelate",
            label: "Pixelate block sizes",
            description:
              "The block sizes the redact tool offers for Pixelate, in pixels. Bigger blocks hide more. Keys 1–9 and 0 pick them.",
            unit: "px",
            keywords: ["redact", "pixelate", "mosaic", "block", "strength", "hide", "censor"],
            // PLAN 3I.2: allowed for a light effect, but weak on text.
            warnBelow: {
              value: 6,
              message:
                "Blocks under 6 px may not hide text: some tools can read pixelated text back. Use Solid for passwords and other secrets.",
            },
          },
          {
            id: "styles-blur",
            kind: "numberPicker",
            path: "styles.blur",
            label: "Blur strengths",
            description:
              "The blur radii the redact tool offers for Blur, in pixels. A bigger radius hides more. Keys 1–9 and 0 pick them.",
            unit: "px",
            keywords: ["redact", "blur", "radius", "strength", "hide", "censor"],
            warnBelow: {
              value: 3,
              message:
                "A blur under 3 px may not hide text: some tools can read blurred text back. Use Solid for passwords and other secrets.",
            },
          },
        ],
      },
      {
        title: "Spotlight",
        tool: "spotlight",
        items: [
          {
            id: "styles-spotlight",
            kind: "numberPicker",
            path: "styles.spotlight",
            label: "Darkness choices",
            description:
              "How dark the spotlight tool makes everything outside it, in percent. Keys 1–9 and 0 pick them while you draw. Values above 100 are lowered to 100.",
            unit: "%",
            keywords: ["spotlight", "dim", "darken", "darkness", "opacity", "focus", "highlight"],
          },
        ],
      },
      {
        title: "Step markers",
        tool: "step",
        items: [
          {
            id: "styles-step-size",
            kind: "numberPicker",
            path: "styles.stepSize",
            label: "Marker sizes",
            description:
              "The sizes the step tool offers, in pixels across. Keys 1–9 and 0 pick them while you place markers.",
            unit: "px",
            keywords: ["step", "marker", "number", "numbered", "size", "badge", "counter"],
          },
          {
            id: "styles-step-fonts",
            kind: "fontPicker",
            path: "styles.stepFont",
            label: "Marker fonts",
            description:
              "The fonts the step tool offers for its labels. Same as Text tool uses the fonts chosen above. With a custom list, Alt+1–9 and Alt+0 pick them.",
            keywords: ["step", "marker", "font", "typeface", "label", "number", "text"],
          },
        ],
      },
      {
        title: "Per-tool styles",
        description:
          "Give a tool its own colors, widths, line styles or way of showing colors instead of the ones above. The highlighter comes with its own colors.",
        items: [
          {
            id: "tool-style-pen",
            kind: "toolStyle",
            tool: "pen",
            label: "Pen",
            widths: true,
            keywords: ["own", "custom", "override", "per tool", "palette", "color", "width"],
          },
          {
            id: "tool-style-highlighter",
            kind: "toolStyle",
            tool: "highlighter",
            label: "Highlighter",
            widths: true,
            keywords: ["own", "custom", "override", "per tool", "palette", "color", "width"],
          },
          {
            id: "tool-style-line",
            kind: "toolStyle",
            tool: "line",
            label: "Line",
            widths: true,
            dashes: true,
            keywords: ["own", "custom", "override", "per tool", "palette", "color", "width"],
          },
          {
            id: "tool-style-rect",
            kind: "toolStyle",
            tool: "rect",
            label: "Rectangle",
            widths: true,
            dashes: true,
            keywords: ["own", "custom", "override", "per tool", "palette", "color", "width"],
          },
          {
            id: "tool-style-ellipse",
            kind: "toolStyle",
            tool: "ellipse",
            label: "Ellipse",
            widths: true,
            dashes: true,
            keywords: ["own", "custom", "override", "per tool", "palette", "color", "width"],
          },
          {
            id: "tool-style-text",
            kind: "toolStyle",
            tool: "text",
            label: "Text",
            widths: false,
            keywords: ["own", "custom", "override", "per tool", "palette", "color"],
          },
          {
            id: "tool-style-callout",
            kind: "toolStyle",
            tool: "callout",
            label: "Callout",
            widths: true,
            dashes: true,
            keywords: ["own", "custom", "override", "per tool", "palette", "color", "pointer"],
          },
          {
            id: "tool-style-step",
            kind: "toolStyle",
            tool: "step",
            label: "Step markers",
            widths: false,
            keywords: ["own", "custom", "override", "per tool", "palette", "color", "marker"],
          },
        ],
      },
    ],
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    icon: KeyboardIcon,
    description:
      "The capture shortcuts, which work anywhere in Windows, and the markup tools' keys.",
    groups: [
      {
        title: "Capture",
        description: "They work anywhere in Windows. Click Change, then press the new shortcut.",
        items: [
          {
            id: "hotkey-region",
            kind: "hotkey",
            path: "hotkeys.region",
            label: "Capture a region",
            keywords: ["hotkey", "shortcut", "keyboard", "key", "printscreen"],
          },
          {
            id: "hotkey-window",
            kind: "hotkey",
            path: "hotkeys.window",
            label: "Capture a window",
            keywords: ["hotkey", "shortcut", "keyboard", "key", "window", "printscreen"],
          },
          {
            id: "hotkey-fullscreen",
            kind: "hotkey",
            path: "hotkeys.fullscreen",
            label: "Capture the full screen",
            description: "The screen the pointer is on",
            keywords: ["hotkey", "shortcut", "keyboard", "key", "monitor", "printscreen"],
          },
          {
            id: "hotkey-all-screens",
            kind: "hotkey",
            path: "hotkeys.allScreens",
            label: "Capture all screens",
            description: "Every screen as one image",
            keywords: ["hotkey", "shortcut", "keyboard", "key", "all monitors", "printscreen"],
          },
          {
            id: "hotkey-color-picker",
            kind: "hotkey",
            path: "hotkeys.colorPicker",
            label: "Pick a color",
            description: "Copies the color of the pixel you click",
            keywords: ["hotkey", "shortcut", "keyboard", "key", "eyedropper", "colour"],
          },
        ],
      },
      {
        title: "Tools",
        description:
          "In quick edit and the editor. Click Change, then press a letter, alone or with Ctrl, Alt or Shift.",
        items: (Object.keys(SHORTCUT_NAMES) as ShortcutId[]).map((shortcut) => ({
          id: `shortcut-${shortcut}`,
          kind: "shortcut" as const,
          shortcut,
          label: SHORTCUT_NAMES[shortcut],
          description: shortcut === "crop" ? "In the editor" : undefined,
          keywords: ["shortcut", "keyboard", "key", "tool"],
        })),
      },
      {
        title: "Other shortcuts",
        description: "These can't be changed.",
        items: (
          [
            ["keys-markup", "Marking up", "In quick edit and the editor", MARKUP_KEYS],
            ["keys-quick-edit", "Quick edit", undefined, QUICK_EDIT_KEYS],
            ["keys-editor", "Editor", undefined, EDITOR_KEYS],
          ] as const
        ).map(([id, label, description, entries]) => ({
          id,
          kind: "keyList" as const,
          label,
          description,
          entries,
          // Found by what they do: "duplicate", "zoom"...
          keywords: ["shortcut", "keyboard", "key", ...entries.flatMap((e) => [e.what, ...e.keys])],
        })),
      },
    ],
  },
  {
    id: "updates",
    title: "Updates",
    icon: UpdatesIcon,
    groups: [
      {
        items: [
          {
            id: "update-status",
            kind: "updates",
            label: "Updates",
            keywords: ["update", "upgrade", "new version", "check", "install", "download"],
          },
          {
            id: "check-automatically",
            kind: "toggle",
            path: "updates.checkAutomatically",
            label: "Check for updates automatically",
            description:
              "When Vandal starts and once a day. A check only downloads a small file from GitHub; nothing about you or your screenshots is sent. Off: Vandal never checks unless you press Check now.",
            keywords: ["update", "automatic", "privacy", "network", "internet", "offline"],
          },
          {
            id: "update-channel",
            kind: "choice",
            path: "updates.channel",
            label: "Update channel",
            description: "Beta gets new features first, with test versions before each release.",
            options: [
              { value: "stable", label: "Stable" },
              { value: "beta", label: "Beta" },
            ],
            keywords: ["update", "beta", "stable", "prerelease", "testing", "channel"],
          },
        ],
      },
    ],
  },
  {
    id: "about",
    title: "About",
    icon: AboutIcon,
    groups: [
      {
        items: [
          {
            id: "about",
            kind: "about",
            label: "About Vandal",
            keywords: [
              "version",
              "author",
              "flowcat",
              "publisher",
              "copyright",
              "license",
              "github",
              "website",
            ],
          },
        ],
      },
      {
        title: "Chrome Extension",
        items: [
          {
            id: "extension",
            kind: "extension",
            label: "Vandal Screen Capture for Chrome",
            keywords: [
              "browser",
              "extension",
              "chrome",
              "edge",
              "brave",
              "web page",
              "full page",
              "scrolling",
            ],
          },
        ],
      },
      {
        title: "Debugging",
        items: [
          {
            id: "logging",
            kind: "toggle",
            path: "debugging.logging",
            label: "Keep a log",
            description:
              "A log of what Vandal does, and a report if it crashes, to send when something goes wrong. It stays on your PC: never your screenshots, file names, folders or text. Off, nothing is written.",
            keywords: ["log", "logging", "debug", "crash", "report", "diagnostics"],
          },
          {
            id: "logs",
            kind: "logs",
            label: "Logs and crash reports",
            visible: (s) => s.debugging.logging,
            keywords: ["log", "logs", "folder", "clear", "delete", "crash", "report", "debug"],
          },
        ],
      },
      {
        title: "Reset",
        items: [
          {
            id: "reset",
            kind: "reset",
            label: "Reset to defaults",
            description:
              "Put Vandal back as it was installed: every setting, or only the styles (Markup's colors, widths, sizes and fonts). The markup tools forget the styles they remembered too.",
            keywords: [
              "reset",
              "defaults",
              "default",
              "restore",
              "factory",
              "styles",
              "start over",
            ],
          },
          {
            id: "reset-ask-for-groups",
            kind: "toggle",
            path: "reset.askForGroups",
            label: "Ask before resetting a group",
            description:
              'Each group of settings has a Reset by its heading while it differs from the defaults. It asks first; its "Don\'t ask again" turns this off.',
            keywords: ["reset", "ask", "confirm", "group", "don't ask again"],
          },
        ],
      },
    ],
  },
];
