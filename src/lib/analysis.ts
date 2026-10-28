import type { AnalysisResult, ConcernDef, ConcernId, ConcernScore, Confidence, Point, SkinTone } from './types';
import { buildRegions, rasterize, type Regions, type Shape } from './regions';
import { LM, SYMMETRY_PAIRS, clamp01, dist, faceHeight, faceWidth, mouthWidth } from './landmarks';

export const ANALYSIS_VERSION = 1;

export const CONCERNS: ConcernDef[] = [
  { id: 'forehead_lines', label: 'Forehead lines', group: 'lines', color: '#e4572e', description: 'Horizontal lines across the forehead from brow movement.' },
  { id: 'glabellar_lines', label: 'Frown lines', group: 'lines', color: '#d7263d', description: 'Vertical "11" lines between the brows.' },
  { id: 'crows_feet', label: "Crow's feet", group: 'lines', color: '#f28f3b', description: 'Radiating lines at the outer corners of the eyes.' },
  { id: 'perioral_lines', label: 'Lip lines', group: 'lines', color: '#c8553d', description: 'Fine vertical lines around the mouth.' },
  { id: 'nasolabial_folds', label: 'Nasolabial folds', group: 'volume', color: '#a23b72', description: 'Folds running from the nose to the corners of the mouth.' },
  { id: 'marionette_lines', label: 'Marionette lines', group: 'volume', color: '#8e3b8e', description: 'Lines from the mouth corners down toward the chin.' },
  { id: 'under_eye', label: 'Under-eye circles', group: 'skin', color: '#3b5bdb', description: 'Darkness and hollowing beneath the eyes.' },
  { id: 'pigmentation', label: 'Pigmentation & spots', group: 'skin', color: '#8d5524', description: 'Sun spots, freckling and uneven patches of tone.' },
  { id: 'redness', label: 'Redness', group: 'skin', color: '#e63946', description: 'Diffuse or patchy redness and visible vessels.' },
  { id: 'texture_pores', label: 'Texture & pores', group: 'skin', color: '#7b2cbf', description: 'Enlarged pores, roughness and surface irregularity.' },
  { id: 'oiliness', label: 'Shine & oiliness', group: 'skin', color: '#f4a261', description: 'Specular shine across the T-zone.' },
  { id: 'lip_volume', label: 'Lip volume', group: 'volume', color: '#d81159', description: 'Lip fullness relative to mouth width and facial proportions.' },
  { id: 'midface_volume', label: 'Midface volume', group: 'volume', color: '#ff6b6b', description: 'Flattening of the cheeks and loss of malar projection.' },
  { id: 'jawline', label: 'Jawline definition', group: 'structure', color: '#2a9d8f', description: 'Definition of the jaw angle and lower-face contour.' },
  { id: 'asymmetry', label: 'Facial asymmetry', group: 'structure', color: '#457b9d', description: 'Left/right differences in feature position.' },
];

export const CONCERN_BY_ID: Record<ConcernId, ConcernDef> = Object.fromEntries(CONCERNS.map((c) => [c.id, c])) as Record<ConcernId, ConcernDef>;

/** Raw metric -> 0..100 mapping. These are heuristic calibrations and are meant to be tuned. */
const CAL: Record<string, [number, number]> = {
  lines: [0.15, 2.4],
  perioral: [0.2, 2.6],
  folds: [0.6, 7.0],
  marionette: [0.3, 3.2],
  underEye: [4, 32],
  pigmentation: [0.35, 3.6],
  rednessGlobal: [10, 24],
  rednessLocal: [0.8, 4.0],
  texture: [1.4, 5.2],
  shine: [0.6, 9],
  lipRatio: [0.46, 0.2],
  midface: [0.12, -0.02],
  jawAngle: [125, 155],
  jawRatio: [0.9, 0.68],
  asymmetry: [0.025, 0.11],
};

function mapScore(key: string, v: number): number {
  const [lo, hi] = CAL[key];
  return Math.round(clamp01((v - lo) / (hi - lo)) * 100);
}

/* ---------- image fields ---------- */

