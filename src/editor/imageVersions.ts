// The editor's image versions (PLAN 3Z). A resize makes a new image in Rust;
// the document says which one it shows (`imageVersion`), so undo and redo
// only switch numbers. This keeps the canvas and the redaction previews on
// the document's version, caches each version's pixels for instant undo, and
// tells Rust which versions the history still reaches.

import { docStore, type DocState } from "../markup/model/store";
import { versionsIn } from "../markup/model/resize";
import { useRedactSource } from "../markup/redact";
import { commands } from "../shared/ipc";

type Pixels = Uint8ClampedArray<ArrayBuffer>;

interface Frame {
  width: number;
  height: number;
  pixels: Pixels;
}

let canvas: HTMLCanvasElement | null = null;
/** The base image's URL: version n is at `${url}/v/${n}`. */
let baseUrl = "";
const frames = new Map<number, Frame>();
let painted = 0;
/** Made, not yet in the document: kept even though no history reaches them. */
const pending = new Set<number>();
/** The versions Rust was last told to keep, to tell it only of changes. */
let kept = "";
let unsubscribe: (() => void) | null = null;

/** Paint `frame` on the editor's canvas: the whole image, the stage clips the crop. */
export function paintFrame(target: HTMLCanvasElement, frame: Frame): void {
  target.width = frame.width;
  target.height = frame.height;
  const ctx = target.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas context.");
  ctx.putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
  // Redactions preview from these pixels (PLAN 3D.3); Detect text forgets
  // the old image's words.
  useRedactSource.setState({
    image: { x: 0, y: 0, width: frame.width, height: frame.height, data: frame.pixels },
  });
}

/** A new document (opened, flipped to): its image is version 0, painted already. */
export function startImageVersions(target: HTMLCanvasElement, url: string, base: Frame): void {
  canvas = target;
  baseUrl = url;
  frames.clear();
  frames.set(0, base);
  painted = 0;
  kept = "";
  unsubscribe ??= docStore.subscribe(follow);
}

/**
 * Resize the visible image to `width` × `height` (PLAN 3Z): Rust resamples
 * it, the page fetches the pixels, then the document moves onto them (one
 * undo step). Throws Rust's reason if it can't.
 */
export async function resizeImage(width: number, height: number): Promise<void> {
  const { doc } = docStore.getState();
  const crop = {
    x: Math.round(doc.crop.x),
    y: Math.round(doc.crop.y),
    width: Math.round(doc.crop.width),
    height: Math.round(doc.crop.height),
  };
  const result = await commands.editorResize(doc.imageVersion ?? 0, crop, width, height);
  if (result.status === "error") throw new Error(result.error);
  const image = result.data;
  pending.add(image.version);
  try {
    frames.set(image.version, {
      width: image.width,
      height: image.height,
      pixels: await fetchVersion(image.version),
    });
    // The document changed while Rust worked: resizing what's there now would
    // scale marks for an image they weren't made on.
    if (docStore.getState().doc !== doc) {
      frames.delete(image.version);
      throw new Error("The image changed while resizing. Try again.");
    }
  } finally {
    pending.delete(image.version);
  }
  docStore.getState().resize(image);
}

async function fetchVersion(version: number): Promise<Pixels> {
  const res = await fetch(`${baseUrl}/v/${version}`);
  if (!res.ok) throw new Error(`Couldn't load the resized image (HTTP ${res.status}).`);
  return new Uint8ClampedArray(await res.arrayBuffer());
}

/** On every document change: show its version, and let go of unreachable ones. */
function follow(s: DocState): void {
  if (!canvas) return;
  const version = s.doc.imageVersion ?? 0;
  if (version !== painted) {
    const frame = frames.get(version);
    if (frame) {
      paintFrame(canvas, frame);
      painted = version;
    } else {
      // Not cached (shouldn't happen: every reachable version is): fetch it.
      void fetchVersion(version).then((pixels) => {
        const f = { width: s.doc.source.width, height: s.doc.source.height, pixels };
        frames.set(version, f);
        if ((docStore.getState().doc.imageVersion ?? 0) === version && canvas) {
          paintFrame(canvas, f);
          painted = version;
        }
      });
    }
  }
  const reach = [...s.past, s.doc, ...s.future];
  if (s.gestureStart) reach.push(s.gestureStart);
  const keep = [...new Set([...versionsIn(reach), ...pending])].sort((a, b) => a - b);
  const key = keep.join(",");
  if (key !== kept) {
    kept = key;
    for (const v of [...frames.keys()]) if (v !== 0 && !keep.includes(v)) frames.delete(v);
    void commands.editorKeepVersions(keep);
  }
}
