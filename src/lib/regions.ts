import type { Point } from './types';
import { LM, add, centroid, dist, faceWidth, norm, pick, scale, sub } from './landmarks';

export type Shape =
  | { kind: 'poly'; pts: Point[] }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot: number }
  | { kind: 'band'; pts: Point[]; width: number; closed?: boolean };

export type RegionId =
  | 'forehead'
  | 'foreheadCenter'
  | 'glabella'
  | 'crowsL'
  | 'crowsR'
  | 'underEyeL'
  | 'underEyeR'
  | 'cheekL'
  | 'cheekR'
  | 'malarL'
  | 'malarR'
  | 'submalarL'
  | 'submalarR'
  | 'nose'
  | 'chin'
  | 'lips'
  | 'perioral'
  | 'nasolabialL'
  | 'nasolabialR'
  | 'marionetteL'
  | 'marionetteR'
  | 'eyeL'
  | 'eyeR'
  | 'browL'
  | 'browR'
  | 'nostrils'
  | 'faceOval';

export type Regions = Record<RegionId, Shape[]>;

function poly(lm: Point[], idx: readonly number[]): Shape {
  return { kind: 'poly', pts: pick(lm, idx) };
}

function crowsFeet(lm: Point[], inner: number, outer: number): Shape {
  const pi = lm[inner];
  const po = lm[outer];
  const eyeW = dist(pi, po);
  const d = norm(sub(po, pi));
  let n = { x: -d.y, y: d.x };
  if (n.y < 0) n = { x: -n.x, y: -n.y }; // pointing down the image
  const c = add(add(po, scale(d, 0.5 * eyeW)), scale(n, 0.15 * eyeW));
  return { kind: 'ellipse', cx: c.x, cy: c.y, rx: 0.55 * eyeW, ry: 0.8 * eyeW, rot: Math.atan2(d.y, d.x) };
}

function ellipseAt(c: Point, rx: number, ry: number): Shape {
  return { kind: 'ellipse', cx: c.x, cy: c.y, rx, ry, rot: 0 };
}

/** Build all facial regions (in the same pixel space as the landmarks). */
export function buildRegions(lm: Point[]): Regions {
  const fw = faceWidth(lm);
  return {
    forehead: [poly(lm, LM.FOREHEAD)],
    foreheadCenter: [poly(lm, LM.FOREHEAD_CENTER)],
    glabella: [poly(lm, LM.GLABELLA)],
    crowsL: [crowsFeet(lm, LM.EYE_INNER_L, LM.EYE_OUTER_L)],
    crowsR: [crowsFeet(lm, LM.EYE_INNER_R, LM.EYE_OUTER_R)],
    underEyeL: [poly(lm, LM.UNDER_EYE_L)],
    underEyeR: [poly(lm, LM.UNDER_EYE_R)],
    cheekL: [poly(lm, LM.CHEEK_L)],
    cheekR: [poly(lm, LM.CHEEK_R)],
    malarL: [ellipseAt(centroid(pick(lm, LM.MALAR_L)), 0.09 * fw, 0.07 * fw)],
    malarR: [ellipseAt(centroid(pick(lm, LM.MALAR_R)), 0.09 * fw, 0.07 * fw)],
    submalarL: [ellipseAt(centroid(pick(lm, LM.SUBMALAR_L)), 0.08 * fw, 0.06 * fw)],
    submalarR: [ellipseAt(centroid(pick(lm, LM.SUBMALAR_R)), 0.08 * fw, 0.06 * fw)],
    nose: [poly(lm, LM.NOSE)],
    chin: [poly(lm, LM.CHIN)],
    lips: [poly(lm, LM.LIPS_OUTER)],
    perioral: [{ kind: 'band', pts: pick(lm, LM.LIPS_OUTER), width: 0.075 * fw, closed: true }],
    nasolabialL: [{ kind: 'band', pts: pick(lm, LM.NASOLABIAL_L), width: 0.085 * fw }],
    nasolabialR: [{ kind: 'band', pts: pick(lm, LM.NASOLABIAL_R), width: 0.085 * fw }],
    marionetteL: [{ kind: 'band', pts: pick(lm, LM.MARIONETTE_L), width: 0.075 * fw }],
    marionetteR: [{ kind: 'band', pts: pick(lm, LM.MARIONETTE_R), width: 0.075 * fw }],
    eyeL: [poly(lm, LM.EYE_L)],
    eyeR: [poly(lm, LM.EYE_R)],
    browL: [poly(lm, LM.BROW_L)],
    browR: [poly(lm, LM.BROW_R)],
    nostrils: [ellipseAt(lm[LM.NOSTRIL_L], 0.035 * fw, 0.025 * fw), ellipseAt(lm[LM.NOSTRIL_R], 0.035 * fw, 0.025 * fw)],
    faceOval: [poly(lm, LM.FACE_OVAL)],
  };
}

export interface DrawOptions {
  /** multiply coordinates by this factor (e.g. analysis downscale) */
  scale?: number;
  /** grow polygons/ellipses by stroking them with this width (pixels, pre-scale) */
  dilate?: number;
  /** 'fill' paints, 'cut' erases (destination-out) */
  mode?: 'fill' | 'cut';
  color?: string;
}

/** Draw shapes onto a 2D context. */
export function drawShapes(ctx: CanvasRenderingContext2D, shapes: Shape[], opts: DrawOptions = {}): void {
  const s = opts.scale ?? 1;
  const color = opts.color ?? '#fff';
  ctx.save();
  ctx.globalCompositeOperation = opts.mode === 'cut' ? 'destination-out' : 'source-over';
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const sh of shapes) {
    ctx.beginPath();
    if (sh.kind === 'poly') {
      sh.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
      ctx.closePath();
      ctx.fill();
      if (opts.dilate) {
        ctx.lineWidth = opts.dilate * s;
        ctx.stroke();
      }
    } else if (sh.kind === 'ellipse') {
      ctx.ellipse(sh.cx * s, sh.cy * s, Math.max(0.5, sh.rx * s), Math.max(0.5, sh.ry * s), sh.rot, 0, Math.PI * 2);
      ctx.fill();
      if (opts.dilate) {
        ctx.lineWidth = opts.dilate * s;
        ctx.stroke();
      }
    } else {
      sh.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
      if (sh.closed) ctx.closePath();
      ctx.lineWidth = (sh.width + (opts.dilate ?? 0)) * s;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Rasterize shapes into a 0..255 coverage mask at the given size. */
export function rasterize(
  shapes: Shape[],
  w: number,
  h: number,
  scaleFactor: number,
  cut: Shape[] = [],
  cutDilate = 0,
): Uint8Array {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  drawShapes(ctx, shapes, { scale: scaleFactor });
  if (cut.length) drawShapes(ctx, cut, { scale: scaleFactor, mode: 'cut', dilate: cutDilate });
  const img = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = img[i * 4 + 3];
  return out;
}
