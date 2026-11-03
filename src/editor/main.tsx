import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/theme.css";
import { blockBrowserUi } from "../shared/browserUi";
import { startAppearanceSync } from "../shared/appearance";
import { startLog } from "../shared/log";
import { logActions } from "../markup/actionLog";
import { EditorApp } from "./EditorApp";

blockBrowserUi();
startAppearanceSync();
// Its errors, and the markup's edits, in the log (PLAN 3V.8).
startLog("editor");
logActions();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EditorApp />
  </StrictMode>,
);
