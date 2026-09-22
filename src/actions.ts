import { freezePrediction } from "./lib/predict";
import { ingredientProxy } from "./lib/jrf";
import { uid } from "./lib/hash";
import type { FitResult, JrfSummary, SensoryProfile, UserProfile } from "./lib/types";
import { store, ensureDemoProfile, fetchSample, loadMp6Text, loadJrfText, type Draft } from "./state";

export const SAMPLES = {
  d70: { mp6: "/samples/dark-chocolate-70.expected.mp6" },
  gianduja: { mp6: "/samples/gianduja-v1.1.0.expected.mp6", jrf: "/samples/gianduja-v1.1.0.jrf" },
  elixir: { mp6: "/samples/elixir-of-invincibility-v1.1.0.expected.mp6", jrf: "/samples/elixir-of-invincibility-v1.1.0.jrf" },
  elixirJrfOnly: { jrf: "/samples/elixir-of-invincibility-v1.1.0.jrf" },
  d70Observed: "/samples/dark-chocolate-70.observed-demo.mp6"
} as const;

export async function loadSampleIntoDraft(key: "d70" | "gianduja" | "elixir" | "elixirJrfOnly"): Promise<Partial<Draft>> {
  const s: { mp6?: string; jrf?: string } = SAMPLES[key];
  const out: Partial<Draft> = { mp6: undefined, jrf: undefined, useProxy: false };
  if (s.mp6) out.mp6 = await loadMp6Text(await fetchSample(s.mp6), s.mp6.split("/").pop()!);
  if (s.jrf) out.jrf = await loadJrfText(await fetchSample(s.jrf), s.jrf.split("/").pop()!);
  return out;
}

/** The sensory profile a draft would be predicted against, or why not. */
export function draftSensory(d: Draft): { sensory?: SensoryProfile; jrf?: JrfSummary; problem?: string } {
  const jrf = d.jrf?.parse.ok ? { ...d.jrf.parse.summary!, sourceHash: d.jrf.hash } : undefined;
  if (d.mp6?.parse.ok) {
    const p = d.mp6.parse.profile!;
    return { sensory: { ...p, sourceHash: d.mp6.hash, itemName: p.itemName }, jrf };
  }
  if (d.jrf?.parse.ok && d.useProxy) {
    const proxy = ingredientProxy(d.jrf.parse);
    if (proxy) return { sensory: proxy, jrf };
    return { jrf, problem: "This JRF carries no ingredient-level sensory data, so not even a crude proxy is possible." };
  }
  if (d.jrf?.parse.ok) return { jrf, problem: "A recipe alone says how it's made, not how it will taste. Add its Expected MP6." };
  return { problem: "Load an Expected MP6 (and optionally its JRF recipe)." };
}

export async function predictFor(profiles: UserProfile[], sensory: SensoryProfile, jrf: JrfSummary | undefined, context: FitResult["context"]): Promise<string> {
  const batchId = uid("batch");
  const fits: FitResult[] = [];
  for (const p of profiles) fits.push(await freezePrediction({ profile: p, sensory, jrf, batchId, context }));
  store.addPredictions(fits);
  return batchId;
}

export async function runDemo(): Promise<string> {
  const p = ensureDemoProfile();
  store.setActiveProfileId(p.id);
  const d = await loadSampleIntoDraft("d70");
  const s = d.mp6!.parse.profile!;
  return predictFor([p], { ...s, sourceHash: d.mp6!.hash }, undefined, { occasion: "30-second demo" });
}
