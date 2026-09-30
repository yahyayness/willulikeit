// ---------------------------------------------------------------------------
// ajx-core · file-accept — ONE file acceptance contract for every AJX tool
// (brief §25, audit doc 04).
//
//   1. extension is a HINT only (never a gate)
//   2. read safely (File.text() / FileReader fallback), size-capped
//   3. JSON.parse in try/catch
//   4. identify by CONTENT (format / magic / version)
//   5. version gate: newer/unknown → clear message, never a crash
//   6. kind mismatch → actionable message
//   Never executes content. Never throws: always resolves to a result object.
//
// Picker envelope: Android Chrome and iOS Safari map `accept` tokens to MIME
// types / UTIs; unregistered extensions (.jrf, .mp6) are dropped and the files
// appear greyed out. On touch devices we therefore REMOVE `accept` so every
// file is selectable, and rely on steps 3–6. Desktop keeps a helpful filter.
// ---------------------------------------------------------------------------

import { identifyArtifact, versionStatus } from "./mp6-read.js";

export const FILE_ACCEPT_VERSION = "ajx-file-accept@0.1.0";
export const MAX_BYTES_DEFAULT = 10 * 1024 * 1024;

const DESKTOP_ACCEPT = {
  jrf: ".jrf,.json,application/json,text/plain,application/octet-stream",
  mp6: ".mp6,.json,application/json,text/plain,application/octet-stream",
  any: ".jrf,.mp6,.json,application/json,text/plain,application/octet-stream"
};

const LABEL = {
  jrf: "JRF recipe",
  mp6: "MP6 sensory",
  "mp6-lite": "FEELLLM demo recording",
  fcf: "FCF composition (draft)",
  fmlog: "FMLog consumption (draft)",
  seg: "SEG graph (draft)",
  "wulit-export": "WillULikeIT export",
  unknown: "unknown"
};

/** Is this a touch-first / mobile browser where `accept` filtering misbehaves? */
export function isTouchPicker(nav = typeof navigator !== "undefined" ? navigator : null, win = typeof window !== "undefined" ? window : null) {
  if (!nav) return false;
  const ua = String(nav.userAgent || "");
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini/i.test(ua)) return true;
  // iPadOS 13+ reports as Mac with touch
  if (/Macintosh/i.test(ua) && (nav.maxTouchPoints || 0) > 1) return true;
  try { if (win && win.matchMedia && win.matchMedia("(pointer: coarse)").matches && !win.matchMedia("(pointer: fine)").matches) return true; } catch { /* */ }
  return false;
}

/** The `accept` value to use (null = remove the attribute). */
export function pickerAccept(expect = "any", env) {
  if (isTouchPicker(env?.navigator, env?.window)) return null;
  return DESKTOP_ACCEPT[expect] || DESKTOP_ACCEPT.any;
}

/** Apply the picker envelope to an <input type=file>. Safe to call repeatedly. */
export function applyPickerAccept(input, expect = "any", env) {
  if (!input) return input;
  const acc = pickerAccept(expect, env);
  if (acc === null) input.removeAttribute("accept");
  else input.setAttribute("accept", acc);
  return input;
}

/** "native" (.jrf/.mp6) | "native-json" (.jrf.json/.mp6.json) | "json" | "other" */
export function extClass(name = "") {
  const n = String(name).toLowerCase();
  if (/\.(jrf|mp6)\.json$/.test(n)) return "native-json";
  if (/\.(jrf|mp6)$/.test(n)) return "native";
  if (/\.json$/.test(n)) return "json";
  return "other";
}

async function readText(file) {
  if (file && typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    try {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(r.error || new Error("read error"));
      r.readAsText(file);
    } catch (e) { reject(e); }
  });
}

function fail(code, message, extra = {}) {
  return { ok: false, errorCode: code, error: message, warnings: [], ...extra };
}

