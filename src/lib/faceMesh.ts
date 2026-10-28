import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { FacePose, Point } from './types';

type RunningMode = 'IMAGE' | 'VIDEO';

let landmarker: FaceLandmarker | null = null;
let loading: Promise<FaceLandmarker> | null = null;
let mode: RunningMode = 'VIDEO';

const base = import.meta.env.BASE_URL;
export const WASM_PATH = `${base}wasm`;
export const MODEL_PATH = `${base}models/face_landmarker.task`;

async function create(delegate: 'GPU' | 'CPU', running: RunningMode): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: running,
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/** Load (once) the MediaPipe Face Landmarker. GPU delegate with CPU fallback. */
export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (landmarker) return Promise.resolve(landmarker);
  if (!loading) {
    loading = (async () => {
      try {
        landmarker = await create('GPU', mode);
      } catch (err) {
        console.warn('[faceMesh] GPU delegate failed, falling back to CPU', err);
        landmarker = await create('CPU', mode);
      }
      return landmarker;
    })();
  }
  return loading;
}

export function isFaceLandmarkerReady(): boolean {
  return !!landmarker;
}

async function ensureMode(m: RunningMode): Promise<FaceLandmarker> {
  const lm = await loadFaceLandmarker();
  if (mode !== m) {
    await lm.setOptions({ runningMode: m });
    mode = m;
  }
  return lm;
}

/** Detect on a still image. */
export async function detectImage(
  src: HTMLImageElement | HTMLCanvasElement | ImageBitmap | HTMLVideoElement,
): Promise<FaceLandmarkerResult> {
  const lm = await ensureMode('IMAGE');
  return lm.detect(src);
}

/** Detect on a video frame (must be called with increasing timestamps). */
export async function detectVideo(video: HTMLVideoElement, timestampMs: number): Promise<FaceLandmarkerResult> {
  const lm = await ensureMode('VIDEO');
  return lm.detectForVideo(video, timestampMs);
}

export interface ParsedDetection {
  landmarks: Point[];
  blendshapes: Record<string, number>;
  pose: FacePose | null;
}

/** Convert a detection result into pixel landmarks, blendshape map and head pose. */
export function parseResult(res: FaceLandmarkerResult, width: number, height: number): ParsedDetection | null {
  if (!res.faceLandmarks || res.faceLandmarks.length === 0) return null;
  const nl = res.faceLandmarks[0];
  const landmarks: Point[] = nl.map((p) => ({ x: p.x * width, y: p.y * height }));
  const blendshapes: Record<string, number> = {};
  const bs = res.faceBlendshapes?.[0];
  if (bs) for (const c of bs.categories) blendshapes[c.categoryName] = c.score;
  let pose: FacePose | null = null;
  const m = res.facialTransformationMatrixes?.[0];
  if (m && m.data.length === 16) pose = poseFromMatrix(m.data);
  return { landmarks, blendshapes, pose };
}

/**
 * Euler angles from MediaPipe's 4x4 column-major facial transformation matrix.
 * The canonical face looks along +Z toward the camera, X to the subject's left (viewer's right), Y up.
 */
export function poseFromMatrix(d: number[] | Float32Array): FacePose {
  const r = (row: number, col: number) => d[col * 4 + row];
  const fx = r(0, 2);
  const fy = r(1, 2);
  const fz = r(2, 2);
  const yaw = Math.atan2(fx, fz);
  const pitch = Math.atan2(fy, Math.hypot(fx, fz));
  const roll = Math.atan2(r(1, 0), r(0, 0));
  const deg = 180 / Math.PI;
  return { yaw: yaw * deg, pitch: pitch * deg, roll: -roll * deg };
}

let triangleCache: Uint16Array | null = null;

/**
 * Triangles of the 468-point face mesh, derived from the tesselation edge list.
 * Spurious 3-cliques (edges that enclose another vertex) are filtered using the given 2D positions.
 */
export function getMeshTriangles(lm: Point[]): Uint16Array {
  if (triangleCache) return triangleCache;
  const N = 468;
  const adj: Set<number>[] = Array.from({ length: N }, () => new Set<number>());
  for (const c of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
    if (c.start < N && c.end < N) {
      adj[c.start].add(c.end);
      adj[c.end].add(c.start);
    }
  }
  const tris: number[] = [];
  for (let a = 0; a < N; a++) {
    for (const b of adj[a]) {
      if (b <= a) continue;
      for (const c of adj[b]) {
        if (c <= b || !adj[a].has(c)) continue;
        if (!encloses(lm, a, b, c)) tris.push(a, b, c);
      }
    }
  }
  triangleCache = new Uint16Array(tris);
  return triangleCache;
}

function encloses(lm: Point[], a: number, b: number, c: number): boolean {
  const pa = lm[a];
  const pb = lm[b];
  const pc = lm[c];
  const minX = Math.min(pa.x, pb.x, pc.x);
  const maxX = Math.max(pa.x, pb.x, pc.x);
  const minY = Math.min(pa.y, pb.y, pc.y);
  const maxY = Math.max(pa.y, pb.y, pc.y);
  const area = (pb.x - pa.x) * (pc.y - pa.y) - (pc.x - pa.x) * (pb.y - pa.y);
  if (Math.abs(area) < 1e-6) return true;
  for (let v = 0; v < 468; v++) {
    if (v === a || v === b || v === c) continue;
    const p = lm[v];
    if (p.x <= minX || p.x >= maxX || p.y <= minY || p.y >= maxY) continue;
    const s1 = (pb.x - pa.x) * (p.y - pa.y) - (pb.y - pa.y) * (p.x - pa.x);
    const s2 = (pc.x - pb.x) * (p.y - pb.y) - (pc.y - pb.y) * (p.x - pb.x);
    const s3 = (pa.x - pc.x) * (p.y - pc.y) - (pa.y - pc.y) * (p.x - pc.x);
    const eps = 1e-9;
    if ((s1 > eps && s2 > eps && s3 > eps) || (s1 < -eps && s2 < -eps && s3 < -eps)) return true;
  }
  return false;
}

export function getTesselationEdges(): Array<[number, number]> {
  return FaceLandmarker.FACE_LANDMARKS_TESSELATION.map((c) => [c.start, c.end]);
}
