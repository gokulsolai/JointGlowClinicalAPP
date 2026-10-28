import type { FacePose, Point } from './types';
import { LM, bbox, dist, faceWidth, pick } from './landmarks';

export interface LightStats {
  /** mean luminance (0..1) of the face area */
  mean: number;
  /** min(left,right)/max(left,right) luminance balance */
  balance: number;
}

export interface FrameAssessment {
  ok: boolean;
  /** primary instruction for the client/practitioner */
  hint: string;
  issues: string[];
  /** 0..1 how close the framing is to ideal */
  score: number;
}

export const CAPTURE_LIMITS = {
  minFaceFrac: 0.3,
  maxFaceFrac: 0.62,
  centerTol: 0.11,
  maxYaw: 10,
  maxPitch: 10,
  maxRoll: 8,
  minLight: 0.28,
  maxLight: 0.86,
  minBalance: 0.68,
};

/** Rough pose estimate from 2D landmarks (used when the transform matrix is unavailable). */
export function poseFromLandmarks(lm: Point[]): FacePose {
  const nose = lm[LM.NOSE_TIP];
  const l = lm[LM.CHEEKBONE_L];
  const r = lm[LM.CHEEKBONE_R];
  const dl = dist(nose, l);
  const dr = dist(nose, r);
  const yaw = ((dr - dl) / (dr + dl)) * 90;
  const eyeL = lm[LM.EYE_OUTER_L];
  const eyeR = lm[LM.EYE_OUTER_R];
  const roll = (Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x) * 180) / Math.PI;
  const eyeMidY = (eyeL.y + eyeR.y) / 2;
  const chinY = lm[LM.CHIN_BOTTOM].y;
  const t = (nose.y - eyeMidY) / Math.max(1, chinY - eyeMidY);
  const pitch = (0.42 - t) * 120;
  return { yaw, pitch, roll };
}

/** Evaluate whether a live frame is good enough for analysis. */
export function assessFrame(
  lm: Point[],
  frameW: number,
  frameH: number,
  pose: FacePose | null,
  blendshapes: Record<string, number>,
  light: LightStats | null,
  mirrored: boolean,
): FrameAssessment {
  const issues: string[] = [];
  const hints: string[] = [];
  const oval = pick(lm, LM.FACE_OVAL);
  const box = bbox(oval);
  const fw = faceWidth(lm);
  const frac = fw / frameW;
  const cx = (box.x + box.w / 2) / frameW - 0.5;
  const cy = (box.y + box.h / 2) / frameH - 0.5;
  let score = 1;

  if (frac < CAPTURE_LIMITS.minFaceFrac) {
    issues.push('too far');
    hints.push('Move closer');
    score -= 0.3;
  } else if (frac > CAPTURE_LIMITS.maxFaceFrac) {
    issues.push('too close');
    hints.push('Move back a little');
    score -= 0.3;
  }
  if (Math.abs(cx) > CAPTURE_LIMITS.centerTol || Math.abs(cy) > CAPTURE_LIMITS.centerTol) {
    issues.push('off-centre');
    const horiz = Math.abs(cx) > CAPTURE_LIMITS.centerTol ? ((cx > 0) !== mirrored ? 'left' : 'right') : '';
    const vert = Math.abs(cy) > CAPTURE_LIMITS.centerTol ? (cy > 0 ? 'up' : 'down') : '';
    hints.push(`Move ${[horiz, vert].filter(Boolean).join(' and ')}`);
    score -= 0.2;
  }
  const p = pose ?? poseFromLandmarks(lm);
  if (Math.abs(p.yaw) > CAPTURE_LIMITS.maxYaw) {
    issues.push('turned');
    hints.push('Face the camera straight on');
    score -= 0.25;
  }
  if (Math.abs(p.pitch) > CAPTURE_LIMITS.maxPitch) {
    issues.push('tilted');
    hints.push(p.pitch > 0 ? 'Lower your chin slightly' : 'Raise your chin slightly');
    score -= 0.25;
  }
  if (Math.abs(p.roll) > CAPTURE_LIMITS.maxRoll) {
    issues.push('head tilt');
    hints.push('Level your head');
    score -= 0.15;
  }
  const smile = Math.max(blendshapes.mouthSmileLeft ?? 0, blendshapes.mouthSmileRight ?? 0);
  const jawOpen = blendshapes.jawOpen ?? 0;
  const blink = Math.max(blendshapes.eyeBlinkLeft ?? 0, blendshapes.eyeBlinkRight ?? 0);
  const brow = Math.max(blendshapes.browInnerUp ?? 0, blendshapes.browDownLeft ?? 0, blendshapes.browDownRight ?? 0);
  if (smile > 0.35 || jawOpen > 0.18 || brow > 0.55) {
    issues.push('expression');
    hints.push('Relax your face, neutral expression');
    score -= 0.2;
  }
  if (blink > 0.5) {
    issues.push('eyes closed');
    hints.push('Keep your eyes open');
    score -= 0.2;
  }
  if (light) {
    if (light.mean < CAPTURE_LIMITS.minLight) {
      issues.push('too dark');
      hints.push('Find brighter, even lighting');
      score -= 0.25;
    } else if (light.mean > CAPTURE_LIMITS.maxLight) {
      issues.push('too bright');
      hints.push('Reduce direct light on the face');
      score -= 0.2;
    }
    if (light.balance < CAPTURE_LIMITS.minBalance) {
      issues.push('uneven light');
      hints.push('Face the light source so both sides are lit evenly');
      score -= 0.15;
    }
  }
  return {
    ok: issues.length === 0,
    hint: hints[0] ?? 'Hold still',
    issues,
    score: Math.max(0, score),
  };
}

/** Measure face-area lighting from a small downscaled copy of the frame. */
export function measureLight(video: CanvasImageSource, frameW: number, frameH: number, lm: Point[], scratch: HTMLCanvasElement): LightStats {
  const sw = 96;
  const sh = Math.max(1, Math.round((frameH / frameW) * sw));
  scratch.width = sw;
  scratch.height = sh;
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, sw, sh);
  const oval = pick(lm, LM.FACE_OVAL);
  const box = bbox(oval);
  const sx = sw / frameW;
  const x0 = Math.max(0, Math.floor((box.x + box.w * 0.15) * sx));
  const x1 = Math.min(sw, Math.ceil((box.x + box.w * 0.85) * sx));
  const y0 = Math.max(0, Math.floor((box.y + box.h * 0.2) * sx));
  const y1 = Math.min(sh, Math.ceil((box.y + box.h * 0.9) * sx));
  const img = ctx.getImageData(0, 0, sw, sh).data;
  const xm = (x0 + x1) / 2;
  let sum = 0;
  let n = 0;
  let sumL = 0;
  let nL = 0;
  let sumR = 0;
  let nR = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * sw + x) * 4;
      const l = (0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2]) / 255;
      sum += l;
      n++;
      if (x < xm) {
        sumL += l;
        nL++;
      } else {
        sumR += l;
        nR++;
      }
    }
  }
  const mean = n ? sum / n : 0;
  const ml = nL ? sumL / nL : 0;
  const mr = nR ? sumR / nR : 0;
  const balance = Math.max(ml, mr) > 0 ? Math.min(ml, mr) / Math.max(ml, mr) : 1;
  return { mean, balance };
}
