import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/theme.css";
import { blockBrowserUi } from "../shared/browserUi";
import { startAppearanceSync } from "../shared/appearance";
import { startLog } from "../shared/log";
import { SettingsApp } from "./SettingsApp";

blockBrowserUi();
startAppearanceSync();
// Its errors in the log (PLAN 3V.8).
startLog("settings");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>,
);
