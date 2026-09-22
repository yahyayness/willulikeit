// ---------------------------------------------------------------------------
// Chocolate anchors — the Firefly move, done honestly.
// Firefly asked you to rate songs; we ask you to rate familiar chocolate
// styles on the TT-P 9-point hedonic scale. Each anchor carries a SYNTHETIC
// reference profile (typical-style approximation, not a measurement). Liked
// anchors pull your ideal towards their profile; the result is shown to you
// and only applied when you accept it (source: "anchor_rating").
// ---------------------------------------------------------------------------

import type { UserPreference } from "./types";

export interface Anchor {
  id: string;
  label: string;
  hint: string;
  profile: Record<string, number>; // 0–10, synthetic fixture
}

export const CHOCOLATE_ANCHORS: Anchor[] = [
  { id: "milk", label: "Milk chocolate", hint: "classic, sweet, creamy", profile: { sweetness: 8, bitterness: 2, sourness: 2, roasted: 3, fruity: 2, nutty: 3, creaminess: 8, crispness: 4, odor_intensity: 4, aftertaste_length: 4, body: 6 } },
  { id: "d55", label: "55–60% dark", hint: "gentle dark", profile: { sweetness: 6, bitterness: 4, sourness: 3, roasted: 5, fruity: 3, nutty: 3, creaminess: 6, crispness: 5, odor_intensity: 5, aftertaste_length: 5, body: 6 } },
  { id: "d70", label: "70% dark", hint: "the benchmark bar", profile: { sweetness: 4, bitterness: 6, sourness: 4, roasted: 6, fruity: 4, nutty: 3, creaminess: 5, crispness: 6, odor_intensity: 6, aftertaste_length: 7, body: 6 } },
  { id: "d85", label: "85% dark", hint: "serious, low sugar", profile: { sweetness: 2, bitterness: 8, sourness: 4, roasted: 7, fruity: 3, nutty: 3, creaminess: 4, crispness: 7, odor_intensity: 7, aftertaste_length: 8, body: 7, astringency_dryness: 5 } },
  { id: "d100", label: "100% cacao", hint: "no sugar at all", profile: { sweetness: 0, bitterness: 9, sourness: 5, roasted: 7, fruity: 3, nutty: 2, creaminess: 3, crispness: 7, odor_intensity: 7, aftertaste_length: 9, body: 7, astringency_dryness: 7 } },
  { id: "roast", label: "Roasted & nutty dark", hint: "toasty, hazelnut, caramel", profile: { sweetness: 5, bitterness: 5, sourness: 2, roasted: 9, fruity: 1, nutty: 8, creaminess: 6, crispness: 6, odor_intensity: 7, aftertaste_length: 7, body: 7 } },
  { id: "fruit", label: "Fruity single-origin", hint: "bright, red-fruit, acidic", profile: { sweetness: 4, bitterness: 5, sourness: 8, roasted: 3, fruity: 9, floral: 5, nutty: 1, creaminess: 4, crispness: 6, odor_intensity: 8, aftertaste_length: 7, body: 5 } }
];



// ---------------------------------------------------------------------------
// Quick Taste Sweep — low-friction first-contact onboarding.
// These are direct preference questions, not a copied third-party questionnaire.
// Each answer maps transparently onto one canonical MP6 preference axis.
// ---------------------------------------------------------------------------

export interface QuickSweepQuestion {
  id: string;
  attribute: string;
  prompt: string;
  hint: string;
  lowLabel: string;
  highLabel: string;
}

