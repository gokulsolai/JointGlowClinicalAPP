import type { Point } from './types';

/**
 * MediaPipe Face Landmarker indices (478-point mesh).
 * "L" means the viewer's left side of a non-mirrored image (the subject's right side).
 * With a mirrored front-camera capture, viewer-left is the client's left.
 */
export const LM = {
  FACE_OVAL: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  LIPS_OUTER: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
  LIPS_INNER: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],
  EYE_L: [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
  EYE_R: [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249],
  BROW_L: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  BROW_R: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  UNDER_EYE_L: [33, 7, 163, 144, 145, 153, 154, 155, 133, 245, 128, 121, 120, 119, 118, 117, 111],
  UNDER_EYE_R: [263, 249, 390, 373, 374, 380, 381, 382, 362, 465, 357, 350, 349, 348, 347, 346, 340],
  CHEEK_L: [111, 117, 118, 119, 120, 121, 47, 126, 142, 36, 205, 187, 147, 123, 116],
  CHEEK_R: [340, 346, 347, 348, 349, 350, 277, 355, 371, 266, 425, 411, 376, 352, 345],
  FOREHEAD: [21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 301, 298, 333, 299, 337, 151, 108, 69, 104, 68, 71],
  FOREHEAD_CENTER: [67, 109, 10, 338, 297, 299, 337, 151, 108, 69],
  GLABELLA: [108, 151, 337, 336, 285, 417, 168, 193, 55, 107],
  NOSE: [168, 417, 351, 419, 248, 281, 275, 440, 344, 278, 294, 327, 326, 2, 97, 98, 64, 48, 115, 220, 45, 51, 3, 196, 122, 193],
  CHIN: [18, 83, 182, 106, 204, 194, 32, 140, 171, 175, 396, 369, 262, 418, 424, 335, 406, 313],
  NASOLABIAL_L: [129, 203, 206, 216, 212, 57],
  NASOLABIAL_R: [358, 423, 426, 436, 432, 287],
  MARIONETTE_L: [43, 202, 210],
  MARIONETTE_R: [273, 422, 430],
  JAW_LINE: [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397],
  MALAR_L: [50, 117, 118, 101],
  MALAR_R: [280, 346, 347, 330],
  SUBMALAR_L: [205, 207, 187],
  SUBMALAR_R: [425, 427, 411],
  NOSTRIL_L: 98,
  NOSTRIL_R: 327,

  NOSE_TIP: 1,
  NASION: 168,
  SUBNASALE: 2,
  CHIN_BOTTOM: 152,
  CHIN_MID: 199,
  FOREHEAD_TOP: 10,
  MOUTH_L: 61,
  MOUTH_R: 291,
  LIP_TOP: 0,
  LIP_BOTTOM: 17,
  LIP_INNER_TOP: 13,
  LIP_INNER_BOTTOM: 14,
  EYE_OUTER_L: 33,
  EYE_INNER_L: 133,
  EYE_OUTER_R: 263,
  EYE_INNER_R: 362,
  CHEEKBONE_L: 234,
  CHEEKBONE_R: 454,
  CHEEK_APPLE_L: 50,
  CHEEK_APPLE_R: 280,
  JAW_ANGLE_L: 58,
  JAW_ANGLE_R: 288,
  JAW_L: 172,
  JAW_R: 397,
  JOWL_L: 136,
  JOWL_R: 365,
  BROW_TAIL_L: 70,
  BROW_TAIL_R: 300,
  IRIS_L: 468,
  IRIS_R: 473,
} as const;

/** Pairs of mirrored landmarks (viewer-left, viewer-right) used for symmetry analysis. */
export const SYMMETRY_PAIRS: Array<[number, number]> = [
  [33, 263],
  [133, 362],
  [61, 291],
  [70, 300],
  [107, 336],
  [234, 454],
  [58, 288],
  [50, 280],
  [172, 397],
  [48, 278],
];

export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Point, s: number): Point => ({ x: a.x * s, y: a.y * s });
export const norm = (a: Point): Point => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};

export function centroid(pts: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

export const pick = (lm: Point[], idx: readonly number[]): Point[] => idx.map((i) => lm[i]);

export function faceWidth(lm: Point[]): number {
  return dist(lm[LM.CHEEKBONE_L], lm[LM.CHEEKBONE_R]);
}

export function faceHeight(lm: Point[]): number {
  return dist(lm[LM.FOREHEAD_TOP], lm[LM.CHIN_BOTTOM]);
}

export function mouthWidth(lm: Point[]): number {
  return dist(lm[LM.MOUTH_L], lm[LM.MOUTH_R]);
}

export function faceCenter(lm: Point[]): Point {
  return centroid(pick(lm, LM.FACE_OVAL));
}

export function bbox(pts: Point[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
