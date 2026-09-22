// ---------------------------------------------------------------------------
// JRF ingestion (format "ajinomotrix-protocol-version" 1.0 — as exported by
// jrf.recipes / Ajinoverse Studio / AJNV4.3). WillULikeIT is NOT a JRF
// editor: it reads identity, ingredients and process to attach the fit result
// to the item and to give FEELLLM enough context to suggest modifications.
// It does not predict sensory state from the recipe — that is the job of the
// MP6 Recorder / AJNV Predictive Cuisine path.
// ---------------------------------------------------------------------------

import { canonicalAttr } from "./vocab";
import type { JrfSummary, SensoryProfile, SensoryValue } from "./types";
import { slug } from "./mp6";

export interface JrfParseResult {
  ok: boolean;
  error?: string;
  warnings: string[];
  summary?: JrfSummary;
  /** raw ingredient-level sensory entries, for the optional proxy */
  ingredientSensory: { name: string; scores: Record<string, Record<string, number>> }[];
}

function asNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function parseJrf(text: string, fileName?: string): JrfParseResult {
  const warnings: string[] = [];
  let d: any;
  try {
    d = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON, so it cannot be a JRF file. Nothing was repaired.", warnings, ingredientSensory: [] };
  }
  if (d?.magic === "AJX-MP6") {
    return { ok: false, error: "This is an MP6 sensory file, not a JRF recipe. Load it in the sensory slot instead.", warnings, ingredientSensory: [] };
  }
  if (d?.format !== "ajinomotrix-protocol-version") {
    if (!d?.protocol?.version?.graph) {
      return { ok: false, error: 'Not a JRF file: expected "format": "ajinomotrix-protocol-version" with a protocol graph. Export it from jrf.recipes or Ajinoverse Studio.', warnings, ingredientSensory: [] };
    }
    warnings.push('Missing "format": "ajinomotrix-protocol-version" — read defensively.');
  }
  const p = d.protocol ?? {};
  const v = p.version ?? {};
  const nodes: any[] = Array.isArray(v.graph?.nodes) ? v.graph.nodes : [];
  if (!nodes.length) warnings.push("The recipe graph has no nodes.");

  const ingredients = nodes
    .filter((n) => n?.type === "ingredient")
    .map((n) => ({ label: String(n.payload?.label ?? "ingredient"), quantity: asNum(n.payload?.quantity), unit: n.payload?.unit ? String(n.payload.unit) : undefined }));
  const processes = nodes
    .filter((n) => n?.type === "process")
    .map((n) => ({
      label: String(n.payload?.label ?? "process"),
      duration_s: asNum(n.duration_s) ?? asNum(n.payload?.duration),
      temperature: asNum(n.payload?.temperature) ?? (typeof n.payload?.temperature === "object" ? asNum(n.payload.temperature?.value) : undefined)
    }));
  const materials = nodes.filter((n) => n?.type === "material").map((n) => String(n.payload?.label ?? "material"));
  const serveNode = nodes.find((n) => n?.type === "serve");

  // ingredient-level sensory (dependencies.sensory) — kept apart from product level
  const depIngr: any[] = Array.isArray(d.dependencies?.ingredients) ? d.dependencies.ingredients : [];
  const refName: Record<string, string> = {};
  for (const i of depIngr) if (i?.ref_id) refName[i.ref_id] = String(i.name ?? i.ref_id);
  const sens: any[] = Array.isArray(d.dependencies?.sensory) ? d.dependencies.sensory : [];
  const ingredientSensory = sens
    .filter((s) => s?.entity_type === "ingredient" && s?.data?.scores && typeof s.data.scores === "object")
    .map((s) => ({ name: refName[s.entity_ref] ?? String(s.entity_ref ?? "ingredient"), scores: s.data.scores }));

  return {
    ok: true,
    warnings,
    ingredientSensory,
    summary: {
      name: String(p.name ?? serveNode?.payload?.title ?? fileName ?? "Untitled recipe"),
      description: p.description ? String(p.description) : undefined,
      version: v.version ? String(v.version) : undefined,
      status: v.status ? String(v.status) : undefined,
      exportedAt: d.exported_at ? String(d.exported_at) : undefined,
      ingredients,
      processes,
      materials,
      serve: serveNode?.payload?.title ?? serveNode?.payload?.label,
      ingredientSensoryCount: ingredientSensory.length,
      sourceFile: fileName
    }
  };
}

/**
 * OPTIONAL crude proxy: unweighted mean of ingredient-level sensory scores
 * carried inside the JRF. Explicitly labelled `proxy` — this is NOT an
 * Expected MP6 and ignores quantities, process, fermentation, cooking.
 * Only offered when the user asks for it and no Expected MP6 exists.
 */
export function ingredientProxy(jrf: JrfParseResult): SensoryProfile | null {
  if (!jrf.ok || !jrf.summary || !jrf.ingredientSensory.length) return null;
  const acc: Record<string, { sum: number; n: number; src: string; dim: string }> = {};
  for (const ing of jrf.ingredientSensory) {
    for (const [dim, attrs] of Object.entries(ing.scores)) {
      if (!attrs || typeof attrs !== "object") continue;
      for (const [attr, raw] of Object.entries(attrs)) {
        const val = typeof raw === "number" ? raw : (raw as any)?.mean;
        if (typeof val !== "number" || !Number.isFinite(val)) continue;
        const c = canonicalAttr(attr);
        if (!c) continue;
        const a = (acc[c] ??= { sum: 0, n: 0, src: attr, dim });
        a.sum += val;
        a.n += 1;
      }
    }
  }
  const values: Record<string, SensoryValue> = {};
  for (const [k, a] of Object.entries(acc)) values[k] = { value: Math.round((a.sum / a.n) * 100) / 100, source_attribute: a.src, source_dimension: a.dim };
  const s = jrf.summary;
  return {
    kind: "proxy",
    kindReason: "unweighted mean of ingredient-level sensory scores found in the JRF (wulit-ingredient-proxy@0.1)",
    itemId: slug(s.name) + (s.version ? `-v${s.version}` : ""),
    itemName: s.name,
    synthetic: true,
    values,
    unmapped: [],
    absent: [],
    evaluationCount: 0,
    sourceFile: s.sourceFile,
    notes: [
      `Crude proxy from ${jrf.ingredientSensory.length} of ${s.ingredients.length || jrf.ingredientSensory.length} ingredients that carry sensory data.`,
      "Ignores quantities, process, cooking and fermentation. Not an Expected MP6 — generate one at record.mp6.app for a real prediction."
    ],
    proxyCoverage: { withSensory: jrf.ingredientSensory.length, totalIngredients: s.ingredients.length }
  };
}
