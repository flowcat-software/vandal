import { useEffect, type RefObject } from "react";

/** How long the pointer rests before a long hint scrolls: about a tooltip's wait. */
const REST_MS = 1000;
/** The least time from one scroll's end to the next. */
const AGAIN_MS = 8000;
/** How long it stays scrolled to the end before gliding back. */
const PAUSE_MS = 1500;
/** Gliding speed, px a second. */
const SPEED = 60;

/** Ease in and out, `t` 0-1. */
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * A hint too long for the status bar (PLAN 3V.1, from Razorcat): once the pointer rests for about as long as a
 * tooltip takes, the line glides to show its end, waits, and glides back: once a rest, so a
 * pointer left alone doesn't keep it moving (a move and another rest show it again). A tooltip
 * wouldn't do: moving to it would change the hint. Starts over whenever `text` changes. Off
 * with `on` false or when Windows asks for less motion.
 */
export function useHintScroll(ref: RefObject<HTMLElement | null>, text: string, on: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !on || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    let frame = 0;
    let gliding = false;
    /** The next scroll comes no sooner than this (performance.now()). */
    let next = 0;

    const glide = (to: number, then: () => void) => {
      const from = el.scrollLeft;
      const ms = Math.max(600, (Math.abs(to - from) / SPEED) * 1000);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        el.scrollLeft = from + (to - from) * ease(t);
        if (t < 1) frame = requestAnimationFrame(step);
        else then();
      };
      frame = requestAnimationFrame(step);
    };
    const wait = (ms: number) => {
      clearTimeout(timer);
      timer = window.setTimeout(run, ms);
    };
    const run = () => {
      if (el.scrollWidth - el.clientWidth < 2) return;
      gliding = true;
      // Scrolling adds room after the end, clear of the fade: measured with it.
      el.dataset.scrolling = "";
      glide(el.scrollWidth - el.clientWidth, () => {
        timer = window.setTimeout(
          () =>
            glide(0, () => {
              gliding = false;
              delete el.dataset.scrolling;
              next = performance.now() + AGAIN_MS;
            }),
          PAUSE_MS,
        );
      });
    };
    // A move waits for the pointer to rest again; one under way finishes.
    const moved = () => {
      if (!gliding) wait(Math.max(REST_MS, next - performance.now()));
    };

    wait(REST_MS);
    window.addEventListener("pointermove", moved);
    return () => {
      window.removeEventListener("pointermove", moved);
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      el.scrollLeft = 0;
      delete el.dataset.scrolling;
    };
  }, [ref, text, on]);
}
