import type { Point } from './types';
import { LM, bbox, faceWidth, pick } from './landmarks';

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export async function fileToBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality);
  });
}

export async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob);
  const c = makeCanvas(bmp.width, bmp.height);
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}

/** Draw any image source to a new canvas of the given size (optionally mirrored). */
export function drawToCanvas(
  src: CanvasImageSource,
  w: number,
  h: number,
  mirror = false,
  srcW?: number,
  srcH?: number,
): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  if (srcW && srcH) ctx.drawImage(src, 0, 0, srcW, srcH, 0, 0, w, h);
  else ctx.drawImage(src, 0, 0, w, h);
  return c;
}

export interface CropResult {
  canvas: HTMLCanvasElement;
  landmarks: Point[];
}

/**
 * Crop the image to a 3:4 portrait box around the face (about 2.2 face widths wide),
 * limiting the output width, and transform the landmarks into the crop.
 */
export function cropToFace(src: HTMLCanvasElement, lm: Point[], maxWidth = 1080): CropResult {
  const fw = faceWidth(lm);
  const oval = pick(lm, LM.FACE_OVAL);
  const box = bbox(oval);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.46;
  let cw = Math.min(src.width, fw * 2.2);
  let ch = Math.min(src.height, (cw * 4) / 3);
  cw = Math.min(cw, (ch * 3) / 4);
  let x0 = cx - cw / 2;
  let y0 = cy - ch / 2;
  x0 = Math.max(0, Math.min(src.width - cw, x0));
  y0 = Math.max(0, Math.min(src.height - ch, y0));
  const outScale = Math.min(1, maxWidth / cw);
  const ow = Math.round(cw * outScale);
  const oh = Math.round(ch * outScale);
  const canvas = makeCanvas(ow, oh);
  canvas.getContext('2d')!.drawImage(src, x0, y0, cw, ch, 0, 0, ow, oh);
  const landmarks = lm.map((p) => ({ x: (p.x - x0) * outScale, y: (p.y - y0) * outScale }));
  return { canvas, landmarks };
}

/** Downscale a canvas so its width does not exceed maxWidth. Returns the scale factor applied. */
export function downscale(src: HTMLCanvasElement, maxWidth: number): { canvas: HTMLCanvasElement; scale: number } {
  const s = Math.min(1, maxWidth / src.width);
  if (s === 1) return { canvas: src, scale: 1 };
  const c = makeCanvas(src.width * s, src.height * s);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return { canvas: c, scale: s };
}

export function thumbnail(src: HTMLCanvasElement, size = 200): HTMLCanvasElement {
  const s = size / Math.max(src.width, src.height);
  return downscale(src, Math.round(src.width * s)).canvas;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
