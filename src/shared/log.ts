// The page's side of the log (PLAN 3V.8, Razorcat's C1): lines go to Rust's log in small
// batches, and the page's errors are logged with their stacks. Log what happened (an edit's
// name, a tool, counts), never what the user typed or captured: Rust scrubs paths and file
// names, but can't know a caption.

import { commands } from "./ipc";

/** How long lines wait to go together. */
const BATCH_MS = 500;

let page = "page";
let pending: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** Logs a line, sent with the others within half a second. */
export function logLine(text: string) {
  pending.push(text);
  timer ??= setTimeout(flushLog, BATCH_MS);
}

/** Sends what's waiting now. */
export function flushLog() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!pending.length) return;
  const lines = pending;
  pending = [];
  void commands.logPage(page, lines).catch(() => {});
}

/** Starts the page's log as `name` (`editor`, `overlay`, `settings`), with its errors in it. */
export function startLog(name: string) {
  page = name;
  window.addEventListener("error", (e) => {
    logLine(`error: ${describe(e.error ?? e.message)}`);
    flushLog();
  });
  window.addEventListener("unhandledrejection", (e) => {
    logLine(`unhandled rejection: ${describe(e.reason)}`);
    flushLog();
  });
  window.addEventListener("pagehide", flushLog);
  // What the page reports itself, in the log as well as DevTools.
  for (const level of ["error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      logLine(`console.${level}: ${args.map(describe).join(" ")}`);
    };
  }
}

/** An error and its stack, the page's own address taken out of it (the bundle's file stays). */
export function describe(error: unknown): string {
  // A stack starts with the name and message.
  const text =
    error instanceof Error ? (error.stack ?? `${error.name}: ${error.message}`) : String(error);
  return text.split(location.origin).join("");
}
