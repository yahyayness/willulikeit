// ---------------------------------------------------------------------------
// ajx-core · mp6-read — READ-ONLY compatibility adapter for AJX artifacts.
//
// Contract (Gate 2, audit doc 03):
//   * never writes, never migrates, never "repairs" a file;
//   * MP6 V0.1 stays the frozen container (magic, mp6_version, evaluations);
//   * all payload dialects seen in the ecosystem are READ through one place:
//       results  : result_records[] | results[] (legacy Recorder) |
//                  results{dim:{attr:num|{mean|value…}}} (Studio / Recorder ≥0.2.2.2) |
//                  scores{dim:{attr:num|{mean…}}}
//       temporal : Player dialect   tracks[{label, attributes[{id,label,curve[{t,v}]}]}]
//                  Recorder dialect tracks[{quality, attributes[{attribute,points[{t,value}]}]}]
//   * missing ≠ 0 · non-numeric ≠ 0 · nothing invented;
//   * default record precedence == MP6 Recorder `resultRecordsFromEvaluation`
//     (result_records → results[] → results{}), equivalence-tested in
//     test/mp6-read.test.mjs against the Recorder engine; `scores` last.
// ---------------------------------------------------------------------------

export const MP6_READ_VERSION = "ajx-mp6-read@0.1.0";

export const SUPPORTED_VERSIONS = Object.freeze({
  jrf: ["1.0"],
  mp6: ["0.1"],
  // DRAFT standards: identified only, never processed in this gate.
  fcf: ["0.1"],
  fmlog: ["0.1"],
  seg: ["0.1"]
});

export const DIMENSIONS = Object.freeze(["taste", "smell", "touch", "sight", "sound", "intuition"]);

const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** Identify any AJX artifact by CONTENT (never by extension or MIME). */
export function identifyArtifact(obj) {
  const warnings = [];
  if (!isObj(obj)) return { kind: "unknown", version: null, draft: false, warnings: ["Not a JSON object."] };
  if (obj.format === "ajinomotrix-protocol-version") {
    return { kind: "jrf", version: obj.version != null ? String(obj.version) : null, draft: false, warnings };
  }
  if (obj.magic === "AJX-MP6") {
    return { kind: "mp6", version: obj.mp6_version != null ? String(obj.mp6_version) : null, draft: false, warnings };
  }
  if (obj.magic === "AJX-FCF") return { kind: "fcf", version: str(obj.fcf_version), draft: true, warnings };
  if (obj.magic === "AJX-FMLOG") return { kind: "fmlog", version: str(obj.fmlog_version), draft: true, warnings };
  if (obj.magic === "AJX-SEG") return { kind: "seg", version: str(obj.seg_version), draft: true, warnings };
  if (Array.isArray(obj.evaluations) && (obj.mp6_version != null || obj.profile_schemas || obj.product)) {
    warnings.push('Missing "magic": "AJX-MP6" — read defensively.');
    return { kind: "mp6", version: str(obj.mp6_version), draft: false, warnings };
  }
  if (typeof obj.format_version === "string" && /mp6-lite/i.test(obj.format_version)) {
    return { kind: "mp6-lite", version: obj.format_version, draft: false, warnings: ["FEELLLM demo format — not an MP6 V0.1 file."] };
  }
  if (obj.format === "wulit-export@1" || obj.schema === "wulit-export@1") return { kind: "wulit-export", version: "1", draft: false, warnings };
  return { kind: "unknown", version: null, draft: false, warnings };
}

function str(v) { return v != null ? String(v) : null; }

/** "supported" | "newer" | "older" | "unknown" — unknown/newer never crash callers. */
export function versionStatus(kind, version) {
  const list = SUPPORTED_VERSIONS[kind];
  if (!list || version == null) return "unknown";
  if (list.includes(String(version))) return "supported";
  const cmp = compareVersions(String(version), list[list.length - 1]);
  return cmp > 0 ? "newer" : cmp < 0 ? "older" : "supported";
}

