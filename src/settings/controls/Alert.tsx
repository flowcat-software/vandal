import type { ReactNode } from "react";
import styles from "./controls.module.css";

/** What an alert says: done, for information, a caution, or something wrong. */
export type AlertTone = "success" | "info" | "warning" | "error";

const TONE_CLASS: Record<AlertTone, string> = {
  success: styles.alertSuccess,
  info: styles.alertInfo,
  warning: styles.alertWarning,
  error: styles.alertError,
};

interface Props {
  tone: AlertTone;
  children: ReactNode;
  /** Fades away after this many ms (a confirmation, like a toast), then `onGone`. */
  fadeAfter?: number;
  onGone?: () => void;
}

/**
 * A message in Settings (PLAN 3V.3, Razorcat's): a tinted bar in its tone's
 * colors, as the fields' error and warning bars. Errors are announced at once
 * (`alert`); the rest politely (`status`).
 */
export function Alert({ tone, children, fadeAfter, onGone }: Props) {
  const classes = [styles.alert, TONE_CLASS[tone], fadeAfter !== undefined && styles.fadeOut]
    .filter(Boolean)
    .join(" ");
  return (
    <p
      className={classes}
      role={tone === "error" ? "alert" : "status"}
      style={fadeAfter !== undefined ? { animationDelay: `${fadeAfter}ms` } : undefined}
      onAnimationEnd={onGone}
    >
      {children}
    </p>
  );
}
