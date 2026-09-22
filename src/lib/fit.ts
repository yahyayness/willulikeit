// ---------------------------------------------------------------------------
// wulit-fit-v0.1 — transparent, deterministic, content-based Personal
// Sensory Fit. No LLM, no population data, no hidden inference.
//
//   C  = attributes with importance > 0 in the profile AND present in the
//        sensory profile (missing ≠ zero, skipped ≠ neutral)
//   D  = Σ_{k∈C} w_k·|p_k − x_k| / Σ_{k∈C} w_k          (0–10 axis)
//   Fit = clamp(100·(1 − D/10), 0, 100)
//   coverage = |C| / |active preferences|
//
// Fit is NOT a probability of liking.
// ---------------------------------------------------------------------------

import { attrLabel } from "./vocab";
import type { FitBand, FitComputation, FitReason, SensoryProfile, UserPreference } from "./types";

export const FIT_ALGORITHM = "wulit-fit-v0.1" as const;
export const MATCH_TOLERANCE = 1.5; // |Δ| ≤ 1.5 on the 0–10 axis counts as a match

export function bandOf(fit: number | null): FitBand {
  if (fit === null) return "none";
  if (fit >= 80) return "strong";
  if (fit >= 65) return "likely";
  if (fit >= 50) return "mixed";
  if (fit >= 35) return "unlikely";
  return "poor";
}

export const BAND_COPY: Record<FitBand, { title: string; short: string }> = {
  strong: { title: "Likely strong fit", short: "strong fit" },
  likely: { title: "Likely good fit", short: "good fit" },
  mixed: { title: "Mixed — could go either way", short: "mixed" },
  unlikely: { title: "Probably not a match", short: "weak fit" },
  poor: { title: "Likely poor fit", short: "poor fit" },
  none: { title: "Can't estimate — no overlap", short: "no overlap" }
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeFit(prefs: UserPreference[], sensory: Pick<SensoryProfile, "values">): FitComputation {
  const active = prefs.filter((p) => p.importance > 0 && Number.isFinite(p.ideal));
  const excludedZeroImportance = prefs.filter((p) => p.importance === 0).map((p) => p.attribute);
  const compared: FitReason[] = [];
  const notDescribed: string[] = [];

  for (const p of active) {
    const sv = sensory.values[p.attribute];
    if (!sv || !Number.isFinite(sv.value)) {
      notDescribed.push(p.attribute);
      continue;
    }
    const delta = sv.value - p.ideal;
    const abs = Math.abs(delta);
    compared.push({
      attribute: p.attribute,
      label: attrLabel(p.attribute),
      user_preference: p.ideal,
      predicted: sv.value,
      delta: r2(delta),
      abs: r2(abs),
      importance: p.importance,
      weighted: r2(abs * p.importance)
    });
  }

  const profiled = new Set(prefs.filter((p) => p.importance > 0).map((p) => p.attribute));
  const notInProfile = Object.keys(sensory.values).filter((k) => !profiled.has(k) && !excludedZeroImportance.includes(k));
  const coverage = active.length ? r2(compared.length / active.length) : 0;

  if (!compared.length) {
    return { fit: null, distance: null, coverage, compared, matches: [], mismatches: [], notDescribed, notInProfile, excludedZeroImportance, band: "none" };
  }

  const wSum = compared.reduce((s, c) => s + c.importance, 0);
  const D = compared.reduce((s, c) => s + c.importance * Math.abs(c.predicted - c.user_preference), 0) / wSum;
  const fit = r1(Math.min(100, Math.max(0, 100 * (1 - D / 10))));

  const matches = compared
    .filter((c) => c.abs <= MATCH_TOLERANCE)
    .sort((a, b) => b.importance - a.importance || a.abs - b.abs || a.attribute.localeCompare(b.attribute));
  const mismatches = compared
    .filter((c) => c.abs > MATCH_TOLERANCE)
    .sort((a, b) => b.weighted - a.weighted || a.attribute.localeCompare(b.attribute));

  return { fit, distance: r2(D), coverage, compared, matches, mismatches, notDescribed, notInProfile, excludedZeroImportance, band: bandOf(fit) };
}

/** Plain-language reason line, e.g. "sweeter than you like (5.8 vs 3)". */
export function reasonLine(c: FitReason, who?: string): string {
  const name = c.label.toLowerCase();
  const likes = who ? `${who} likes` : "you like";
  if (c.abs <= 0.5) return `${c.label} is right where ${likes} it`;
  if (c.abs <= MATCH_TOLERANCE) return `${c.label} is close to ${who ? `${who}'s` : "your"} preference`;
  const more = c.delta > 0;
  const words: Record<string, [string, string]> = {
    sweetness: ["sweeter", "less sweet"],
    bitterness: ["more bitter", "less bitter"],
    sourness: ["more acidic", "less acidic"],
    creaminess: ["creamier", "less creamy"],
    crispness: ["crunchier", "softer"],
    aftertaste_length: ["longer-finishing", "shorter-finishing"],
    saltiness: ["saltier", "less salty"],
    odor_intensity: ["more aromatic", "less aromatic"],
    taste_intensity: ["bolder", "more delicate"],
    body: ["fuller-bodied", "lighter"],
    astringency_dryness: ["more drying", "less drying"],
    nutty: ["nuttier", "less nutty"],
    fruity: ["fruitier", "less fruity"],
    roasted: ["more roasted", "less roasted"],
    spicy: ["spicier", "less spicy"],
    floral: ["more floral", "less floral"],
    umami: ["more savoury", "less savoury"],
    odor_complexity: ["more complex", "simpler"]
  };
  const [up, down] = words[c.attribute] ?? [`more ${name}`, `less ${name}`];
  return `${more ? up : down} than ${likes}`;
}

/** Normalised actual liking from the 9-point hedonic: (h−1)/8·100. */
export function likingIndex(hedonic: number): number {
  if (!Number.isInteger(hedonic) || hedonic < 1 || hedonic > 9) throw new RangeError("hedonic must be an integer 1–9");
  return r1(((hedonic - 1) / 8) * 100);
}

/** Sensory agreement Expected vs Observed on overlapping attributes only. */
export function sensoryAgreement(expected: Record<string, number>, observed: Pick<SensoryProfile, "values">) {
  const perAttr: { attribute: string; expected: number; observed: number }[] = [];
  for (const [k, e] of Object.entries(expected)) {
    const o = observed.values[k];
    if (o && Number.isFinite(o.value)) perAttr.push({ attribute: k, expected: e, observed: o.value });
  }
  if (!perAttr.length) return null;
  const mad = perAttr.reduce((s, p) => s + Math.abs(p.expected - p.observed), 0) / perAttr.length;
  return { n: perAttr.length, meanAbsDelta: r2(mad), perAttr };
}