export interface Fields {
  w: number;
  h: number;
  lum: Float32Array;
  b0: Float32Array;
  b1: Float32Array;
  b2: Float32Array;
  b3: Float32Array;
  a: Float32Array;
  bb: Float32Array;
  aBlur: Float32Array;
  rgb: Uint8ClampedArray;
  regions: Regions;
  masks: Partial<Record<string, Uint8Array>>;
  fw: number;
  lm: Point[];
  /** mean luminance of the cheeks (reference for under-eye darkness) */
  cheekLum: number;
}

function boxesForGauss(sigma: number, n: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  const sizes: number[] = [];
  for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
  return sizes;
}

function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const iarr = 1 / (r + r + 1);
  for (let i = 0; i < h; i++) {
    let ti = i * w;
    let li = ti;
    let ri = ti + r;
    const fv = src[ti];
    const lv = src[ti + w - 1];
    let val = (r + 1) * fv;
    for (let j = 0; j < r; j++) val += src[ti + j];
    for (let j = 0; j <= r; j++) {
      val += src[ri++] - fv;
      dst[ti++] = val * iarr;
    }
    for (let j = r + 1; j < w - r; j++) {
      val += src[ri++] - src[li++];
      dst[ti++] = val * iarr;
    }
    for (let j = w - r; j < w; j++) {
      val += lv - src[li++];
      dst[ti++] = val * iarr;
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const iarr = 1 / (r + r + 1);
  for (let i = 0; i < w; i++) {
    let ti = i;
    let li = ti;
    let ri = ti + r * w;
    const fv = src[ti];
    const lv = src[ti + w * (h - 1)];
    let val = (r + 1) * fv;
    for (let j = 0; j < r; j++) val += src[ti + j * w];
    for (let j = 0; j <= r; j++) {
      val += src[ri] - fv;
      dst[ti] = val * iarr;
      ri += w;
      ti += w;
    }
    for (let j = r + 1; j < h - r; j++) {
      val += src[ri] - src[li];
      dst[ti] = val * iarr;
      li += w;
      ri += w;
      ti += w;
    }
    for (let j = h - r; j < h; j++) {
      val += lv - src[li];
      dst[ti] = val * iarr;
      li += w;
      ti += w;
    }
  }
}

/** Fast Gaussian approximation (3 box blurs). Returns a new array. */
export function gaussianBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const boxes = boxesForGauss(Math.max(0.5, sigma), 3);
  const a = Float32Array.from(src);
  const b = new Float32Array(src.length);
  for (const size of boxes) {
    const r = Math.max(1, Math.min((size - 1) / 2, Math.floor(Math.min(w, h) / 2) - 1));
    boxBlurH(a, b, w, h, r);
    boxBlurV(b, a, w, h, r);
  }
  return a;
}

function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

const LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) LUT[i] = srgbToLinear(i);

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** Compute luminance and CIELAB a* and b* fields from image data. */
function computeFields(img: ImageData): { lum: Float32Array; a: Float32Array; bb: Float32Array; L: Float32Array } {
  const n = img.width * img.height;
  const lum = new Float32Array(n);
  const a = new Float32Array(n);
  const bb = new Float32Array(n);
  const L = new Float32Array(n);
  const d = img.data;
  for (let i = 0; i < n; i++) {
    const r = d[i * 4];
    const g = d[i * 4 + 1];
    const b = d[i * 4 + 2];
    lum[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const rl = LUT[r];
    const gl = LUT[g];
    const bl = LUT[b];
    const X = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
    const Y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
    const Z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
    const fx = labF(X);
    const fy = labF(Y);
    const fz = labF(Z);
    L[i] = 116 * fy - 16;
    a[i] = 500 * (fx - fy);
    bb[i] = 200 * (fy - fz);
  }
  return { lum, a, bb, L };
}

function meanIn(field: Float32Array, mask: Uint8Array): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 127) {
      s += field[i];
      n++;
    }
  }
  return n ? s / n : 0;
}

function meanRgbIn(rgb: Uint8ClampedArray, mask: Uint8Array): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 127) {
      r += rgb[i * 4];
      g += rgb[i * 4 + 1];
      b += rgb[i * 4 + 2];
      n++;
    }
  }
  if (!n) return [0.6, 0.45, 0.4];
  return [r / n / 255, g / n / 255, b / n / 255];
}

/**
 * Mean "dark fine structure" response in a region: how much darker the lightly-smoothed image is
 * than its neighbourhood, normalised by local brightness, with a noise floor removed. x100.
 */