export const QUICK_SWEEP: QuickSweepQuestion[] = [
  { id: "sweet", attribute: "sweetness", prompt: "How sweet do you usually like things?", hint: "Think desserts, drinks and sauces.", lowLabel: "barely sweet", highLabel: "very sweet" },
  { id: "bitter", attribute: "bitterness", prompt: "How much bitterness do you enjoy?", hint: "Think dark chocolate, coffee, tonic or chicory.", lowLabel: "avoid bitter", highLabel: "love bitter" },
  { id: "acid", attribute: "sourness", prompt: "How much tang or acidity do you enjoy?", hint: "Think lemon, yogurt, pickles or sour fruit.", lowLabel: "soft / mild", highLabel: "sharp / tangy" },
  { id: "roast", attribute: "roasted", prompt: "How much do you like roasted or toasted notes?", hint: "Think toast, roasted nuts, coffee or caramelisation.", lowLabel: "fresh / light", highLabel: "deeply roasted" },
  { id: "creamy", attribute: "creaminess", prompt: "How creamy or rich do you like textures?", hint: "Think ganache, custard, sauces or melting chocolate.", lowLabel: "lean / dry", highLabel: "very creamy" },
  { id: "crisp", attribute: "crispness", prompt: "How much crunch or snap do you enjoy?", hint: "Think crisp crust, chips, brittle or a clean chocolate snap.", lowLabel: "soft", highLabel: "very crisp" },
  { id: "aroma", attribute: "odor_intensity", prompt: "How intense do you like aromas to be?", hint: "From discreet and delicate to room-filling.", lowLabel: "discreet", highLabel: "powerful" },
  { id: "finish", attribute: "aftertaste_length", prompt: "How long do you like flavours to linger?", hint: "A quick clean finish versus a long persistent one.", lowLabel: "short / clean", highLabel: "long / persistent" }
];

export const QUICK_SWEEP_VALUES = [
  { value: 1, label: "Low" },
  { value: 3, label: "Rather low" },
  { value: 5, label: "Middle" },
  { value: 7, label: "Rather high" },
  { value: 9, label: "High" }
] as const;

export interface DerivedPref {
  attribute: string;
  ideal: number;
  importance: number;
  basis: string;
}

/**
 * Ideal_k = Σ_i max(0, h_i − 5)·x_ik / Σ_i max(0, h_i − 5)  over anchors that
 * define k. Importance = 3 when liked and disliked anchors differ by ≥ 2 on k
 * (the attribute seems to drive the person's verdicts), else 2.
 * Returns [] when nothing was liked — we never guess.
 */
export function deriveFromAnchors(ratings: Record<string, number>, anchors: Anchor[] = CHOCOLATE_ANCHORS): DerivedPref[] {
  const rated = anchors.filter((a) => Number.isInteger(ratings[a.id]) && ratings[a.id] >= 1 && ratings[a.id] <= 9);
  const liked = rated.filter((a) => ratings[a.id] > 5);
  if (!liked.length) return [];
  const disliked = rated.filter((a) => ratings[a.id] < 5);
  const attrs = new Set<string>();
  liked.forEach((a) => Object.keys(a.profile).forEach((k) => attrs.add(k)));
  const out: DerivedPref[] = [];
  for (const k of [...attrs].sort()) {
    let num = 0,
      den = 0;
    for (const a of liked) {
      if (a.profile[k] === undefined) continue;
      const w = ratings[a.id] - 5;
      num += w * a.profile[k];
      den += w;
    }
    if (!den) continue;
    const ideal = Math.round((num / den) * 10) / 10;
    const likedMean = mean(liked.map((a) => a.profile[k]).filter((v) => v !== undefined));
    const dislikedVals = disliked.map((a) => a.profile[k]).filter((v) => v !== undefined);
    const spread = dislikedVals.length ? Math.abs(likedMean - mean(dislikedVals)) : 0;
    out.push({
      attribute: k,
      ideal,
      importance: spread >= 2 ? 3 : 2,
      basis: `${liked.length} liked${disliked.length ? `, ${disliked.length} disliked` : ""} anchor${liked.length + disliked.length > 1 ? "s" : ""}`
    });
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function applyDerived(prefs: UserPreference[], derived: DerivedPref[]): UserPreference[] {
  const map = new Map(prefs.map((p) => [p.attribute, { ...p }]));
  for (const d of derived) map.set(d.attribute, { attribute: d.attribute, ideal: d.ideal, importance: d.importance, source: "anchor_rating" });
  return [...map.values()];
}
