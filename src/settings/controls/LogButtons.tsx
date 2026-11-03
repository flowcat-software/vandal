import { useEffect, useState } from "react";
import { fileSize } from "../../shared/fileSize";
import { commands } from "../../shared/ipc";
import type { LogsItem } from "../schema";
import { Alert } from "./Alert";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ControlProps } from "./index";
import styles from "./controls.module.css";

/** How long "cleared" shows before it fades. */
const SHOWN_MS = 3000;

/**
 * Settings › About › Debugging (PLAN 3V.8, Razorcat's): the folder's size,
 * and buttons to open it (to send a report) or clear it, after asking.
 * Cleared, a success alert says so and fades; a failure stays, as an error.
 */
export function LogButtons({ id, disabled }: ControlProps<LogsItem>) {
  const [bytes, setBytes] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const measure = () => void commands.logsSize().then(setBytes);
  useEffect(measure, []);

  const clear = () => {
    setAsking(false);
    commands
      .clearLogs()
      .then((r) =>
        setMessage(
          r.status === "ok"
            ? { text: "Logs and crash reports cleared.", error: false }
            : { text: r.error, error: true },
        ),
      )
      .catch((e: unknown) => setMessage({ text: String(e), error: true }))
      .finally(measure);
  };

  return (
    <div id={id} className={styles.stack}>
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.button}
          disabled={disabled}
          onClick={() => void commands.openLogsFolder()}
        >
          Open logs folder
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={disabled}
          onClick={() => {
            setMessage(null);
            setAsking(true);
          }}
        >
          Clear logs
        </button>
      </div>
      {bytes !== null && <p className={styles.aboutMeta}>The folder holds {fileSize(bytes)}.</p>}
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
          title="Clear logs?"
          confirm="Clear"
          onConfirm={clear}
          onCancel={() => setAsking(false)}
        >
          The logs and crash reports are deleted, and this session's log starts again.
        </ConfirmDialog>
      )}
    </div>
  );
}
