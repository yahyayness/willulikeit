// ---------------------------------------------------------------------------
// MP6 ingestion — consume, never re-model.
// Reads the frozen MP6 v0.1 container (magic "AJX-MP6") in the two shapes the
// Studio produces today:
//   A) evaluations[].scores[dimension][attribute] = number | {mean|value|score}
//      (Product Profile / AJNV4.3 synthetic projections / Converter output)
//   B) evaluations[].results = [{dimension, attribute, value}]
//      (record.mp6.app sessions)
// Rules: missing ≠ 0, non-numeric ≠ 0, unknown attributes are preserved
// (listed as unmapped), scales are normalised to 0–10 with source scale kept.
// Invalid input fails clearly — no silent repair.
// ---------------------------------------------------------------------------

import { canonicalAttr } from "./vocab";
import type { SensoryKind, SensoryProfile, SensoryValue } from "./types";

export interface Mp6ParseResult {
  ok: boolean;
  error?: string;
  warnings: string[];
  profile?: SensoryProfile;
  evaluations: { id: string; label: string }[];
}

type Scale = { min: number; max: number };
const DEFAULT_SCALE: Scale = { min: 0, max: 10 };

function isObj(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readScale(v: any): Scale | undefined {
  if (isObj(v) && typeof v.min === "number" && typeof v.max === "number" && v.max > v.min) return { min: v.min, max: v.max };
  return undefined;
}

function numericOf(v: any): { value: number; scale?: Scale; confidence?: number } | null {
  if (typeof v === "number" && Number.isFinite(v)) return { value: v };
  if (isObj(v)) {
    for (const k of ["mean", "value", "score", "median", "intensity"]) {
      if (typeof v[k] === "number" && Number.isFinite(v[k])) {
        return { value: v[k], scale: readScale(v.scale) ?? readScale(v.source_scale), confidence: typeof v.confidence === "number" ? v.confidence : undefined };
      }
    }
  }
  return null;
}

const EXPECTED_RX = /simulat|predict|projection|expected|synthetic_recipe|ai_/i;
const OBSERVED_RX = /observ|single_user_recording|self_recorded|panel|measured|consumer|tasting|recorded/i;

export function detectKind(data: any, ev: any): { kind: SensoryKind; reason: string } {
  const probes: [string, unknown][] = [
    ["evaluation.evaluation_type", ev?.evaluation_type],
    ["evaluation.type", ev?.type],
    ["evaluation.method", typeof ev?.method === "string" ? ev.method : ev?.method?.type],
    ["meta.prediction_state", data?.meta?.prediction_state],
    ["meta.mp6_role", data?.meta?.mp6_role],
    ["meta.validation_status", data?.meta?.validation_status],
    ["governance.data_class", data?.governance?.data_class],
    ["governance.validation_status", data?.governance?.validation_status],
    ["meta.file_role", data?.meta?.file_role]
  ];
  for (const [where, v] of probes) {
    if (typeof v !== "string") continue;
    if (/mp6[-_]?sim|expected/i.test(v)) return { kind: "expected", reason: `${where} = "${v}"` };
    if (/mp6[-_]?obs/i.test(v)) return { kind: "observed", reason: `${where} = "${v}"` };
  }
  for (const [where, v] of probes) {
    if (typeof v !== "string") continue;
    if (EXPECTED_RX.test(v)) return { kind: "expected", reason: `${where} = "${v}"` };
    if (OBSERVED_RX.test(v)) return { kind: "observed", reason: `${where} = "${v}"` };
  }
  return { kind: "unknown", reason: "no prediction/observation marker found in the file" };
}

export function parseMp6(text: string, fileName?: string, evaluationIndex = 0): Mp6ParseResult {
  const warnings: string[] = [];
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON, so it cannot be an MP6 v0.1 file. Nothing was repaired.", warnings, evaluations: [] };
  }
  if (!isObj(data)) return { ok: false, error: "The file is JSON but not an MP6 object.", warnings, evaluations: [] };
  if (data.format === "ajinomotrix-protocol-version") {
    return { ok: false, error: "This is a JRF recipe file, not an MP6. Load it in the recipe slot instead.", warnings, evaluations: [] };
  }
  if (data.magic !== "AJX-MP6") {
    if (!Array.isArray(data.evaluations)) {
      return { ok: false, error: 'Not an MP6 file: no "magic": "AJX-MP6" and no evaluations block. Check it at validate.mp6.app.', warnings, evaluations: [] };
    }
    warnings.push('Missing "magic": "AJX-MP6" — read defensively. Run it through validate.mp6.app.');
  }
  const evals: any[] = Array.isArray(data.evaluations) ? data.evaluations : [];
  if (!evals.length) return { ok: false, error: "The MP6 file has no evaluations — there is no sensory profile to compare against.", warnings, evaluations: [] };

  const evaluations = evals.map((e, i) => ({
    id: String(e?.id ?? `evaluation-${i + 1}`),
    label: String(e?.subject ?? e?.evaluation_type ?? e?.type ?? e?.method ?? `evaluation ${i + 1}`)
  }));
  const idx = Math.min(Math.max(0, evaluationIndex), evals.length - 1);
  const ev = evals[idx];
  if (evals.length > 1) warnings.push(`File holds ${evals.length} evaluations — using "${evaluations[idx].label}".`);

  const schemaScale = readScale(data.profile_schemas?.[0]?.scale);
  const evScale = readScale(ev?.scale) ?? schemaScale ?? DEFAULT_SCALE;

  const values: Record<string, SensoryValue> = {};
  const unmapped: SensoryProfile["unmapped"] = [];
  const absent: string[] = [];

  const ingest = (dimension: string | undefined, attribute: string, raw: any) => {
    const n = numericOf(raw);
    if (!n) {
      absent.push(dimension ? `${dimension}.${attribute}` : attribute);
      return;
    }
    const scale = n.scale ?? evScale;
    const norm = ((n.value - scale.min) / (scale.max - scale.min)) * 10;
    if (norm < -0.001 || norm > 10.001) {
      warnings.push(`${attribute} = ${n.value} lies outside its declared scale ${scale.min}–${scale.max}; kept but clamped for comparison.`);
    }
    const value = Math.min(10, Math.max(0, Math.round(norm * 100) / 100));
    const canon = canonicalAttr(attribute);
    if (!canon) {
      unmapped.push({ dimension, attribute, value });
      return;
    }
    const existing = values[canon];
    // Alias policy: if both canonical and alias exist (e.g. touch.body and
    // taste.body_richness), the canonical name wins; the alias is preserved.
    if (existing) {
      if (existing.source_attribute === canon) {
        unmapped.push({ dimension, attribute, value });
        return;
      }
      if (attribute !== canon) {
        unmapped.push({ dimension, attribute, value });
        return;
      }
      unmapped.push({ dimension: existing.source_dimension, attribute: existing.source_attribute, value: existing.value });
    }
    values[canon] = {
      value,
      source_attribute: attribute,
      source_dimension: dimension,
      source_scale: scale.min !== 0 || scale.max !== 10 ? scale : undefined,
      confidence: n.confidence ?? (typeof ev?.confidence === "number" ? ev.confidence : undefined)
    };
  };

  if (isObj(ev?.scores)) {
    for (const [dim, attrs] of Object.entries(ev.scores)) {
      if (isObj(attrs)) for (const [attr, raw] of Object.entries(attrs)) ingest(dim, attr, raw);
    }
  }
  if (Array.isArray(ev?.results)) {
    for (const r of ev.results) {
      if (isObj(r) && typeof r.attribute === "string") ingest(typeof r.dimension === "string" ? r.dimension : undefined, r.attribute, r.value ?? r);
    }
  }
  if (!Object.keys(values).length && !unmapped.length) {
    return { ok: false, error: "The selected evaluation carries no numeric sensory values (scores or results). Nothing was invented to fill the gap.", warnings, evaluations };
  }

  const { kind, reason } = detectKind(data, ev);
  if (kind === "unknown") warnings.push("The file does not say whether it is a prediction (MP6-SIM) or an observation (MP6-OBS). Treated as unknown.");

  const synthetic = Boolean(
    data.meta?.synthetic_demo ||
      /synthetic|demo|fixture|reconstruct/i.test(String(data.governance?.data_class ?? "")) ||
      /synthetic|demo|fixture|reconstruct|simulat/i.test(String(ev?.scores ? JSON.stringify(ev.scores).slice(0, 2000) : "")) ||
      /synthetic|fixture|demo/i.test(String(data.meta?.validation_status ?? ""))
  );

  const linkedRecipe =
    data.recipe_graph?.source_file ??
    data.source_data?.recipe_file ??
    (Array.isArray(data.attachments) ? data.attachments.find((a: any) => /jrf|recipe/i.test(String(a?.type ?? a?.label ?? a?.uri ?? "")))?.uri : undefined) ??
    (data.meta?.source_recipe_version ? `recipe v${data.meta.source_recipe_version}` : undefined);

  const itemName = String(data.product?.name ?? data.meta?.title ?? ev?.subject ?? fileName ?? "Unnamed item");
  const itemId = String(data.product?.id ?? slug(itemName));

  const notes: string[] = [];
  if (Array.isArray(data.meta?.notes)) notes.push(...data.meta.notes.map(String).slice(0, 4));
  if (typeof data.governance?.disclaimer === "string") notes.push(data.governance.disclaimer);

  return {
    ok: true,
    warnings,
    evaluations,
    profile: {
      kind,
      kindReason: reason,
      itemId,
      itemName,
      category: data.product?.category ? String(data.product.category) : undefined,
      synthetic,
      values,
      unmapped,
      absent,
      evaluationId: evaluations[idx].id,
      evaluationCount: evals.length,
      sourceFile: fileName,
      linkedRecipe: linkedRecipe ? String(linkedRecipe) : undefined,
      notes
    }
  };
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "item";
}
