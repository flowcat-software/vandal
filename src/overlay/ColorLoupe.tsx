import { useLayoutEffect, useRef } from "react";
import { useRedactSource } from "../markup/redact";
import type { Point } from "./selection";
import { hexAt, loupePixels } from "./loupe";
import styles from "./OverlayApp.module.css";

/** Pixels across the loupe (odd, so one is in the middle). */
const CELLS = 11;
/** CSS px per magnified pixel. */
const CELL = 10;
const SIZE = CELLS * CELL;

interface Props {
  /** The pixel being pointed at, in this monitor's physical px. */
  point: Point;
  /** Physical px per CSS px. */
  scale: number;
  /** The monitor's size in CSS px, to keep the readout on screen. */
  view: { width: number; height: number };
}

/**
 * The eyedropper's round magnifier (PLAN 3U), centred on the pointer in place
 * of the cursor: the pixels around it with the picked one outlined, and its
 * color underneath.
 */
export function ColorLoupe({ point, scale, view }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useRedactSource((s) => s.image);

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !frame) return;
    const px = loupePixels(frame, point.x, point.y, CELLS);
    ctx.putImageData(new ImageData(px, CELLS, CELLS), 0, 0);
  }, [frame, point.x, point.y]);

  if (!frame) return null;
  const hex = hexAt(frame, point.x, point.y);
  const left = point.x / scale;
  const top = point.y / scale;
  // The readout goes under the loupe, or above it at the bottom of the screen.
  const below = top + SIZE / 2 + 34 <= view.height;

  return (
    <div className={styles.loupe} style={{ left, top }}>
      <div className={styles.loupeLens} style={{ width: SIZE, height: SIZE }}>
        <canvas ref={canvasRef} width={CELLS} height={CELLS} className={styles.loupePixels} />
        <div className={styles.loupeGrid} style={{ backgroundSize: `${CELL}px ${CELL}px` }} />
        <div
          className={styles.loupeCentre}
          style={{ left: (SIZE - CELL) / 2, top: (SIZE - CELL) / 2, width: CELL, height: CELL }}
        />
      </div>
      {hex && (
        <div
          className={styles.loupeReadout}
          style={below ? { top: SIZE / 2 + 8 } : { bottom: SIZE / 2 + 8 }}
        >
          <span className={styles.loupeSwatch} style={{ background: hex }} />
          {hex.toUpperCase()}
        </div>
      )}
    </div>
  );
}
