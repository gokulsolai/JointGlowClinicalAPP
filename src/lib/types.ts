export interface Point {
  x: number;
  y: number;
}

export interface FacePose {
  /** degrees; positive = face turned toward viewer-right */
  yaw: number;
  /** degrees; positive = chin up */
  pitch: number;
  /** degrees; positive = head tilted clockwise on screen */
  roll: number;
}

/** A consultation photo plus the face geometry detected on it. */
export interface FaceCapture {
  width: number;
  height: number;
  /** true when the image is a mirror image (front camera preview), so viewer-left == client's left. */
  mirrored: boolean;
  /** 478 landmarks in pixel coordinates of the image. */
  landmarks: Point[];
  blendshapes: Record<string, number>;
  pose: FacePose | null;
  source: 'camera' | 'upload';
}

export type ConcernId =
  | 'forehead_lines'
  | 'glabellar_lines'
  | 'crows_feet'
  | 'perioral_lines'
  | 'nasolabial_folds'
  | 'marionette_lines'
  | 'under_eye'
  | 'pigmentation'
  | 'redness'
  | 'texture_pores'
  | 'oiliness'
  | 'lip_volume'
  | 'midface_volume'
  | 'jawline'
  | 'asymmetry';

export type ConcernGroup = 'lines' | 'skin' | 'volume' | 'structure';

export interface ConcernDef {
  id: ConcernId;
  label: string;
  group: ConcernGroup;
  description: string;
  /** colour used for the heatmap overlay */
  color: string;
}

export type Confidence = 'low' | 'medium' | 'high';

export interface ConcernScore {
  id: ConcernId;
  /** 0 (not present) .. 100 (very pronounced) */
  score: number;
  confidence: Confidence;
  note: string;
  /** per-side scores where the concern is bilateral (client's left / right) */
  sides?: { left: number; right: number };
}

export interface SkinTone {
  /** Individual Typology Angle, degrees */
  ita: number;
  category: string;
  L: number;
  a: number;
  b: number;
}

export interface AnalysisResult {
  version: number;
  concerns: ConcernScore[];
  /** 0..100 composite skin quality */
  overallSkin: number;
  /** mean skin colour, 0..1 rgb */
  skinMean: [number, number, number];
  cheekMean: [number, number, number];
  /** 0..1 how red the overall skin tone is */
  globalRedness: number;
  skinTone: SkinTone;
  faceWidth: number;
  /** raw metrics for calibration / debugging */
  metrics: Record<string, number>;
}

export type TreatmentId =
  | 'neuromodulator'
  | 'lip_filler'
  | 'cheek_filler'
  | 'chin_jaw_filler'
  | 'nasolabial_filler'
  | 'tear_trough'
  | 'chemical_peel'
  | 'laser_resurfacing'
  | 'ipl'
  | 'hydrafacial'
  | 'skin_tightening';

export interface TreatmentZone {
  id: string;
  label: string;
}

export interface TreatmentDef {
  id: TreatmentId;
  name: string;
  short: string;
  category: 'Injectables' | 'Skin treatments' | 'Energy-based';
  description: string;
  targets: ConcernId[];
  zones?: TreatmentZone[];
  defaultPrice: number;
  priceUnit: string;
  onset: string;
  duration: string;
  intensityLabel: string;
}

export interface TreatmentSetting {
  enabled: boolean;
  /** 0..1 */
  intensity: number;
  zones?: Record<string, boolean>;
}

export type SimulationState = Partial<Record<TreatmentId, TreatmentSetting>>;

export interface Recommendation {
  treatmentId: TreatmentId;
  priority: number;
  reason: string;
  intensity: number;
  zones?: Record<string, boolean>;
  concerns: ConcernId[];
}

export interface ClientConsent {
  photo: boolean;
  analysis: boolean;
  marketing: boolean;
  signedAt?: string;
  /** data URL of the signature drawing */
  signature?: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dob?: string;
  phone?: string;
  email?: string;
  concerns: string[];
  skinType?: string;
  allergies?: string;
  medications?: string;
  previousTreatments?: string;
  notes?: string;
  consent: ClientConsent;
  createdAt: string;
  updatedAt: string;
}

export interface PlanItem {
  treatmentId: TreatmentId;
  intensity: number;
  zones?: Record<string, boolean>;
  price: number;
}

export interface Consultation {
  id: string;
  clientId: string;
  createdAt: string;
  photo: Blob;
  thumbnail: Blob;
  capture: FaceCapture;
  analysis: AnalysisResult;
  simulation: SimulationState;
  plan: PlanItem[];
  simulationImage?: Blob;
  notes?: string;
}

export interface ClinicSettings {
  clinicName: string;
  practitioner: string;
  currency: string;
  prices: Partial<Record<TreatmentId, number>>;
  disabledTreatments: TreatmentId[];
  disclaimer: string;
  autoCapture: boolean;
}
