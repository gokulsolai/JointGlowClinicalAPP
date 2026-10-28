import type { SimulationState, TreatmentDef, TreatmentId, TreatmentSetting } from './types';

export const TREATMENTS: TreatmentDef[] = [
  {
    id: 'neuromodulator',
    name: 'Anti-wrinkle injections',
    short: 'Botulinum toxin',
    category: 'Injectables',
    description: 'Relaxes the muscles that create expression lines, softening forehead lines, frown lines and crow\'s feet.',
    targets: ['forehead_lines', 'glabellar_lines', 'crows_feet'],
    zones: [
      { id: 'forehead', label: 'Forehead' },
      { id: 'glabella', label: 'Frown lines' },
      { id: 'crows', label: "Crow's feet" },
    ],
    defaultPrice: 350,
    priceUnit: 'per area',
    onset: 'Visible in 3–14 days',
    duration: 'Lasts about 3–4 months',
    intensityLabel: 'Dose',
  },
  {
    id: 'lip_filler',
    name: 'Lip enhancement',
    short: 'Hyaluronic acid filler',
    category: 'Injectables',
    description: 'Adds volume and definition to the lips while keeping natural proportions.',
    targets: ['lip_volume', 'perioral_lines'],
    defaultPrice: 650,
    priceUnit: 'per syringe',
    onset: 'Immediate (settles in 1–2 weeks)',
    duration: 'Lasts about 6–12 months',
    intensityLabel: 'Volume',
  },
  {
    id: 'cheek_filler',
    name: 'Cheek augmentation',
    short: 'Hyaluronic acid filler',
    category: 'Injectables',
    description: 'Restores midface volume and lifts the cheeks, which also softens nasolabial folds.',
    targets: ['midface_volume', 'nasolabial_folds'],
    defaultPrice: 850,
    priceUnit: 'per syringe',
    onset: 'Immediate',
    duration: 'Lasts about 12–18 months',
    intensityLabel: 'Volume',
  },
  {
    id: 'chin_jaw_filler',
    name: 'Chin & jawline contouring',
    short: 'Hyaluronic acid filler',
    category: 'Injectables',
    description: 'Projects the chin and sharpens the jaw angle for a more defined lower face.',
    targets: ['jawline'],
    zones: [
      { id: 'chin', label: 'Chin' },
      { id: 'jawline', label: 'Jawline' },
    ],
    defaultPrice: 950,
    priceUnit: 'per session',
    onset: 'Immediate',
    duration: 'Lasts about 12–18 months',
    intensityLabel: 'Volume',
  },
  {
    id: 'nasolabial_filler',
    name: 'Nasolabial & marionette filler',
    short: 'Hyaluronic acid filler',
    category: 'Injectables',
    description: 'Softens the folds from nose to mouth and mouth to chin.',
    targets: ['nasolabial_folds', 'marionette_lines'],
    defaultPrice: 700,
    priceUnit: 'per syringe',
    onset: 'Immediate',
    duration: 'Lasts about 9–12 months',
    intensityLabel: 'Volume',
  },
  {
    id: 'tear_trough',
    name: 'Tear trough treatment',
    short: 'Filler or PRP',
    category: 'Injectables',
    description: 'Fills the hollow under the eyes and brightens dark circles.',
    targets: ['under_eye'],
    defaultPrice: 750,
    priceUnit: 'per session',
    onset: 'Immediate to 2 weeks',
    duration: 'Lasts about 9–12 months',
    intensityLabel: 'Correction',
  },
  {
    id: 'chemical_peel',
    name: 'Chemical peel',
    short: 'Medium-depth peel',
    category: 'Skin treatments',
    description: 'Exfoliates to even out pigmentation, brighten tone and refine texture.',
    targets: ['pigmentation', 'texture_pores', 'perioral_lines'],
    defaultPrice: 250,
    priceUnit: 'per session',
    onset: '1–2 weeks after peeling',
    duration: 'Course of 3–6 sessions',
    intensityLabel: 'Depth',
  },
  {
    id: 'laser_resurfacing',
    name: 'Laser resurfacing / RF microneedling',
    short: 'Fractional resurfacing',
    category: 'Energy-based',
    description: 'Stimulates collagen to refine texture, pores, fine lines and scarring.',
    targets: ['texture_pores', 'perioral_lines', 'crows_feet', 'pigmentation'],
    defaultPrice: 600,
    priceUnit: 'per session',
    onset: '4–12 weeks',
    duration: 'Course of 3 sessions; results long-lasting',
    intensityLabel: 'Strength',
  },
  {
    id: 'ipl',
    name: 'IPL photofacial / vascular laser',
    short: 'Light-based',
    category: 'Energy-based',
    description: 'Targets redness, broken capillaries and sun spots.',
    targets: ['redness', 'pigmentation'],
    defaultPrice: 400,
    priceUnit: 'per session',
    onset: '2–4 weeks',
    duration: 'Course of 3–5 sessions',
    intensityLabel: 'Strength',
  },
  {
    id: 'hydrafacial',
    name: 'Hydrafacial & skin boosters',
    short: 'Hydration & glow',
    category: 'Skin treatments',
    description: 'Deep cleanses, hydrates and boosts radiance; skin boosters improve hydration and elasticity.',
    targets: ['texture_pores', 'oiliness', 'pigmentation'],
    defaultPrice: 220,
    priceUnit: 'per session',
    onset: 'Immediate glow',
    duration: 'Monthly maintenance',
    intensityLabel: 'Intensity',
  },
  {
    id: 'skin_tightening',
    name: 'Skin tightening',
    short: 'HIFU / radiofrequency',
    category: 'Energy-based',
    description: 'Lifts and tightens the lower face and jawline by stimulating collagen.',
    targets: ['jawline', 'marionette_lines', 'nasolabial_folds'],
    defaultPrice: 900,
    priceUnit: 'per session',
    onset: '8–12 weeks',
    duration: 'Lasts about 12 months',
    intensityLabel: 'Strength',
  },
];

