// Type declarations for ajx-core (hand-written; the runtime is plain ESM JS).
export declare const AJX_CORE_VERSION: string;

// ---- mp6-read ----
export type ArtifactKind = "jrf" | "mp6" | "fcf" | "fmlog" | "seg" | "mp6-lite" | "wulit-export" | "unknown";
export interface Identified { kind: ArtifactKind; version: string | null; draft: boolean; warnings: string[] }
export interface SensoryRecord {
  dimension: string | null; attribute: string; value: number | null;
  sd?: number; n?: number; confidence?: number; quality?: string; evidence_class?: string; peak_seconds?: number; scale?: unknown;
  source: "result_records" | "results_array" | "results_map" | "scores" | "temporal_peak";
}
export declare const MP6_READ_VERSION: string;
export declare const SUPPORTED_VERSIONS: Readonly<Record<string, string[]>>;
export declare const DIMENSIONS: readonly string[];
export declare const DEFAULT_RECORD_ORDER: readonly string[];
export declare function identifyArtifact(obj: unknown): Identified;
export declare function versionStatus(kind: string, version: string | null): "supported" | "newer" | "older" | "unknown";
export declare function numericOf(raw: unknown): number | null;
export declare function evaluationRecords(ev: any, opts?: { order?: readonly string[]; includeNonNumeric?: boolean }): SensoryRecord[];
export declare function evaluationDialects(ev: any): string[];
export declare function recordsToResultsMap(records: SensoryRecord[]): Record<string, Record<string, { mean: number; [k: string]: unknown }>>;
export declare function temporalReadView(tp: any): any;
export declare function mp6ReadView<T = any>(doc: T): any;
export declare function summarizeMp6(doc: any, evaluationIndex?: number): {
  name: string; category: string | null; kind: "expected" | "observed" | "unknown"; kindReason: string;
  evaluationCount: number; records: SensoryRecord[]; recordSource: string | null;
};
export declare function evidenceKind(data: any, ev: any): { kind: "expected" | "observed" | "unknown"; reason: string };

// ---- file-accept ----
export interface AcceptResult {
  ok: boolean; kind?: ArtifactKind; version?: string | null; versionStatus?: string; draft?: boolean;
  data?: any; text?: string; name: string; extClass: "native" | "native-json" | "json" | "other";
  warnings: string[]; error?: string; errorCode?: "no_file" | "too_large" | "read_error" | "not_json" | "wrong_kind" | "newer_version";
}
export declare const FILE_ACCEPT_VERSION: string;
export declare const MAX_BYTES_DEFAULT: number;
export declare function isTouchPicker(nav?: any, win?: any): boolean;
export declare function pickerAccept(expect?: "jrf" | "mp6" | "any", env?: { navigator?: any; window?: any }): string | null;
export declare function applyPickerAccept<T extends HTMLInputElement | null>(input: T, expect?: "jrf" | "mp6" | "any", env?: any): T;
export declare function extClass(name?: string): "native" | "native-json" | "json" | "other";
export declare function acceptText(text: string, opts?: { expect?: "jrf" | "mp6" | "any"; name?: string; allowKinds?: string[] }): AcceptResult;
export declare function readAjxFile(file: File | null | undefined, opts?: { expect?: "jrf" | "mp6" | "any"; maxBytes?: number; allowKinds?: string[] }): Promise<AcceptResult>;