function lineEnergy(f: Fields, mask: Uint8Array, fine: Float32Array, coarse: Float32Array, floor: number): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 127) {
      const v = (coarse[i] - fine[i]) / (f.b3[i] + 0.03) - floor;
      if (v > 0) s += v;
      n++;
    }
  }
  return n ? (s / n) * 100 : 0;
}

function textureEnergy(f: Fields, mask: Uint8Array): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 127) {
      s += Math.abs(f.b0[i] - f.b1[i]) / (f.b3[i] + 0.03);
      n++;
    }
  }
  return n ? (s / n) * 100 : 0;
}

function shineFraction(f: Fields, mask: Uint8Array): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 127) {
      if (f.lum[i] - f.b2[i] > 0.07 && f.lum[i] > 0.55) s++;
      n++;
    }
  }
  return n ? (s / n) * 100 : 0;
}

function localRedness(f: Fields, mask: Uint8Array): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 127) {
      const v = f.a[i] - f.aBlur[i];
      if (v > 1.5) s += v - 1.5;
      n++;
    }
  }
  return n ? s / n : 0;
}

function union(...masks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(masks[0].length);
  for (const m of masks) for (let i = 0; i < out.length; i++) if (m[i] > out[i]) out[i] = m[i];
  return out;
}

function angleAt(p: Point, a: Point, b: Point): number {
  const v1 = { x: a.x - p.x, y: a.y - p.y };
  const v2 = { x: b.x - p.x, y: b.y - p.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const l = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, dot / l))) * 180) / Math.PI;
}

function skinToneFrom(L: number, a: number, b: number): SkinTone {
  const ita = (Math.atan2(L - 50, b) * 180) / Math.PI;
  let category = 'Dark';
  if (ita > 55) category = 'Very light';
  else if (ita > 41) category = 'Light';
  else if (ita > 28) category = 'Intermediate';
  else if (ita > 10) category = 'Tan';
  else if (ita > -30) category = 'Brown';
  return { ita: Math.round(ita), category, L: Math.round(L), a: Math.round(a * 10) / 10, b: Math.round(b * 10) / 10 };
}

function conf(v: Confidence): Confidence {
  return v;
}

export interface AnalysisOutput {
  result: AnalysisResult;
  fields: Fields;
}

/**
 * Analyse a face photo. `lm` must be in the pixel space of `img`.
 * `mirrored` tells whether viewer-left corresponds to the client's left.
 */