function compareVersions(a, b) {
  const pa = a.split(".").map((x) => parseInt(x, 10));
  const pb = b.split(".").map((x) => parseInt(x, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number.isFinite(pa[i]) ? pa[i] : 0, y = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** Numeric value of a raw cell: number | {mean|value|score|median|intensity}. null when none. */
export function numericOf(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (isObj(raw)) {
    for (const k of ["mean", "value", "score", "median", "intensity"]) {
      if (typeof raw[k] === "number" && Number.isFinite(raw[k])) return raw[k];
    }
  }
  return null;
}

function meta(raw) {
  if (!isObj(raw)) return {};
  const m = {};
  for (const k of ["sd", "n", "confidence", "quality", "evidence_class", "evidence_kind", "peak_seconds", "scale"]) {
    if (raw[k] !== undefined) m[k] = raw[k];
  }
  return m;
}

const EXTRACTORS = {
  result_records(ev) {
    if (!Array.isArray(ev?.result_records)) return null;
    return ev.result_records
      .filter((r) => isObj(r) && typeof r.attribute === "string")
      .map((r) => ({ dimension: typeof r.dimension === "string" ? r.dimension : null, attribute: r.attribute, value: numericOf(r.value ?? r), ...meta(r), source: "result_records" }));
  },
  results_array(ev) {
    if (!Array.isArray(ev?.results)) return null;
    return ev.results
      .filter((r) => isObj(r) && typeof r.attribute === "string")
      .map((r) => ({ dimension: typeof r.dimension === "string" ? r.dimension : null, attribute: r.attribute, value: numericOf(r.value ?? r), ...meta(r), source: "results_array" }));
  },
  results_map(ev) {
    if (!isObj(ev?.results)) return null;
    return mapRecords(ev.results, "results_map");
  },
  scores(ev) {
    if (!isObj(ev?.scores)) return null;
    return mapRecords(ev.scores, "scores");
  }
};

function mapRecords(map, source) {
  const out = [];
  for (const [dimension, attrs] of Object.entries(map)) {
    if (!isObj(attrs)) continue;
    for (const [attribute, raw] of Object.entries(attrs)) {
      out.push({ dimension, attribute, value: numericOf(raw), ...meta(raw), source });
    }
  }
  return out;
}

export const DEFAULT_RECORD_ORDER = Object.freeze(["result_records", "results_array", "results_map", "scores"]);

/**
 * Sensory records of ONE evaluation. The first dialect in `order` that yields
 * at least one numeric record wins (no silent merging of dialects).
 * Non-numeric cells are returned with value === null (absent, never 0) only
 * when `includeNonNumeric` is set.
 */
export function evaluationRecords(ev, opts = {}) {
  const order = opts.order || DEFAULT_RECORD_ORDER;
  for (const key of order) {
    const fn = EXTRACTORS[key];
    if (!fn) continue;
    const recs = fn(ev);
    if (!recs) continue;
    const numeric = recs.filter((r) => r.value !== null);
    if (numeric.length) return opts.includeNonNumeric ? recs : numeric;
  }
  return [];
}

/** Which dialects an evaluation carries (diagnostics / provenance of the read). */
export function evaluationDialects(ev) {
  return Object.keys(EXTRACTORS).filter((k) => {
    const r = EXTRACTORS[k](ev);
    return r && r.length;
  });
}

/** Records → nested Studio results map {dim:{attr:{mean, sd?, n?, …}}} (READ VIEW ONLY). */
export function recordsToResultsMap(records) {
  const out = {};
  for (const r of records) {
    if (r.value === null || !r.dimension) continue;
    out[r.dimension] = out[r.dimension] || {};
    if (out[r.dimension][r.attribute] !== undefined) continue; // first occurrence wins
    const cell = { mean: r.value };
    for (const k of ["sd", "n", "confidence", "quality", "evidence_class"]) if (r[k] !== undefined) cell[k] = r[k];
    out[r.dimension][r.attribute] = cell;
  }
  return out;
}

const humanize = (s) => String(s).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Normalise any temporal_profile to the Player/Report structural dialect (curve[{t,v}]). */
export function temporalReadView(tp) {
  if (!isObj(tp)) return null;
  const tracks = Array.isArray(tp.tracks) ? tp.tracks : [];
  const outTracks = tracks
    .filter((t) => isObj(t) && typeof t.dimension === "string")
    .map((t) => {
      const attributes = (Array.isArray(t.attributes) ? t.attributes : [])
        .filter(isObj)
        .map((a) => {
          const id = String(a.id ?? a.attribute ?? a.name ?? "attribute");
          const rawCurve = Array.isArray(a.curve) ? a.curve : Array.isArray(a.points) ? a.points : [];
          const curve = rawCurve
            .filter(isObj)
            .map((p) => ({ t: Number(p.t), v: numericOf(p.v ?? p.value) }))
            .filter((p) => Number.isFinite(p.t) && p.v !== null)
            .sort((x, y) => x.t - y.t);
          return { ...a, id, label: typeof a.label === "string" ? a.label : humanize(id), curve };
        })
        .filter((a) => a.curve.length > 0);
      return { ...t, label: typeof t.label === "string" ? t.label : humanize(t.dimension), attributes };
    });
  const phases = (Array.isArray(tp.phases) ? tp.phases : []).filter(isObj).map((p, i) => ({
    ...p,
    id: String(p.id ?? `phase-${i + 1}`),
    label: typeof p.label === "string" ? p.label : humanize(p.id ?? `phase ${i + 1}`)
  }));
  return { ...tp, phases, tracks: outTracks, dominance_events: Array.isArray(tp.dominance_events) ? tp.dominance_events : [] };
}

/**
 * A READ VIEW of an MP6 for legacy consumers (Player, Report …).
 * Deep-cloned; every evaluation gains a `results` nested map when it has
 * numeric records in any dialect; temporal tracks are normalised.
 * `_ajx_read_view` marks it so that exporters can refuse to write it back.
 */
export function mp6ReadView(doc) {
  const view = JSON.parse(JSON.stringify(doc ?? {}));
  const dialects = new Set();
  if (Array.isArray(view.evaluations)) {
    view.evaluations = view.evaluations.map((ev) => {
      if (!isObj(ev)) return ev;
      evaluationDialects(ev).forEach((d) => dialects.add(d));
      const hasMap = isObj(ev.results) && mapRecords(ev.results, "results_map").some((r) => r.value !== null);
      if (hasMap) return ev;
      const recs = evaluationRecords(ev);
      if (!recs.length) return ev;
      return { ...ev, results: recordsToResultsMap(recs), _ajx_results_from: recs[0].source };
    });
  }
  if (isObj(view.temporal_profile)) {
    const tv = temporalReadView(view.temporal_profile);
    const recorderDialect = (view.temporal_profile.tracks || []).some((t) => (t?.attributes || []).some((a) => Array.isArray(a?.points)));
    if (recorderDialect) dialects.add("temporal_recorder");
    else if ((view.temporal_profile.tracks || []).length) dialects.add("temporal_player");
    view.temporal_profile = tv;
  }
  Object.defineProperty(view, "_ajx_read_view", {
    value: { adapter: MP6_READ_VERSION, dialects: [...dialects] },
    enumerable: false
  });
  return view;
}

/** First evaluation's records + evidence kind — convenience for UIs (FEELLLM, shell). */
export function summarizeMp6(doc, evaluationIndex = 0) {
  const evals = Array.isArray(doc?.evaluations) ? doc.evaluations : [];
  const idx = Math.min(Math.max(0, evaluationIndex), Math.max(0, evals.length - 1));
  const ev = evals[idx];
  const records = ev ? evaluationRecords(ev) : [];
  const { kind, reason } = evidenceKind(doc, ev);
  let temporalRecords = [];
  if (!records.length && isObj(doc?.temporal_profile)) {
    const tv = temporalReadView(doc.temporal_profile);
    for (const t of tv.tracks) for (const a of t.attributes) {
      const peak = Math.max(...a.curve.map((p) => p.v));
      temporalRecords.push({ dimension: t.dimension, attribute: a.id, value: peak, source: "temporal_peak" });
    }
  }
  return {
    name: String(doc?.product?.name ?? doc?.meta?.name ?? doc?.meta?.title ?? ev?.subject ?? "Unnamed item"),
    category: doc?.product?.category ?? null,
    kind,
    kindReason: reason,
    evaluationCount: evals.length,
    records: records.length ? records : temporalRecords,
    recordSource: records.length ? records[0].source : temporalRecords.length ? "temporal_peak" : null
  };
}

// --- Evidence kind: verbatim port of WillULikeIT `detectKind` (src/lib/mp6.ts @184f509).
//     Equivalence is enforced by ajx-studios/test/engines.contract.test.ts.
const EXPECTED_RX = /simulat|predict|projection|expected|synthetic_recipe|ai_/i;
const OBSERVED_RX = /observ|single_user_recording|self_recorded|panel|measured|consumer|tasting|recorded/i;

export function evidenceKind(data, ev) {
  const probes = [
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
