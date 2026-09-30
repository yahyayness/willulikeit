// ---------------------------------------------------------------------------
// ajx-core · telemetry — privacy-preserving technical diagnostics & churn
// signals (Gate 2 decision 3, audit doc 10). ABED-SP'G-ingestible later:
// stable event names, schema tag, workflow id, provenance mode.
//
// ALLOWED: tool, version, step, browser/OS family, viewport class, sanitized
// error type/message/frames, recovery path/result, non-content workflow id,
// durations, enum-like detail values.
// NEVER: recipe text, JRF/MP6 payloads, narratives, transcripts, psychometric
// answers, file contents or names, free text, keys, source URLs.
// Enforced here by a per-event detail allowlist + value sanitizer.
// ---------------------------------------------------------------------------

import { envClass, scrub } from "./guard.js";

export const TELEMETRY_SCHEMA = "ajx-telemetry@0";

/** event → allowed detail keys (anything else is dropped). */
export const EVENTS = Object.freeze({
  workflow_started: ["entry"],
  workflow_resumed: ["from_step"],
  workflow_completed: [],
  workflow_abandoned: ["last_step"],
  step_viewed: [],
  step_completed: ["mode"],
  ez_bypass_used: ["choice"],
  optional_step_skipped: [],
  file_picker_opened: ["expect"],
  file_accepted: ["kind", "ext_class", "version_status"],
  file_rejected: ["expect", "ext_class", "reason_code"],
  native_extension_used: ["kind"],
  prediction_requested: ["engine"],
  prediction_generated: ["engine", "dimension_count"],
  prediction_failed: ["engine", "reason_code"],
  prediction_accepted: ["mode"],
  prediction_edited: ["count"],
  prediction_rejected: ["count"],
  psychometric_started: ["control"],
  psychometric_interaction: ["control"],
  psychometric_completed: ["control", "answered_count"],
  browser_error: ["error_type", "origin", "message", "frames", "component"],
  recovery_offered: ["kind"],
  recovery_succeeded: ["kind"],
  handoff_started: ["target", "method"],
  handoff_completed: ["target", "method"],
  handoff_failed: ["target", "method", "reason_code"],
  export_downloaded: ["kind"]
});

const MAX_STR = 120;
const ENUM_RX = /^[a-z0-9_.:@\-/ |]{0,160}$/i;

function cleanDetail(event, detail) {
  const allowed = EVENTS[event] || [];
  const out = {};
  for (const k of allowed) {
    if (!(k in (detail || {}))) continue;
    const v = detail[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") {
      // error messages are scrubbed; every other string must be enum-like
      if (k === "message" || k === "frames") out[k] = scrub(v, MAX_STR * 2);
      else if (ENUM_RX.test(v) && v.length <= 48) out[k] = v;
    }
  }
  return out;
}

/**
 * createTelemetry({ tool, version, endpoint?, getWorkflowId?, bufferKey?, enabled?, persist? })
 * Transport: navigator.sendBeacon(endpoint) when configured; always also kept in
 * a bounded local ring buffer (inspectable via .buffer()). Never blocks the UI.
 */
export function createTelemetry(opts = {}) {
  const tool = opts.tool || "unknown";
  const version = opts.version || null;
  const bufferKey = opts.bufferKey || `ajx.telemetry.${tool}`;
  const cap = opts.cap || 200;
  let enabled = opts.enabled !== false;
  const sessionId = "s_" + Math.random().toString(36).slice(2, 12);
  const started = Date.now();
  const mem = [];
  const keep = opts.persist !== false; // persist:false → memory only (nothing written to storage)

  function persist(evt) {
    mem.push(evt); if (mem.length > cap) mem.shift();
    if (!keep) return;
    try {
      const raw = window.localStorage.getItem(bufferKey);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(evt);
      window.localStorage.setItem(bufferKey, JSON.stringify(arr.slice(-cap)));
    } catch { /* storage unavailable — fine */ }
  }

  function track(event, { step = null, provenance_mode = null, duration_ms = null, detail = {} } = {}) {
    if (!enabled || !(event in EVENTS)) return null;
    let env = {};
    try { env = envClass(); } catch { /* */ }
    const evt = {
      schema: TELEMETRY_SCHEMA,
      event,
      at: new Date().toISOString(),
      tool,
      tool_version: version,
      session_id: sessionId,
      workflow_id: safe(opts.getWorkflowId) || null,
      step,
      provenance_mode,
      duration_ms: typeof duration_ms === "number" ? Math.round(duration_ms) : null,
      since_start_ms: Date.now() - started,
      ...env,
      detail: cleanDetail(event, detail)
    };
    persist(evt);
    if (opts.endpoint) {
      try {
        const body = JSON.stringify(evt);
        if (typeof navigator !== "undefined" && navigator.sendBeacon) navigator.sendBeacon(opts.endpoint, new Blob([body], { type: "application/json" }));
        else if (typeof fetch !== "undefined") fetch(opts.endpoint, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
      } catch { /* never block */ }
    }
    return evt;
  }

  return {
    track,
    buffer() { if (!keep) return mem.slice(); try { return JSON.parse(window.localStorage.getItem(bufferKey) || "[]"); } catch { return mem.slice(); } },
    clear() { mem.length = 0; try { if (keep) window.localStorage.removeItem(bufferKey); } catch { /* */ } },
    setEnabled(v) { enabled = !!v; },
    get enabled() { return enabled; }
  };
}

function safe(fn) { try { return fn ? fn() : undefined; } catch { return undefined; } }

/** Server-side validator (used by the shell's /api/diag endpoint and tests). */
export function validateTelemetryEvent(evt) {
  if (!evt || typeof evt !== "object") return { ok: false, reason: "not an object" };
  if (evt.schema !== TELEMETRY_SCHEMA) return { ok: false, reason: "schema" };
  if (!(evt.event in EVENTS)) return { ok: false, reason: "event" };
  const clean = { ...evt, detail: cleanDetail(evt.event, evt.detail) };
  for (const k of Object.keys(clean)) {
    if (!["schema", "event", "at", "tool", "tool_version", "session_id", "workflow_id", "step", "provenance_mode", "duration_ms", "since_start_ms", "browser_family", "os_family", "viewport_class", "detail"].includes(k)) delete clean[k];
  }
  for (const k of ["tool", "tool_version", "session_id", "workflow_id", "step", "provenance_mode", "browser_family", "os_family", "viewport_class"]) {
    if (clean[k] != null && (typeof clean[k] !== "string" || !ENUM_RX.test(clean[k]) || clean[k].length > 64)) clean[k] = null;
  }
  return { ok: true, event: clean };
}
