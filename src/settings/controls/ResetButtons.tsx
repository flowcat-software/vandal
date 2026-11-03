import { useState } from "react";
import { commands } from "../../shared/ipc";
import type { ResetItem } from "../schema";
import { Alert } from "./Alert";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ControlProps } from "./index";
import styles from "./controls.module.css";

/** How long "reset" shows before it fades. */
const SHOWN_MS = 3000;

/** The two resets: what each puts back, and what it leaves. */
const RESETS = {
  all: {
    button: "Reset all settings…",
    title: "Reset all settings?",
    body: [
      "Every setting goes back to how it was installed: hotkeys, folders, file names, styles and the rest. The markup tools forget the styles they remembered too.",
      "Your screenshots and other files aren't touched.",
    ],
    done: "All settings are back to their defaults.",
  },
  styles: {
    button: "Reset all styles…",
    title: "Reset all styles?",
    body: [
      "Markup's colors, widths, sizes and fonts go back to how they were installed, and the markup tools forget the styles they remembered.",
      "Everything else is kept as it is: how the tools behave, hotkeys, folders, file names and the other settings.",
    ],
    done: "All styles are back to their defaults.",
  },
} as const;

/**
 * Settings › About › Reset (PLAN 3V.3, Razorcat's): every setting, or only
 * the styles, as installed, after asking. Done, a success alert says so and
 * fades; a failure stays, as an error.
 */
export function ResetButtons({ id, disabled }: ControlProps<ResetItem>) {
  const [asking, setAsking] = useState<keyof typeof RESETS | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const reset = (which: keyof typeof RESETS) => {
    setAsking(null);
    commands
      .resetSettings(which === "styles")
      .then((r) =>
        setMessage(
          r.status === "ok"
            ? { text: RESETS[which].done, error: false }
            : { text: r.error, error: true },
        ),
      )
      .catch((e: unknown) => setMessage({ text: String(e), error: true }));
  };

  return (
    <div id={id} className={styles.stack}>
      <div className={styles.buttonRow}>
        {(["all", "styles"] as const).map((which) => (
          <button
            key={which}
            type="button"
            className={styles.button}
            disabled={disabled}
            onClick={() => {
              setMessage(null);
              setAsking(which);
            }}
          >
            {RESETS[which].button}
          </button>
        ))}
      </div>
      {message &&
        (message.error ? (
          <Alert tone="error">{message.text}</Alert>
        ) : (
          <Alert tone="success" fadeAfter={SHOWN_MS} onGone={() => setMessage(null)}>
            {message.text}
          </Alert>
        ))}
      {asking && (
        <ConfirmDialog
          title={RESETS[asking].title}
          confirm="Reset"
          onConfirm={() => reset(asking)}
          onCancel={() => setAsking(null)}
        >
          {RESETS[asking].body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </ConfirmDialog>
      )}
    </div>
  );
}