export function analyzeFace(img: ImageData, lm: Point[], mirrored: boolean): AnalysisOutput {
  const w = img.width;
  const h = img.height;
  const fw = faceWidth(lm);
  const fh = faceHeight(lm);
  const { lum, a, bb, L } = computeFields(img);
  const s0 = 0.005 * fw;
  const s1 = 0.012 * fw;
  const s2 = 0.03 * fw;
  const s3 = 0.08 * fw;
  const b0 = gaussianBlur(lum, w, h, s0);
  const b1 = gaussianBlur(lum, w, h, s1);
  const b2 = gaussianBlur(lum, w, h, s2);
  const b3 = gaussianBlur(lum, w, h, s3);
  const aBlur = gaussianBlur(a, w, h, s3);
  const regions = buildRegions(lm);
  const f: Fields = { w, h, lum, b0, b1, b2, b3, a, bb, aBlur, rgb: img.data, regions, masks: {}, fw, lm, cheekLum: 0.5 };

  const exclusions: Shape[] = [...regions.eyeL, ...regions.eyeR, ...regions.browL, ...regions.browR, ...regions.lips, ...regions.nostrils];
  const R = (ids: Array<keyof Regions>, cut: Shape[] = exclusions, cutDilate = 0.05 * fw): Uint8Array => {
    const key = ids.join('+');
    if (!f.masks[key]) f.masks[key] = rasterize(ids.flatMap((id) => regions[id]), w, h, 1, cut, cutDilate);
    return f.masks[key]!;
  };

  const mForehead = R(['forehead']);
  const mGlabella = R(['glabella']);
  const mCrowsL = R(['crowsL']);
  const mCrowsR = R(['crowsR']);
  const mPerioral = R(['perioral'], [...regions.lips, ...regions.nostrils], 0.03 * fw);
  const mNasoL = R(['nasolabialL']);
  const mNasoR = R(['nasolabialR']);
  const mMarL = R(['marionetteL']);
  const mMarR = R(['marionetteR']);
  const mUnderL = R(['underEyeL'], [...regions.eyeL], 0.04 * fw);
  const mUnderR = R(['underEyeR'], [...regions.eyeR], 0.04 * fw);
  const mCheekL = R(['cheekL']);
  const mCheekR = R(['cheekR']);
  const mNose = R(['nose'], [...regions.nostrils], 0.03 * fw);
  const mTzone = R(['foreheadCenter', 'nose', 'chin']);
  const mSkin = R(['faceOval'], exclusions, 0.08 * fw);
  const mMalarL = R(['malarL']);
  const mMalarR = R(['malarR']);
  const mSubL = R(['submalarL']);
  const mSubR = R(['submalarR']);
  const mCheeks = union(mCheekL, mCheekR);
  const mPigment = union(mCheekL, mCheekR, mForehead, mNose);
  f.cheekLum = meanIn(lum, mCheeks);

  const metrics: Record<string, number> = {};
  const concerns: ConcernScore[] = [];
  const sideLabel = (l: number, r: number): string => {
    if (Math.abs(l - r) < 12) return 'Similar on both sides';
    const strongerViewerLeft = l > r;
    const clientLeft = mirrored ? strongerViewerLeft : !strongerViewerLeft;
    return `More pronounced on the client's ${clientLeft ? 'left' : 'right'}`;
  };
  const sides = (l: number, r: number): { left: number; right: number } => (mirrored ? { left: l, right: r } : { left: r, right: l });

  // --- lines
  const foreheadE = lineEnergy(f, mForehead, b0, b1, 0.02);
  metrics.foreheadLines = foreheadE;
  concerns.push({ id: 'forehead_lines', score: mapScore('lines', foreheadE), confidence: conf('medium'), note: 'Static horizontal lines detected across the forehead region.' });

  const glabE = lineEnergy(f, mGlabella, b0, b1, 0.02);
  metrics.glabellarLines = glabE;
  concerns.push({ id: 'glabellar_lines', score: mapScore('lines', glabE), confidence: conf('medium'), note: 'Vertical creasing between the brows.' });

  const crowsRawL = lineEnergy(f, mCrowsL, b0, b1, 0.02);
  const crowsRawR = lineEnergy(f, mCrowsR, b0, b1, 0.02);
  const crowsL = mapScore('lines', crowsRawL);
  const crowsR = mapScore('lines', crowsRawR);
  metrics.crowsFeetRawL = crowsRawL;
  metrics.crowsFeetRawR = crowsRawR;
  concerns.push({ id: 'crows_feet', score: Math.round((crowsL + crowsR) / 2), confidence: conf('medium'), note: sideLabel(crowsL, crowsR), sides: sides(crowsL, crowsR) });

  const perioralE = lineEnergy(f, mPerioral, b0, b1, 0.02);
  metrics.perioralLines = perioralE;
  concerns.push({ id: 'perioral_lines', score: mapScore('perioral', perioralE), confidence: conf('low'), note: 'Fine vertical lines around the vermilion border.' });

  // --- folds (groove shadow at mid scale + crease)
  const foldMetric = (m: Uint8Array): number => 0.6 * lineEnergy(f, m, b2, b3, 0.015) + 0.4 * lineEnergy(f, m, b0, b1, 0.02);
  const nasoRawL = foldMetric(mNasoL);
  const nasoRawR = foldMetric(mNasoR);
  const nasoL = mapScore('folds', nasoRawL);
  const nasoR = mapScore('folds', nasoRawR);
  metrics.nasolabialRawL = nasoRawL;
  metrics.nasolabialRawR = nasoRawR;
  concerns.push({ id: 'nasolabial_folds', score: Math.round((nasoL + nasoR) / 2), confidence: conf('medium'), note: sideLabel(nasoL, nasoR), sides: sides(nasoL, nasoR) });

  const marRawL = foldMetric(mMarL);
  const marRawR = foldMetric(mMarR);
  const marL = mapScore('marionette', marRawL);
  const marR = mapScore('marionette', marRawR);
  metrics.marionetteRawL = marRawL;
  metrics.marionetteRawR = marRawR;
  concerns.push({ id: 'marionette_lines', score: Math.round((marL + marR) / 2), confidence: conf('low'), note: sideLabel(marL, marR), sides: sides(marL, marR) });

  // --- under-eye darkness relative to the cheek
  const ueMetric = (mU: Uint8Array, mC: Uint8Array): number => {
    const lu = meanIn(lum, mU);
    const lc = meanIn(lum, mC);
    const dark = lc > 0 ? ((lc - lu) / lc) * 100 : 0;
    const blue = meanIn(bb, mC) - meanIn(bb, mU);
    return Math.max(0, dark) + Math.max(0, blue) * 0.6;
  };
  const ueRawL = ueMetric(mUnderL, mCheekL);
  const ueRawR = ueMetric(mUnderR, mCheekR);
  const ueL = mapScore('underEye', ueRawL);
  const ueR = mapScore('underEye', ueRawR);
  metrics.underEyeRawL = ueRawL;
  metrics.underEyeRawR = ueRawR;
  concerns.push({ id: 'under_eye', score: Math.round((ueL + ueR) / 2), confidence: conf('medium'), note: sideLabel(ueL, ueR), sides: sides(ueL, ueR) });

  // --- pigmentation: dark blobs at freckle and patch scales
  const pigE = lineEnergy(f, mPigment, b1, b2, 0.025) + 0.7 * lineEnergy(f, mPigment, b2, b3, 0.03);
  metrics.pigmentation = pigE;
  concerns.push({ id: 'pigmentation', score: mapScore('pigmentation', pigE), confidence: conf('medium'), note: 'Localised darker spots and patches relative to surrounding skin.' });

  // --- redness
  const aMean = meanIn(a, mSkin);
  const redLocal = localRedness(f, union(mCheeks, mNose));
  metrics.rednessGlobal = aMean;
  metrics.rednessLocal = redLocal;
  const rednessScore = Math.round(0.55 * mapScore('rednessGlobal', aMean) + 0.45 * mapScore('rednessLocal', redLocal));
  concerns.push({ id: 'redness', score: rednessScore, confidence: conf('medium'), note: redLocal > 2 ? 'Patchy redness concentrated on the cheeks and nose.' : 'Overall skin tone redness.' });

  // --- texture
  const texE = textureEnergy(f, union(mCheeks, mNose));
  metrics.texture = texE;
  concerns.push({ id: 'texture_pores', score: mapScore('texture', texE), confidence: conf('medium'), note: 'Fine-scale surface irregularity across cheeks and nose.' });

  // --- shine
  const shine = shineFraction(f, mTzone);
  metrics.shine = shine;
  concerns.push({ id: 'oiliness', score: mapScore('shine', shine), confidence: conf('low'), note: 'Specular highlights across the T-zone (lighting dependent).' });

  // --- lip volume
  const lipH = dist(lm[LM.LIP_TOP], lm[LM.LIP_BOTTOM]);
  const mw = mouthWidth(lm);
  const lipRatio = lipH / mw;
  const upper = dist(lm[LM.LIP_TOP], lm[LM.LIP_INNER_TOP]);
  const lower = dist(lm[LM.LIP_INNER_BOTTOM], lm[LM.LIP_BOTTOM]);
  metrics.lipRatio = lipRatio;
  metrics.lipUpperLower = lower > 0 ? upper / lower : 1;
  concerns.push({
    id: 'lip_volume',
    score: mapScore('lipRatio', lipRatio),
    confidence: conf('high'),
    note: `Lip height is ${Math.round(lipRatio * 100)}% of mouth width; upper:lower ratio 1:${(lower / Math.max(upper, 1)).toFixed(1)}.`,
  });

  // --- midface volume (malar highlight vs submalar shadow)
  const malarContrast = (mM: Uint8Array, mS: Uint8Array): number => {
    const lmM = meanIn(lum, mM);
    const lmS = meanIn(lum, mS);
    return lmM > 0 ? (lmM - lmS) / lmM : 0;
  };
  const mfL = malarContrast(mMalarL, mSubL);
  const mfR = malarContrast(mMalarR, mSubR);
  metrics.midfaceContrast = (mfL + mfR) / 2;
  concerns.push({ id: 'midface_volume', score: mapScore('midface', (mfL + mfR) / 2), confidence: conf('low'), note: 'Estimated from cheek highlight-to-shadow contrast; lighting dependent.' });

  // --- jawline
  const angL = angleAt(lm[LM.JAW_L], lm[LM.CHIN_BOTTOM], lm[LM.CHEEKBONE_L]);
  const angR = angleAt(lm[LM.JAW_R], lm[LM.CHIN_BOTTOM], lm[LM.CHEEKBONE_R]);
  const jawRatio = dist(lm[LM.JAW_ANGLE_L], lm[LM.JAW_ANGLE_R]) / fw;
  metrics.jawAngle = (angL + angR) / 2;
  metrics.jawRatio = jawRatio;
  const jawScore = Math.round(0.5 * mapScore('jawAngle', (angL + angR) / 2) + 0.5 * mapScore('jawRatio', jawRatio));
  concerns.push({ id: 'jawline', score: jawScore, confidence: conf('low'), note: `Jaw angle about ${Math.round((angL + angR) / 2)}°, jaw width ${Math.round(jawRatio * 100)}% of cheekbone width.` });

  // --- asymmetry about the vertical midline
  const top = lm[LM.FOREHEAD_TOP];
  const bottom = lm[LM.CHIN_BOTTOM];
  const axis = { x: bottom.x - top.x, y: bottom.y - top.y };
  const al = Math.hypot(axis.x, axis.y) || 1;
  axis.x /= al;
  axis.y /= al;
  const proj = (p: Point): { t: number; d: number } => {
    const vx = p.x - top.x;
    const vy = p.y - top.y;
    return { t: (vx * axis.x + vy * axis.y) / fh, d: (vx * -axis.y + vy * axis.x) / fw };
  };
  let asym = 0;
  for (const [l, r] of SYMMETRY_PAIRS) {
    const pl = proj(lm[l]);
    const pr = proj(lm[r]);
    asym += Math.abs(pl.t - pr.t) + Math.abs(Math.abs(pl.d) - Math.abs(pr.d));
  }
  asym /= SYMMETRY_PAIRS.length;
  asym += 0.5 * (Math.abs(proj(lm[LM.NOSE_TIP]).d) + Math.abs(proj(lm[LM.LIP_INNER_TOP]).d));
  metrics.asymmetry = asym;
  concerns.push({ id: 'asymmetry', score: mapScore('asymmetry', asym), confidence: conf('medium'), note: 'Mild asymmetry is normal; larger values may reflect head rotation at capture.' });

  // --- composites
  const skinIds: ConcernId[] = ['forehead_lines', 'glabellar_lines', 'crows_feet', 'perioral_lines', 'under_eye', 'pigmentation', 'redness', 'texture_pores'];
  const skinAvg = skinIds.reduce((s, id) => s + (concerns.find((c) => c.id === id)?.score ?? 0), 0) / skinIds.length;
  const overallSkin = Math.round(100 - skinAvg);

  const skinMean = meanRgbIn(img.data, mSkin);
  const cheekMean = meanRgbIn(img.data, mCheeks);
  const skinTone = skinToneFrom(meanIn(L, mSkin), aMean, meanIn(bb, mSkin));

  const result: AnalysisResult = {
    version: ANALYSIS_VERSION,
    concerns,
    overallSkin,
    skinMean,
    cheekMean,
    globalRedness: clamp01((aMean - 11) / 14),
    skinTone,
    faceWidth: fw,
    metrics,
  };
  return { result, fields: f };
}