/**
 * Accept a text payload (already read) — shared by file pickers, drops and samples.
 * @param {string} text
 * @param {{expect?: "jrf"|"mp6"|"any", name?: string, allowKinds?: string[]}} opts
 */
export function acceptText(text, opts = {}) {
  const expect = opts.expect || "any";
  const name = opts.name || "";
  const base = { name, extClass: extClass(name) };
  let data;
  try {
    data = JSON.parse(String(text).replace(/^﻿/, ""));
  } catch {
    const want = expect === "any" ? "JRF or MP6" : expect.toUpperCase();
    return fail("not_json", `That file isn't JSON, so it can't be a ${want} file. Nothing was changed — try another file.`, base);
  }
  const id = identifyArtifact(data);
  const vs = versionStatus(id.kind, id.version);
  const res = { ok: true, kind: id.kind, version: id.version, versionStatus: vs, draft: id.draft, data, text: String(text), warnings: [...id.warnings], ...base };
  const allowed = opts.allowKinds || (expect === "any" ? ["jrf", "mp6"] : [expect]);
  if (!allowed.includes(id.kind)) {
    const got = LABEL[id.kind] || id.kind;
    let hint = "";
    if (id.kind === "mp6" && expect === "jrf") hint = " It looks like an MP6 sensory file — open it in the MP6 slot, the Viewer or the Player instead.";
    else if (id.kind === "jrf" && expect === "mp6") hint = " It looks like a JRF recipe — drop it in the recipe slot, or open it in JRF Studio.";
    else if (id.kind === "mp6-lite") hint = " It is FEELLLM's lightweight demo format, not an MP6 V0.1 file.";
    else if (id.kind === "unknown") hint = expect === "jrf"
      ? ' A JRF file has "format": "ajinomotrix-protocol-version".'
      : expect === "mp6" ? ' An MP6 file has "magic": "AJX-MP6". validate.mp6.app can diagnose it.' : "";
    const want = expect === "any" ? "JRF or MP6" : expect.toUpperCase();
    return { ...res, ok: false, errorCode: "wrong_kind", error: `That file doesn't look like ${want} (detected: ${got}).${hint}` };
  }
  if (vs === "newer") {
    return { ...res, ok: false, errorCode: "newer_version", error: `This ${LABEL[id.kind]} file was made by a newer tool (version ${id.version}). This tool reads version ${supportedLabel(id.kind)}. ${id.kind === "jrf" ? "Open it in JRF Studio (jrf.recipes)" : "Check it in the MP6 Validator (validate.mp6.app)"}, or use the newer tool.` };
  }
  if (vs === "unknown" && (id.kind === "jrf" || id.kind === "mp6")) res.warnings.push(`No ${id.kind === "jrf" ? "version" : "mp6_version"} field — read defensively.`);
  return res;
}

function supportedLabel(kind) {
  return { jrf: "1.0", mp6: "0.1" }[kind] || "?";
}

/**
 * Read + validate a File. Never throws.
 * @returns {Promise<{ok:boolean, kind?:string, version?:string, versionStatus?:string, data?:any, text?:string,
 *                    name:string, extClass:string, warnings:string[], error?:string, errorCode?:string}>}
 */
export async function readAjxFile(file, opts = {}) {
  const name = file?.name || "";
  const base = { name, extClass: extClass(name) };
  if (!file) return fail("no_file", "No file was chosen.", base);
  const max = opts.maxBytes || MAX_BYTES_DEFAULT;
  if (typeof file.size === "number" && file.size > max) {
    return fail("too_large", `This file is too large for an AJX artifact (${Math.round(file.size / 1024 / 1024)} MB; max ${Math.round(max / 1024 / 1024)} MB).`, base);
  }
  let text;
  try {
    text = await readText(file);
  } catch {
    return fail("read_error", "The file could not be read from this device. Try downloading it again, or choose another file.", base);
  }
  return acceptText(text, { ...opts, name });
}
