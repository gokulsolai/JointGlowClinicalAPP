import type { AnalysisResult, ConcernId, Recommendation, TreatmentId } from './types';
import { CONCERN_BY_ID } from './analysis';
import { TREATMENTS } from './treatments';

interface Rule {
  treatment: TreatmentId;
  concerns: ConcernId[];
  threshold: number;
  zonesFromConcerns?: Record<string, ConcernId>;
}

const RULES: Rule[] = [
  { treatment: 'neuromodulator', concerns: ['forehead_lines', 'glabellar_lines', 'crows_feet'], threshold: 30, zonesFromConcerns: { forehead: 'forehead_lines', glabella: 'glabellar_lines', crows: 'crows_feet' } },
  { treatment: 'lip_filler', concerns: ['lip_volume'], threshold: 40 },
  { treatment: 'cheek_filler', concerns: ['midface_volume', 'nasolabial_folds'], threshold: 40 },
  { treatment: 'nasolabial_filler', concerns: ['nasolabial_folds', 'marionette_lines'], threshold: 40 },
  { treatment: 'chin_jaw_filler', concerns: ['jawline'], threshold: 45 },
  { treatment: 'tear_trough', concerns: ['under_eye'], threshold: 35 },
  { treatment: 'ipl', concerns: ['redness', 'pigmentation'], threshold: 35 },
  { treatment: 'chemical_peel', concerns: ['pigmentation', 'texture_pores'], threshold: 35 },
  { treatment: 'laser_resurfacing', concerns: ['texture_pores', 'perioral_lines'], threshold: 40 },
  { treatment: 'hydrafacial', concerns: ['texture_pores', 'oiliness', 'pigmentation'], threshold: 25 },
  { treatment: 'skin_tightening', concerns: ['jawline', 'marionette_lines'], threshold: 50 },
];

/** Suggest treatments from the concern scores, highest-impact first. */
export function recommend(analysis: AnalysisResult, disabled: TreatmentId[] = []): Recommendation[] {
  const score = (id: ConcernId): number => analysis.concerns.find((c) => c.id === id)?.score ?? 0;
  const recs: Recommendation[] = [];
  for (const rule of RULES) {
    if (disabled.includes(rule.treatment)) continue;
    const hits = rule.concerns.filter((c) => score(c) >= rule.threshold);
    if (!hits.length) continue;
    const top = Math.max(...hits.map(score));
    const zones = rule.zonesFromConcerns
      ? Object.fromEntries(Object.entries(rule.zonesFromConcerns).map(([z, c]) => [z, score(c) >= rule.threshold]))
      : undefined;
    const names = hits.map((c) => CONCERN_BY_ID[c].label.toLowerCase());
    recs.push({
      treatmentId: rule.treatment,
      priority: top,
      reason: `Addresses ${names.join(' and ')} (score ${top}).`,
      intensity: Math.min(1, 0.35 + (top / 100) * 0.6),
      zones,
      concerns: hits,
    });
  }
  recs.sort((a, b) => b.priority - a.priority);
  // avoid recommending both nasolabial filler and cheek filler for the same fold-only finding
  const seen = new Set<string>();
  return recs.filter((r) => {
    const key = r.concerns.join(',');
    if (r.treatmentId === 'nasolabial_filler' && seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function treatmentName(id: TreatmentId): string {
  return TREATMENTS.find((t) => t.id === id)?.name ?? id;
}