// ---- guard ----
export declare const GUARD_VERSION: string;
export declare function envClass(nav?: any, win?: any): { browser_family: string; os_family: string; viewport_class: string };
export declare function scrub(s: unknown, max?: number): string;
export declare function sanitizeError(err: unknown): { type: string; message: string; frames: string[] };
export declare function installGuard(opts?: { tool?: string; version?: string; getStep?: () => string | null; onFatal?: (info: any) => void; telemetry?: { track: Function } }): () => void;
export declare function loadDraft<T = any>(key: string, opts?: { schema?: string; validate?: (s: any) => boolean; storage?: "session" | "local" }): T | null;
export declare function saveDraft(key: string, state: unknown, opts?: { schema?: string; storage?: "session" | "local" }): boolean;
export declare function draftSaver(key: string, opts?: { schema?: string; storage?: "session" | "local"; wait?: number }): ((state: unknown) => void) & { flush(): void };
export declare function quarantineDraft(key: string, storage?: "session" | "local"): void;
export declare function markDraftCrashed(key: string, storage?: "session" | "local"): void;
export declare function clearDraftCrashMark(key: string, storage?: "session" | "local"): void;
export declare function showRecoverySurface(opts?: { title?: string; body?: string; actions?: { label: string; onClick?: () => void; primary?: boolean }[] }): HTMLElement | null;

// ---- envelope ----
export type Step = "extract" | "sensory" | "predict_fit" | "interpret" | "adapt";
export declare const ENVELOPE_VERSION: string;
export declare const STEPS: readonly Step[];
export declare const STEP_LABELS: Readonly<Record<Step, string>>;
export declare const NEXT_ACTION: Readonly<Record<Step, string>>;
export declare const ARTIFACT_SLOTS: Readonly<Record<string, { kind: string; status: string; evidence?: string }>>;
export declare const PROVENANCE_MODES: readonly string[];
export interface ArtifactRef { sha256: string; kind?: string; version?: string | null; provenance_mode: string; producer?: string; ref?: string; by?: string; [k: string]: unknown }
export interface Envelope {
  envelope: string; workflow_id: string; workflow_type: string; created_at: string; updated_at: string;
  origin: { tool: string; version: string | null; entry: string | null };
  current_step: Step; completed_steps: Step[]; skipped_steps: Step[]; source: any;
  artifacts: Record<string, (ArtifactRef & { attached_at: string }) | null>;
  extensions: Record<string, ArtifactRef & { attached_at: string }>;
  provenance: { slot: string; mode: string; at: string; by: string | null }[];
  versions: Record<string, string>;
}
export declare function newWorkflowId(rand?: (n: number) => Uint8Array): string;
export declare function createEnvelope(opts?: { type?: string; origin?: { tool?: string; version?: string; entry?: string }; now?: string; id?: string }): Envelope;
export declare function attachArtifact(env: Envelope, slot: string, ref: ArtifactRef, now?: string): Envelope;
export declare function completeStep(env: Envelope, step: Step, opts?: { skipped?: boolean; now?: string }): Envelope;
export declare function resumePoint(env: Envelope | null): { step: Step; label: string; done: boolean };
export declare function checkEnvelope(obj: unknown): { ok: boolean; reason?: string; unsupported?: boolean };

// ---- telemetry ----
export declare const TELEMETRY_SCHEMA: string;
export declare const EVENTS: Readonly<Record<string, readonly string[]>>;
export interface Telemetry {
  track(event: string, opts?: { step?: string | null; provenance_mode?: string | null; duration_ms?: number | null; detail?: Record<string, unknown> }): any;
  buffer(): any[]; clear(): void; setEnabled(v: boolean): void; readonly enabled: boolean;
}
export declare function createTelemetry(opts?: { tool?: string; version?: string; endpoint?: string; getWorkflowId?: () => string | null; bufferKey?: string; cap?: number; enabled?: boolean; persist?: boolean }): Telemetry;
export declare function validateTelemetryEvent(evt: unknown): { ok: boolean; reason?: string; event?: any };

// ---- studios bar ----
export declare const AJX_STUDIOS_URL_DEFAULT: string;
export declare function studiosUrl(): string;
export interface ClassicTool { id: string; group: string; name: string; url: string; does: string; reads: string; writes: string; step: Step | null; status: "live" | "source-pending"; note?: string }
export declare const CLASSIC_TOOLS: readonly ClassicTool[];
export declare const STEP_COLORS: Readonly<Record<Step, string>>;
export declare function mountStudiosBar(opts?: { tool?: string; toolId?: string; step?: Step }): HTMLElement | null;