export const TREATMENT_BY_ID: Record<TreatmentId, TreatmentDef> = Object.fromEntries(TREATMENTS.map((t) => [t.id, t])) as Record<TreatmentId, TreatmentDef>;

/** Shader intensities derived from the enabled treatments. */
export interface EffectUniforms {
  forehead: number;
  glabella: number;
  crows: number;
  folds: number;
  underEye: number;
  resurface: number;
  tone: number;
  redness: number;
  glow: number;
  lips: number;
  matte: number;
  perioral: number;
}

export const ZERO_EFFECTS: EffectUniforms = {
  forehead: 0,
  glabella: 0,
  crows: 0,
  folds: 0,
  underEye: 0,
  resurface: 0,
  tone: 0,
  redness: 0,
  glow: 0,
  lips: 0,
  matte: 0,
  perioral: 0,
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function computeEffects(state: SimulationState): EffectUniforms {
  const u: EffectUniforms = { ...ZERO_EFFECTS };
  const get = (id: TreatmentId): TreatmentSetting | null => {
    const s = state[id];
    return s && s.enabled && s.intensity > 0 ? s : null;
  };
  const nm = get('neuromodulator');
  if (nm) {
    const z = nm.zones ?? {};
    const i = nm.intensity;
    if (z.forehead !== false) u.forehead += 0.95 * i;
    if (z.glabella !== false) u.glabella += 0.95 * i;
    if (z.crows !== false) u.crows += 0.9 * i;
  }
  const lip = get('lip_filler');
  if (lip) {
    u.lips += 0.8 * lip.intensity;
    u.perioral += 0.5 * lip.intensity;
  }
  const naso = get('nasolabial_filler');
  if (naso) u.folds += 0.9 * naso.intensity;
  const cheek = get('cheek_filler');
  if (cheek) u.folds += 0.35 * cheek.intensity;
  const tt = get('tear_trough');
  if (tt) u.underEye += 0.95 * tt.intensity;
  const peel = get('chemical_peel');
  if (peel) {
    u.tone += 0.8 * peel.intensity;
    u.resurface += 0.4 * peel.intensity;
    u.glow += 0.3 * peel.intensity;
    u.perioral += 0.3 * peel.intensity;
  }
  const laser = get('laser_resurfacing');
  if (laser) {
    u.resurface += 0.85 * laser.intensity;
    u.tone += 0.4 * laser.intensity;
    u.crows += 0.35 * laser.intensity;
    u.perioral += 0.6 * laser.intensity;
    u.forehead += 0.2 * laser.intensity;
  }
  const ipl = get('ipl');
  if (ipl) {
    u.redness += 0.95 * ipl.intensity;
    u.tone += 0.6 * ipl.intensity;
  }
  const hf = get('hydrafacial');
  if (hf) {
    u.glow += 0.9 * hf.intensity;
    u.matte += 0.7 * hf.intensity;
    u.resurface += 0.25 * hf.intensity;
  }
  const tight = get('skin_tightening');
  if (tight) {
    u.folds += 0.3 * tight.intensity;
    u.resurface += 0.15 * tight.intensity;
  }
  for (const k of Object.keys(u) as Array<keyof EffectUniforms>) u[k] = clamp01(u[k]);
  return u;
}

export function defaultSetting(def: TreatmentDef, intensity = 0.6): TreatmentSetting {
  const zones = def.zones ? Object.fromEntries(def.zones.map((z) => [z.id, true])) : undefined;
  return { enabled: true, intensity, zones };
}
