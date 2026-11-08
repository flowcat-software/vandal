import { useState } from "react";
import { ToolIcon } from "../markup/toolIcons";
import { commands } from "../shared/ipc";
import { Alert } from "./controls/Alert";
import { ConfirmDialog } from "./controls/ConfirmDialog";
import controls from "./controls/controls.module.css";
import { groupDiffers, resetGroup } from "./groupReset";
import type { Group } from "./schema";
import { useSettingsStore } from "./store";
import styles from "./SettingsApp.module.css";

/** How long "reset" shows before it fades. */
const SHOWN_MS = 3000;

/**
 * A group's heading, with its Reset (PLAN 3V.4, Razorcat's) while any of its
 * settings differs from how it was installed (`resettable`: not search
 * results' groups). It asks first, unless "Don't ask again" was ticked
 * (Settings › About › Reset turns asking back on). A group with no title has
 * the Reset alone, called by `name`, its page's.
 */
export function GroupHeading({
  group,
  name,
  resettable,
}: {
  group: Group;
  name: string;
  resettable: boolean;
}) {
  const settings = useSettingsStore((s) => s.settings!);
  const defaults = useSettingsStore((s) => s.defaults);
  const [asking, setAsking] = useState(false);
  const [stopAsking, setStopAsking] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const shown = resettable && defaults !== null && groupDiffers(group, settings, defaults);
  if (!group.title && !shown && !message) return null;

  const reset = (thenStopAsking: boolean) => {
    setAsking(false);
    if (!defaults) return;
    const next = resetGroup(group, settings, defaults);
    const stored = thenStopAsking
      ? { ...next, reset: { ...next.reset, askForGroups: false } }
      : next;
    commands
      .updateSettings(stored)
      .then((r) =>
        setMessage(
          r.status === "ok"
            ? { text: `${name} is back to its defaults.`, error: false }
            : { text: r.error, error: true },
        ),
      )
      .catch((e: unknown) => setMessage({ text: String(e), error: true }));
  };

  return (
    <>
      <div className={styles.groupHead}>
        {group.title ? (
          <h2 className={styles.groupTitle}>
            {(group.tool || group.icon) && (
              <span className={styles.groupIcon}>
                {group.tool ? <ToolIcon tool={group.tool} /> : group.icon}
              </span>
            )}
            {group.title}
          </h2>
        ) : (
          <span />
        )}
        {shown && (
          <button
            type="button"
            className={controls.linkButton}
            title={`Put ${name}'s settings back as they were installed`}
            onClick={() => {
              setMessage(null);
              if (settings.reset.askForGroups) {
                setStopAsking(false);
                setAsking(true);
              } else reset(false);
            }}
          >
            Reset
          </button>
        )}
      </div>
      {message && (
        <div className={styles.groupMessage}>
          {message.error ? (
            <Alert tone="error">{message.text}</Alert>
          ) : (
            <Alert tone="success" fadeAfter={SHOWN_MS} onGone={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}
        </div>
      )}
      {asking && (
        <ConfirmDialog
          title={`Reset ${name}?`}
          confirm="Reset"
          onConfirm={() => reset(stopAsking)}
          onCancel={() => setAsking(false)}
        >
          <p>The settings in {name} go back to how they were installed.</p>
          <label className={controls.dialogCheck}>
            <input
              type="checkbox"
              checked={stopAsking}
              onChange={(e) => setStopAsking(e.target.checked)}
            />
            Don't ask again
          </label>
        </ConfirmDialog>
      )}
    </>
  );
}
