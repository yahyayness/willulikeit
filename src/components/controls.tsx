import React, { useEffect, useRef, useState } from "react";
import { applyPickerAccept, MAX_BYTES_DEFAULT } from "../vendor/ajx-core/index.js";
import { ATTR_BY_ID, DIM_HEX } from "../lib/vocab";
import type { SensoryKind, UserPreference } from "../lib/types";

// ---------------- TT-P 9-point hedonic band ----------------
export const HEDONIC_LABELS = [
  "Dislike extremely",
  "Dislike very much",
  "Dislike moderately",
  "Dislike slightly",
  "Neither like nor dislike",
  "Like slightly",
  "Like moderately",
  "Like very much",
  "Like extremely"
];
const HUES = ["#a33b2e", "#b4502c", "#bd6a2a", "#c2872b", "#a89a6a", "#7f9a45", "#5f9140", "#43853f", "#2f7a52"];

export function HedonicBand({ value, onChange, compact, label }: { value?: number; onChange: (v: number) => void; compact?: boolean; label?: string }) {
  return (
    <div>
      <div className={`hedonic${compact ? " compact" : ""}`} role="radiogroup" aria-label={label ?? "9-point hedonic scale"}>
        {HEDONIC_LABELS.map((l, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i + 1}
            aria-pressed={value === i + 1}
            aria-label={`${i + 1} — ${l}`}
            title={l}
            style={{ ["--hval" as any]: HUES[i] }}
            onClick={() => onChange(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {!compact && (
        <>
          <div className="hedonic-ends">
            <span>dislike extremely</span>
            <span>like extremely</span>
          </div>
          <div className="hedonic-label" style={{ color: value ? HUES[value - 1] : undefined }}>
            {value ? HEDONIC_LABELS[value - 1] : " "}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- preference slider (0–10, skip ≠ neutral) ----------------
const IMP = [
  { v: 0, t: "doesn't matter" },
  { v: 1, t: "a little" },
  { v: 2, t: "matters" },
  { v: 3, t: "a lot" }
];

export function PrefSlider({
  attribute,
  pref,
  onChange
}: {
  attribute: string;
  pref?: UserPreference;
  onChange: (p: UserPreference | null) => void;
}) {
  const def = ATTR_BY_ID[attribute];
  const hex = DIM_HEX[def.dim];
  const set = !!pref;
  const v = pref?.ideal ?? 5;
  return (
    <div className={`pref${set ? "" : " skipped-soft"}`}>
      <div className="pref-head">
        <span className="q">{def.question}</span>
        <span className="dimtag" style={{ color: hex }}>
          {def.dim}
        </span>
      </div>
      <div className="slider-wrap" style={{ opacity: set ? 1 : 0.55 }}>
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={v}
          aria-label={`${def.label} — your ideal, 0 to 10`}
          style={{ ["--c" as any]: set ? hex : "#b9b1a0" }}
          onChange={(e) => onChange({ attribute, ideal: Number(e.target.value), importance: pref?.importance ?? 2, source: pref?.source === "anchor_rating" ? "explicit_slider" : pref?.source ?? "explicit_slider" })}
          onPointerDown={() => {
            if (!set) onChange({ attribute, ideal: v, importance: 2, source: "explicit_slider" });
          }}
        />
        <output>{set ? v : "—"}</output>
      </div>
      <div className="ends">
        <span>{def.low}</span>
        <span>{def.high}</span>
      </div>
      {set ? (
        <div className="imp">
          <span className="tiny">importance</span>
          {IMP.map((i) => (
            <button key={i.v} type="button" aria-pressed={pref!.importance === i.v} onClick={() => onChange({ ...pref!, importance: i.v })}>
              {i.t}
            </button>
          ))}
          {pref!.source === "anchor_rating" && <span className="badge stated" title="Derived from your chocolate anchor ratings">from anchors</span>}
          <button type="button" className="skipbtn" style={{ marginLeft: "auto" }} onClick={() => onChange(null)}>
            skip — I don't know
          </button>
        </div>
      ) : (
        <div className="imp">
          <span className="tiny">not set — skipped attributes are left out, never treated as neutral.</span>
          <button type="button" className="skipbtn" onClick={() => onChange({ attribute, ideal: 5, importance: 2, source: "explicit_slider" })}>
            set it
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------- file drop zone (nothing uploaded anywhere) ----------------
export function DropZone({ accept, title, hint, onText }: { accept: string; title: string; hint: string; onText: (text: string, name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  // Gate 2: on touch devices `accept` is removed so native .jrf/.mp6 are selectable
  // (Android/iOS pickers grey out unregistered extensions). Content is validated by the parsers.
  const expect = /mp6/.test(accept) ? "mp6" : /jrf/.test(accept) ? "jrf" : "any";
  useEffect(() => { applyPickerAccept(ref.current, expect as "mp6" | "jrf" | "any"); }, [expect]);
  const read = (f?: File | null) => {
    if (!f) return;
    setReadErr(null);
    if (f.size > MAX_BYTES_DEFAULT) { setReadErr("This file is too large for an AJX artifact (max 10 MB)."); return; }
    f.text().then(
      (t) => onText(t, f.name),
      () => setReadErr("The file could not be read from this device. Try downloading it again, or choose another file.")
    );
  };
  return (
    <div
      className={`drop${over ? " over" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        read(e.dataTransfer.files?.[0]);
      }}
    >
      <b>{title}</b>
      <span>{hint}</span>
      {readErr && <span role="alert" style={{ color: "var(--warn)" }}>{readErr}</span>}
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

// ---------------- evidence badges ----------------
export function KindBadge({ kind }: { kind: SensoryKind }) {
  const m: Record<SensoryKind, [string, string, string]> = {
    expected: ["sim", "Expected MP6 · simulated", "A prediction of the sensory state (MP6-SIM) — not a measurement"],
    observed: ["obs", "Observed MP6", "Recorded by a person after tasting (MP6-OBS)"],
    proxy: ["proxy", "Ingredient proxy", "Crude mean of ingredient-level data in the JRF — not an Expected MP6"],
    unknown: ["unk", "MP6 · status unknown", "The file does not say whether it is predicted or observed"]
  };
  const [cls, t, title] = m[kind];
  return (
    <span className={`badge ${cls}`} title={title}>
      {t}
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label className="lbl">{label}</label>
      {children}
      {hint && <div className="tiny" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
