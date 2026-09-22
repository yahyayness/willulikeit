// Core local-first types (thread brief §12, extended with provenance fields).

export type PrefSource = "explicit_slider" | "anchor_rating" | "quick_sweep" | "learned";

export interface UserPreference {
  attribute: string; // MP6 canonical attribute id
  ideal: number; // 0–10, same axis as Expected MP6
  importance: number; // 0 = doesn't matter (excluded), 1 a little, 2 matters, 3 a lot
  source: PrefSource;
}

export type ProfileRelation = "self" | "other";

export interface ProfileVersion {
  version: number;
  savedAt: string;
  preferences: UserPreference[];
  note?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  relation: ProfileRelation; // "other" = stated on someone's behalf (proxy)
  version: number;
  createdAt: string;
  updatedAt: string;
  preferences: UserPreference[]; // skipped attributes are ABSENT, never zero
  anchorRatings?: Record<string, number>; // anchorId -> 1..9 hedonic
  history: ProfileVersion[]; // append-only previous versions
  demo?: boolean;
}

/** Sensory evidence kinds — never collapsed into one truth value. */
export type SensoryKind =
  | "expected" // MP6-SIM — predicted / simulated
  | "observed" // MP6-OBS — recorded by a human
  | "proxy" // crude ingredient-level proxy derived from a JRF — demo fallback
  | "unknown";

export interface SensoryValue {
  value: number; // normalised 0–10
  source_attribute: string; // original attribute name in the file
  source_dimension?: string;
  source_scale?: { min: number; max: number };
  confidence?: number;
}

export interface SensoryProfile {
  kind: SensoryKind;
  kindReason: string;
  itemId: string;
  itemName: string;
  category?: string;
  synthetic: boolean; // synthetic / demo / reconstructed — not measured
  values: Record<string, SensoryValue>; // canonical attr -> value
  unmapped: { dimension?: string; attribute: string; value: number }[];
  absent: string[]; // attributes present but without a usable numeric value
  evaluationId?: string;
  evaluationCount: number;
  sourceFile?: string;
  sourceHash?: string; // sha256 of exact file text
  linkedRecipe?: string; // recipe file / version the MP6 declares
  notes: string[];
  proxyCoverage?: { withSensory: number; totalIngredients: number };
}

export interface JrfSummary {
  name: string;
  description?: string;
  version?: string;
  status?: string;
  exportedAt?: string;
  ingredients: { label: string; quantity?: number; unit?: string }[];
  processes: { label: string; duration_s?: number; temperature?: number | string }[];
  materials: string[];
  serve?: string;
  ingredientSensoryCount: number;
  sourceFile?: string;
  sourceHash?: string;
}

export interface FitReason {
  attribute: string;
  label: string;
  user_preference: number;
  predicted: number;
  delta: number; // predicted - preference (signed)
  abs: number;
  importance: number;
  weighted: number; // importance * abs
}

export type FitBand = "strong" | "likely" | "mixed" | "unlikely" | "poor" | "none";

export interface FitComputation {
  fit: number | null; // 0–100, one decimal; null when no overlap
  distance: number | null;
  coverage: number; // |C| / |active prefs|
  compared: FitReason[];
  matches: FitReason[];
  mismatches: FitReason[];
  notDescribed: string[]; // active prefs the item does not describe
  notInProfile: string[]; // item attributes the person has no stated preference for
  excludedZeroImportance: string[];
  band: FitBand;
}

export interface FitResult extends FitComputation {
  id: string;
  batchId: string;
  algorithmVersion: "wulit-fit-v0.1";
  profileId: string;
  profileName: string;
  profileRelation: ProfileRelation;
  profileVersion: string; // `${id}@v${n}`
  profileHash: string;
  profileSnapshot: UserPreference[];
  item: {
    id: string;
    name: string;
    category?: string;
    jrfHash?: string;
    jrfName?: string;
    jrfVersion?: string;
    expectedMp6Hash?: string;
    sensoryKind: SensoryKind;
    synthetic: boolean;
    sourceFile?: string;
  };
  sensorySnapshot: Record<string, number>;
  recipe?: JrfSummary; // JRF identity, ingredients & process (for the FEELLLM brief)
  context: { occasion?: string; note?: string };
  createdAt: string;
  fitResultHash: string; // sha256 over canonical frozen result payload before this field is added
  frozen: true;
}

export interface Outcome {
  id: string;
  fitResultId: string;
  hedonic: number; // 1..9 (TT-P 9-point hedonic)
  likingIndex: number; // (hedonic-1)/8*100 — derived, transparent
  fitLikingGap: number; // likingIndex - Personal Sensory Fit — exploratory, scales not calibrated
  sensoryMatch?: "yes" | "partly" | "no";
  mostDifferent?: string;
  notes?: string;
  observed?: {
    mp6Hash: string;
    sourceFile?: string;
    agreement: { n: number; meanAbsDelta: number; perAttr: { attribute: string; expected: number; observed: number }[] } | null;
    posthocFit: number | null; // fit recomputed against the OBSERVED profile — never replaces the frozen prediction
  };
  createdAt: string;
}
