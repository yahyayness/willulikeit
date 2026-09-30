// ---------------------------------------------------------------------------
// ajx-core · envelope — AJX Workflow Envelope v0 (internal transport, NOT a
// public food standard; follows integration/AJX-workflow-envelope.txt of the
// Digital Food 2.0 draft). Local-first in this gate: no central content store.
//
// Extensible by construction: artifact slots cover JRF, FCF, Expected MP6,
// Observed MP6, FMLog and SEG, plus an open `extensions` map, so FCF/FMLog/SEG
// can be attached later without a breaking redesign. Artifacts are referenced
// by hash; payloads live in the host app's local store.
// ---------------------------------------------------------------------------

export const ENVELOPE_VERSION = "ajx-workflow@0";

export const STEPS = Object.freeze(["extract", "sensory", "predict_fit", "interpret", "adapt"]);

export const STEP_LABELS = Object.freeze({
  extract: "Extract",
  sensory: "Record / Predict",
  predict_fit: "Predict Fit",
  interpret: "Interpret",
  adapt: "Adapt"
});

export const NEXT_ACTION = Object.freeze({
  extract: "Start from a recipe",
  sensory: "Predict how it will feel",
  predict_fit: "See whether I'll like it",
  interpret: "Interpret the experience",
  adapt: "Adapt / ask my AI"
});

/** Artifact slots. Draft-standard slots exist now so the model never needs a breaking change. */
export const ARTIFACT_SLOTS = Object.freeze({
  jrf: { kind: "jrf", status: "implemented" },
  fcf: { kind: "fcf", status: "draft-reserved" },
  expected_mp6: { kind: "mp6", status: "implemented", evidence: "expected" },
  observed_mp6: { kind: "mp6", status: "implemented", evidence: "observed" },
  fmlog: { kind: "fmlog", status: "draft-reserved" },
  seg: { kind: "seg", status: "draft-reserved" },
  fit: { kind: "wulit-fit", status: "implemented" },
  interpretation: { kind: "feelllm-brief", status: "implemented" },
  bundle: { kind: "ajx-handoff-bundle", status: "implemented" }
});

/** Provenance modes (audit doc 08 §8.1). Epistemically distinct — never collapse. */
export const PROVENANCE_MODES = Object.freeze([
  "recorded", "predicted", "suggested_accepted", "suggested_edited", "suggested_rejected",
  "estimated_proxy", "stated", "reported", "derived", "skipped", "sample", "unknown"
]);

export function newWorkflowId(rand = defaultRandom) {
  const bytes = rand(16);
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return "wf_" + s;
}

function defaultRandom(n) {
  const a = new Uint8Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
  return a;
}

export function createEnvelope({ type = "guided-ez", origin = {}, now = new Date().toISOString(), id } = {}) {
  return {
    envelope: ENVELOPE_VERSION,
    workflow_id: id || newWorkflowId(),
    workflow_type: type,
    created_at: now,
    updated_at: now,
    origin: { tool: origin.tool || "ajx-studios", version: origin.version || null, entry: origin.entry || null },
    current_step: "extract",
    completed_steps: [],
    skipped_steps: [],
    source: null,
    artifacts: Object.fromEntries(Object.keys(ARTIFACT_SLOTS).map((k) => [k, null])),
    extensions: {},
    provenance: [],
    versions: { envelope: "0", jrf: "1.0", mp6: "0.1" }
  };
}

/** Attach an artifact reference (hash + descriptors). Payload stays with the caller. */
export function attachArtifact(env, slot, ref, now = new Date().toISOString()) {
  if (!(slot in ARTIFACT_SLOTS) && !slot.startsWith("x_")) throw new Error(`Unknown artifact slot "${slot}" (use x_* for extensions)`);
  const mode = ref.provenance_mode || "unknown";
  if (!PROVENANCE_MODES.includes(mode)) throw new Error(`Unknown provenance mode "${mode}"`);
  if (slot === "observed_mp6" && mode === "predicted") throw new Error("A predicted MP6 can never be attached as observed evidence");
  if (slot === "expected_mp6" && mode === "recorded") throw new Error("A recorded MP6 can never be attached as expected");
  const target = slot.startsWith("x_") ? env.extensions : env.artifacts;
  target[slot] = { ...ref, attached_at: now };
  env.provenance.push({ slot, mode, at: now, by: ref.by || null });
  env.updated_at = now;
  return env;
}

export function completeStep(env, step, { skipped = false, now = new Date().toISOString() } = {}) {
  if (!STEPS.includes(step)) throw new Error(`Unknown step ${step}`);
  if (!env.completed_steps.includes(step)) env.completed_steps.push(step);
  if (skipped && !env.skipped_steps.includes(step)) env.skipped_steps.push(step);
  const i = STEPS.indexOf(step);
  env.current_step = STEPS[Math.min(i + 1, STEPS.length - 1)];
  env.updated_at = now;
  return env;
}

/** Where a returning visitor should land + the primary CTA. */
export function resumePoint(env) {
  if (!env) return { step: "extract", label: NEXT_ACTION.extract, done: false };
  const allDone = STEPS.every((s) => env.completed_steps.includes(s));
  if (allDone) return { step: "adapt", label: "Start another", done: true };
  const next = STEPS.find((s) => !env.completed_steps.includes(s)) || "extract";
  return { step: next, label: NEXT_ACTION[next], done: false };
}

/** Validate an envelope read back from storage. Never throws. */
export function checkEnvelope(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, reason: "not an object" };
  if (typeof obj.envelope !== "string") return { ok: false, reason: "no envelope version" };
  if (obj.envelope !== ENVELOPE_VERSION) return { ok: false, reason: `unsupported envelope ${obj.envelope}`, unsupported: true };
  if (!/^wf_[a-z0-9]{8,}$/.test(String(obj.workflow_id))) return { ok: false, reason: "bad workflow id" };
  if (!Array.isArray(obj.completed_steps) || !obj.artifacts || typeof obj.artifacts !== "object") return { ok: false, reason: "bad shape" };
  return { ok: true };
}
