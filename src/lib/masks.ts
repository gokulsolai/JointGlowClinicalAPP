import type { Point } from './types';
import { buildRegions, drawShapes, type Shape } from './regions';
import { faceWidth } from './landmarks';

export interface MaskCanvases {
  /** r: forehead, g: glabella, b: crow's feet, a: nasolabial + marionette bands */
  m1: HTMLCanvasElement;
  /** r: under-eye, g: lips, b: general skin, a: T-zone */
  m2: HTMLCanvasElement;
  /** r: perioral band, g: cheeks, b: chin, a: nose */
  m3: HTMLCanvasElement;
  width: number;
  height: number;
}

function channelCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  draw(ctx);
  return ctx.getImageData(0, 0, w, h).data;
}

function pack(w: number, h: number, chans: Uint8ClampedArray[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    img.data[i * 4] = chans[0][i * 4 + 3];
    img.data[i * 4 + 1] = chans[1][i * 4 + 3];
    img.data[i * 4 + 2] = chans[2][i * 4 + 3];
    img.data[i * 4 + 3] = chans[3][i * 4 + 3];
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Build the per-zone mask textures used by the simulator shader. The canvases are drawn at
 * `scale` x the image size; the renderer softens them with a GPU blur.
 */
export function buildMaskCanvases(lm: Point[], imgW: number, imgH: number, scale = 0.25): MaskCanvases {
  const w = Math.max(1, Math.round(imgW * scale));
  const h = Math.max(1, Math.round(imgH * scale));
  const fw = faceWidth(lm);
  const r = buildRegions(lm);
  const eyes: Shape[] = [...r.eyeL, ...r.eyeR];
  const brows: Shape[] = [...r.browL, ...r.browR];
  const lips = r.lips;
  const nostrils = r.nostrils;
  const excl = [...eyes, ...brows, ...lips, ...nostrils];
  const zone = (shapes: Shape[], cut: Shape[] = excl, cutDilate = 0.06 * fw) =>
    channelCanvas(w, h, (ctx) => {
      drawShapes(ctx, shapes, { scale });
      if (cut.length) drawShapes(ctx, cut, { scale, mode: 'cut', dilate: cutDilate });
    });

  const forehead = zone(r.forehead, brows, 0.05 * fw);
  const glabella = zone(r.glabella, [...brows, ...eyes], 0.04 * fw);
  const crows = zone([...r.crowsL, ...r.crowsR], [...eyes, ...brows], 0.05 * fw);
  const folds = zone([...r.nasolabialL, ...r.nasolabialR, ...r.marionetteL, ...r.marionetteR], [...lips, ...nostrils], 0.05 * fw);
  const underEye = zone([...r.underEyeL, ...r.underEyeR], eyes, 0.05 * fw);
  const lipsCh = zone(lips, []);
  const skin = zone(r.faceOval, excl, 0.09 * fw);
  const tzone = zone([...r.foreheadCenter, ...r.nose, ...r.chin], excl, 0.05 * fw);
  const perioral = zone(r.perioral, [...lips, ...nostrils], 0.04 * fw);
  const cheeks = zone([...r.cheekL, ...r.cheekR]);
  const chin = zone(r.chin, lips, 0.06 * fw);
  const nose = zone(r.nose, nostrils, 0.03 * fw);

  return {
    m1: pack(w, h, [forehead, glabella, crows, folds]),
    m2: pack(w, h, [underEye, lipsCh, skin, tzone]),
    m3: pack(w, h, [perioral, cheeks, chin, nose]),
    width: w,
    height: h,
  };
}
