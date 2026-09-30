// ajx-core — shared, dependency-free modules for every AJX Studios tool.
// Canonical source lives here (ajx-studios/packages/ajx-core/src). Other repos
// receive byte-identical VENDORED copies via scripts/vendor-sync.mjs; the
// `--check` mode fails CI when a copy drifts.
export const AJX_CORE_VERSION = "0.1.0";
export * from "./mp6-read.js";
export * from "./file-accept.js";
export * from "./guard.js";
export * from "./envelope.js";
export * from "./telemetry.js";
export * from "./studios-bar.js";
