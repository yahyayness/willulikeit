// ABED-ready evidence export. Each (prediction, outcome?) pair becomes one
// `personal_fit_evaluation` event. Evidence classes stay separate — stated
// preference, predicted fit, actual liking, observed sensory state — and are
// never collapsed into one truth value. ABED = observability, not training.

import { VERSIONS } from "../versions";
import type { FitResult, Outcome, UserProfile } from "./types";

export interface EvidenceEvent {
  event_type: "personal_fit_evaluation";
  schema: string;
  fit_result_id: string;
  fit_result_hash: string;
  batch_id: string;
  user_profile_id: string;
  user_profile_version: string;
  user_profile_hash: string;
  profile_relation: "self" | "other";
  item_id: string;
  item_name: string;
  jrf_hash: string | null;
  expected_mp6_hash: string | null;
  sensory_source_kind: string;
  sensory_synthetic: boolean;
  fit_algorithm: string;
  predicted_fit: number | null;
  coverage: number;
  actual_liking: number | null;
  actual_scale: "hedonic-9 (1–9)";
  liking_index: number | null;
  fit_liking_gap: number | null;
  sensory_match: string | null;
  observed_mp6_hash: string | null;
  sensory_agreement_mad: number | null;
  posthoc_fit_on_observed: number | null;
  context: Record<string, unknown>;
  evidence_classes: string[];
  created_at: string;
  outcome_recorded_at: string | null;
}

export function toEvents(preds: FitResult[], outcomes: Outcome[]): EvidenceEvent[] {
  return preds.map((p) => {
    const o = [...outcomes].filter((x) => x.fitResultId === p.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop();
    const classes = ["stated_preference", "predicted_personal_fit"];
    if (o) classes.push("actual_liking");
    if (o?.observed) classes.push("observed_sensory_state");
    return {
      event_type: "personal_fit_evaluation",
      schema: VERSIONS.evidence,
      fit_result_id: p.id,
      fit_result_hash: p.fitResultHash,
      batch_id: p.batchId,
      user_profile_id: p.profileId,
      user_profile_version: p.profileVersion,
      user_profile_hash: p.profileHash,
      profile_relation: p.profileRelation,
      item_id: p.item.id,
      item_name: p.item.name,
      jrf_hash: p.item.jrfHash ?? null,
      expected_mp6_hash: p.item.expectedMp6Hash ?? null,
      sensory_source_kind: p.item.sensoryKind,
      sensory_synthetic: p.item.synthetic,
      fit_algorithm: p.algorithmVersion,
      predicted_fit: p.fit,
      coverage: p.coverage,
      actual_liking: o?.hedonic ?? null,
      actual_scale: "hedonic-9 (1–9)",
      liking_index: o?.likingIndex ?? null,
      fit_liking_gap: o && Number.isFinite(o.fitLikingGap) ? o.fitLikingGap : null,
      sensory_match: o?.sensoryMatch ?? null,
      observed_mp6_hash: o?.observed?.mp6Hash ?? null,
      sensory_agreement_mad: o?.observed?.agreement?.meanAbsDelta ?? null,
      posthoc_fit_on_observed: o?.observed?.posthocFit ?? null,
      context: { ...p.context },
      evidence_classes: classes,
      created_at: p.createdAt,
      outcome_recorded_at: o?.createdAt ?? null
    };
  });
}

export interface ExportBundle {
  schema: string;
  app: string;
  exported_at: string;
  note: string;
  profiles: UserProfile[];
  predictions: FitResult[];
  outcomes: Outcome[];
  events: EvidenceEvent[];
}

export function buildExport(profiles: UserProfile[], preds: FitResult[], outcomes: Outcome[], now = new Date().toISOString()): ExportBundle {
  return {
    schema: VERSIONS.export,
    app: VERSIONS.app,
    exported_at: now,
    note: "Local WillULikeIT data. Predictions are frozen and append-only; outcomes are stored separately. Fit is not a probability.",
    profiles,
    predictions: preds,
    outcomes,
    events: toEvents(preds, outcomes)
  };
}

export function parseImport(text: string): { ok: true; data: ExportBundle } | { ok: false; error: string } {
  let d: any;
  try {
    d = JSON.parse(text);
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }
  if (d?.schema !== VERSIONS.export) return { ok: false, error: `Expected a ${VERSIONS.export} file exported from WillULikeIT.` };
  if (!Array.isArray(d.profiles) || !Array.isArray(d.predictions) || !Array.isArray(d.outcomes)) return { ok: false, error: "Export is missing profiles, predictions or outcomes." };
  for (const p of d.predictions) if (p?.frozen !== true || typeof p?.id !== "string") return { ok: false, error: "A prediction in the file is not a frozen WillULikeIT prediction." };
  return { ok: true, data: d };
}