/* ---------- heatmaps ---------- */

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Build an RGBA overlay for one concern at the analysis resolution.
 * Line/skin concerns render the detected structures; volume/structure concerns shade their regions.
 */
export function buildHeatmap(f: Fields, concern: ConcernId, score: number): ImageData {
  const { w, h, regions } = f;
  const out = new ImageData(w, h);
  const [cr, cg, cb] = hexToRgb(CONCERN_BY_ID[concern].color);
  const exclusions: Shape[] = [...regions.eyeL, ...regions.eyeR, ...regions.browL, ...regions.browR, ...regions.lips, ...regions.nostrils];
  const mask = (ids: Array<keyof Regions>, cut: Shape[] = exclusions, dil = 0.05 * f.fw): Uint8Array => {
    const key = ids.join('+');
    if (!f.masks[key]) f.masks[key] = rasterize(ids.flatMap((id) => regions[id]), w, h, 1, cut, dil);
    return f.masks[key]!;
  };
  const paintField = (m: Uint8Array, value: (i: number) => number, gain: number): void => {
    for (let i = 0; i < m.length; i++) {
      if (m[i] < 8) continue;
      const v = Math.min(1, Math.max(0, value(i)) * gain);
      if (v <= 0.02) continue;
      out.data[i * 4] = cr;
      out.data[i * 4 + 1] = cg;
      out.data[i * 4 + 2] = cb;
      out.data[i * 4 + 3] = Math.round(v * 230 * (m[i] / 255));
    }
  };
  const paintRegion = (m: Uint8Array, alpha: number): void => {
    for (let i = 0; i < m.length; i++) {
      if (m[i] < 8) continue;
      out.data[i * 4] = cr;
      out.data[i * 4 + 1] = cg;
      out.data[i * 4 + 2] = cb;
      out.data[i * 4 + 3] = Math.round(alpha * 255 * (m[i] / 255));
    }
  };
  const lineVal = (fine: Float32Array, coarse: Float32Array, floor: number) => (i: number) => (coarse[i] - fine[i]) / (f.b3[i] + 0.03) - floor;
  switch (concern) {
    case 'forehead_lines':
      paintField(mask(['forehead']), lineVal(f.b0, f.b1, 0.02), 12);
      break;
    case 'glabellar_lines':
      paintField(mask(['glabella']), lineVal(f.b0, f.b1, 0.02), 12);
      break;
    case 'crows_feet':
      paintField(mask(['crowsL', 'crowsR']), lineVal(f.b0, f.b1, 0.02), 12);
      break;
    case 'perioral_lines':
      paintField(mask(['perioral'], [...regions.lips, ...regions.nostrils], 0.03 * f.fw), lineVal(f.b0, f.b1, 0.02), 12);
      break;
    case 'nasolabial_folds':
      paintField(mask(['nasolabialL', 'nasolabialR']), (i) => 0.6 * lineVal(f.b2, f.b3, 0.015)(i) + 0.4 * lineVal(f.b0, f.b1, 0.02)(i), 10);
      break;
    case 'marionette_lines':
      paintField(mask(['marionetteL', 'marionetteR']), (i) => 0.6 * lineVal(f.b2, f.b3, 0.015)(i) + 0.4 * lineVal(f.b0, f.b1, 0.02)(i), 10);
      break;
    case 'under_eye':
      paintField(mask(['underEyeL', 'underEyeR'], [...regions.eyeL, ...regions.eyeR], 0.04 * f.fw), (i) => (f.cheekLum - f.lum[i]) / Math.max(0.05, f.cheekLum) - 0.04, 2.5);
      break;
    case 'pigmentation':
      paintField(mask(['cheekL', 'cheekR', 'forehead', 'nose'], [...exclusions, ...regions.nasolabialL, ...regions.nasolabialR], 0.04 * f.fw), (i) => lineVal(f.b1, f.b2, 0.025)(i) + 0.7 * lineVal(f.b2, f.b3, 0.03)(i), 9);
      break;
    case 'redness':
      paintField(mask(['cheekL', 'cheekR', 'nose', 'forehead', 'chin']), (i) => (f.a[i] - f.aBlur[i] - 1.5) / 8 + (score / 100) * 0.25, 1);
      break;
    case 'texture_pores':
      paintField(mask(['cheekL', 'cheekR', 'nose']), (i) => Math.abs(f.b0[i] - f.b1[i]) / (f.b3[i] + 0.03) - 0.01, 14);
      break;
    case 'oiliness':
      paintField(mask(['foreheadCenter', 'nose', 'chin']), (i) => (f.lum[i] - f.b2[i] - 0.05) * 6, 1);
      break;
    case 'lip_volume':
      paintRegion(rasterize(regions.lips, w, h, 1), 0.2 + (score / 100) * 0.5);
      break;
    case 'midface_volume':
      paintRegion(rasterize([...regions.malarL, ...regions.malarR], w, h, 1), 0.2 + (score / 100) * 0.5);
      break;
    case 'jawline':
      paintRegion(rasterize([{ kind: 'band', pts: LM.JAW_LINE.map((i) => f.lm[i]), width: 0.06 * f.fw }], w, h, 1), 0.2 + (score / 100) * 0.5);
      break;
    case 'asymmetry':
      paintRegion(rasterize(regions.faceOval, w, h, 1), 0.08 + (score / 100) * 0.3);
      break;
  }
  return out;
}

