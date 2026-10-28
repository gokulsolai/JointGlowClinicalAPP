import type { FaceCapture, Point } from './types';
import { detectImage, parseResult } from './faceMesh';
import { cropToFace, downscale, makeCanvas } from './image';
import { analyzeFace, type AnalysisOutput } from './analysis';
import { faceWidth } from './landmarks';

export interface ProcessedPhoto {
  photo: HTMLCanvasElement;
  capture: FaceCapture;
  analysis: AnalysisOutput;
  /** scale from photo pixels to analysis pixels */
  analysisScale: number;
}

export class NoFaceError extends Error {
  constructor() {
    super('No face was detected in the photo. Make sure the face is well lit, centred and unobstructed.');
  }
}

/** Target face width (px) for the analysis pass. */
const ANALYSIS_FACE_WIDTH = 300;

/**
 * Full pipeline for a still photo: detect landmarks, crop to the face, run the analysis.
 */
export async function processPhoto(source: HTMLCanvasElement, mirrored: boolean, origin: 'camera' | 'upload'): Promise<ProcessedPhoto> {
  const res = await detectImage(source);
  const parsed = parseResult(res, source.width, source.height);
  if (!parsed) throw new NoFaceError();
  const { canvas: photo, landmarks } = cropToFace(source, parsed.landmarks, 1080);
  const capture: FaceCapture = {
    width: photo.width,
    height: photo.height,
    mirrored,
    landmarks,
    blendshapes: parsed.blendshapes,
    pose: parsed.pose,
    source: origin,
  };
  const analysis = runAnalysis(photo, landmarks, mirrored);
  return { photo, capture, analysis: analysis.output, analysisScale: analysis.scale };
}

/** Run (or re-run) the analysis on a photo with known landmarks. */
export function runAnalysis(photo: HTMLCanvasElement, landmarks: Point[], mirrored: boolean): { output: AnalysisOutput; scale: number } {
  const fw = faceWidth(landmarks);
  const targetScale = Math.min(1, ANALYSIS_FACE_WIDTH / fw);
  const { canvas, scale } = downscale(photo, Math.round(photo.width * targetScale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const lm = landmarks.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const output = analyzeFace(img, lm, mirrored);
  (window as unknown as { __jgLastAnalysis?: unknown }).__jgLastAnalysis = output.result;
  return { output, scale };
}

/** Load an uploaded image file into a canvas no larger than maxDim on its longest side. */
export async function fileToCanvas(file: Blob, maxDim = 2000): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const c = makeCanvas(bmp.width * s, bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}
