import type { Point, SimulationState } from './types';
import { LM, centroid, dist, faceWidth, mid, mouthWidth, pick } from './landmarks';

export type WarpTool =
  | { kind: 'bloat'; cx: number; cy: number; radius: number; strength: number; sx: number; sy: number }
  | { kind: 'push'; cx: number; cy: number; radius: number; dx: number; dy: number };

function falloff(t: number): number {
  if (t >= 1) return 0;
  const u = 1 - t * t;
  return u * u;
}

/** Apply warp tools to interleaved xy positions. `base` is never modified. */
export function applyWarps(base: Float32Array, tools: WarpTool[], out: Float32Array, movableCount: number): void {
  out.set(base);
  if (!tools.length) return;
  for (const tool of tools) {
    for (let i = 0; i < movableCount; i++) {
      const x = out[i * 2];
      const y = out[i * 2 + 1];
      const dx = x - tool.cx;
      const dy = y - tool.cy;
      const d = Math.hypot(dx, dy);
      if (d >= tool.radius) continue;
      const f = falloff(d / tool.radius);
      if (tool.kind === 'bloat') {
        out[i * 2] = x + dx * tool.strength * tool.sx * f;
        out[i * 2 + 1] = y + dy * tool.strength * tool.sy * f;
      } else {
        out[i * 2] = x + tool.dx * f;
        out[i * 2 + 1] = y + tool.dy * f;
      }
    }
  }
}

/** Derive the warp tools for the enabled filler/tightening treatments. */
export function treatmentWarps(lm: Point[], state: SimulationState): WarpTool[] {
  const tools: WarpTool[] = [];
  const fw = faceWidth(lm);
  const on = (id: keyof SimulationState) => {
    const s = state[id];
    return s && s.enabled && s.intensity > 0 ? s : null;
  };

  const lip = on('lip_filler');
  if (lip) {
    const c = mid(lm[LM.LIP_INNER_TOP], lm[LM.LIP_INNER_BOTTOM]);
    const mw = mouthWidth(lm);
    tools.push({ kind: 'bloat', cx: c.x, cy: c.y, radius: 0.9 * mw, strength: 0.26 * lip.intensity, sx: 0.18, sy: 1 });
    // slight eversion of the upper lip
    const top = lm[LM.LIP_TOP];
    tools.push({ kind: 'push', cx: top.x, cy: top.y, radius: 0.35 * mw, dx: 0, dy: -0.012 * fw * lip.intensity });
  }

  const cheek = on('cheek_filler');
  if (cheek) {
    for (const [idx, sign] of [
      [LM.MALAR_L, -1],
      [LM.MALAR_R, 1],
    ] as const) {
      const c = centroid(pick(lm, idx));
      tools.push({ kind: 'bloat', cx: c.x, cy: c.y, radius: 0.3 * fw, strength: 0.11 * cheek.intensity, sx: 1, sy: 0.9 });
      tools.push({ kind: 'push', cx: c.x, cy: c.y, radius: 0.3 * fw, dx: sign * 0.006 * fw * cheek.intensity, dy: -0.014 * fw * cheek.intensity });
    }
  }

  const cj = on('chin_jaw_filler');
  if (cj) {
    const zones = cj.zones ?? { chin: true, jawline: true };
    if (zones.chin !== false) {
      const c = mid(lm[LM.CHIN_BOTTOM], lm[LM.CHIN_MID]);
      tools.push({ kind: 'push', cx: c.x, cy: c.y, radius: 0.24 * fw, dx: 0, dy: 0.03 * fw * cj.intensity });
      tools.push({ kind: 'bloat', cx: c.x, cy: c.y, radius: 0.22 * fw, strength: 0.07 * cj.intensity, sx: 0.8, sy: 1 });
    }
    if (zones.jawline !== false) {
      for (const [angle, jaw, sign] of [
        [LM.JAW_ANGLE_L, LM.JAW_L, -1],
        [LM.JAW_ANGLE_R, LM.JAW_R, 1],
      ] as const) {
        const c = mid(lm[angle], lm[jaw]);
        tools.push({ kind: 'push', cx: c.x, cy: c.y, radius: 0.18 * fw, dx: sign * 0.018 * fw * cj.intensity, dy: 0.008 * fw * cj.intensity });
      }
    }
  }

  const tight = on('skin_tightening');
  if (tight) {
    for (const [jowl, sign] of [
      [LM.JOWL_L, -1],
      [LM.JOWL_R, 1],
    ] as const) {
      const p = lm[jowl];
      tools.push({ kind: 'push', cx: p.x, cy: p.y - 0.05 * fw, radius: 0.22 * fw, dx: sign * 0.004 * fw * tight.intensity, dy: -0.016 * fw * tight.intensity });
    }
  }

  const naso = on('nasolabial_filler');
  if (naso) {
    // very subtle lateral support of the fold
    for (const [idx, sign] of [
      [LM.NASOLABIAL_L, -1],
      [LM.NASOLABIAL_R, 1],
    ] as const) {
      const c = centroid(pick(lm, idx));
      tools.push({ kind: 'push', cx: c.x, cy: c.y, radius: 0.14 * fw, dx: sign * 0.004 * fw * naso.intensity, dy: 0 });
    }
  }
  return tools;
}

export function warpMagnitude(lm: Point[], tools: WarpTool[]): number {
  let m = 0;
  for (const t of tools) m += t.kind === 'push' ? Math.hypot(t.dx, t.dy) : t.strength * t.radius * 0.5;
  return m / Math.max(1, dist(lm[LM.CHEEKBONE_L], lm[LM.CHEEKBONE_R]));
}
