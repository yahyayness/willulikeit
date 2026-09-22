import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { WulitStore, browserKV } from "./lib/store";
import { parseMp6, type Mp6ParseResult } from "./lib/mp6";
import { parseJrf, type JrfParseResult } from "./lib/jrf";
import { sha256, uid } from "./lib/hash";
import type { UserPreference, UserProfile } from "./lib/types";

export const store = new WulitStore(browserKV());

// ---------------- hash router ----------------
export function useRoute(): string[] {
  const read = () => (window.location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => {
      setR(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}
export const go = (path: string) => {
  window.location.hash = path.startsWith("#") ? path : `#/${path.replace(/^\//, "")}`;
};

// ---------------- item draft (sessionStorage: dies with the tab) ----------------
export interface LoadedMp6 {
  text: string;
  fileName: string;
  hash: string;
  evaluationIndex: number;
  parse: Mp6ParseResult;
}
export interface LoadedJrf {
  text: string;
  fileName: string;
  hash: string;
  parse: JrfParseResult;
}
export interface Draft {
  mp6?: LoadedMp6;
  jrf?: LoadedJrf;
  useProxy: boolean;
  selected: string[];
  occasion: string;
  note: string;
}
const DRAFT_KEY = "wulit.v1.draft";
const emptyDraft: Draft = { useProxy: false, selected: [], occasion: "", note: "" };

function loadDraft(): Draft {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft;
    const d = JSON.parse(raw) as Draft;
    // re-parse from exact text so parser upgrades apply and nothing stale lingers
    if (d.mp6) d.mp6.parse = parseMp6(d.mp6.text, d.mp6.fileName, d.mp6.evaluationIndex);
    if (d.jrf) d.jrf.parse = parseJrf(d.jrf.text, d.jrf.fileName);
    return { ...emptyDraft, ...d };
  } catch {
    return emptyDraft;
  }
}
function saveDraft(d: Draft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable — draft lives in memory only */
  }
}

export async function loadMp6Text(text: string, fileName: string, evaluationIndex = 0): Promise<LoadedMp6> {
  return { text, fileName, hash: await sha256(text), evaluationIndex, parse: parseMp6(text, fileName, evaluationIndex) };
}
export async function loadJrfText(text: string, fileName: string): Promise<LoadedJrf> {
  return { text, fileName, hash: await sha256(text), parse: parseJrf(text, fileName) };
}
export async function fetchSample(path: string): Promise<string> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Could not load sample ${path}`);
  return r.text();
}

// ---------------- context ----------------
interface Ctx {
  tick: number;
  refresh: () => void;
  toast: (msg: React.ReactNode) => void;
  draft: Draft;
  setDraft: (u: Partial<Draft> | ((d: Draft) => Draft)) => void;
}
const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState<React.ReactNode>(null);
  const [draft, setDraftState] = useState<Draft>(loadDraft);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const toast = useCallback((m: React.ReactNode) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2600);
  }, []);
  const setDraft = useCallback((u: Partial<Draft> | ((d: Draft) => Draft)) => {
    setDraftState((d) => {
      const next = typeof u === "function" ? u(d) : { ...d, ...u };
      saveDraft(next);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ tick, refresh, toast, draft, setDraft }), [tick, refresh, toast, draft, setDraft]);
  return (
    <AppCtx.Provider value={value}>
      {children}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </AppCtx.Provider>
  );
}
export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("AppProvider missing");
  return c;
}

// ---------------- profiles ----------------
export function newProfile(name: string, relation: UserProfile["relation"], preferences: UserPreference[] = []): UserProfile {
  const now = new Date().toISOString();
  return { id: uid("prof"), name, relation, version: 1, createdAt: now, updatedAt: now, preferences, history: [] };
}

/** Demo taster from thread brief §21 — clearly flagged as demo. */
export function ensureDemoProfile(): UserProfile {
  const existing = store.profiles().find((p) => p.demo);
  if (existing) return existing;
  const s = (attribute: string, ideal: number): UserPreference => ({ attribute, ideal, importance: 2, source: "explicit_slider" });
  const p = newProfile("Demo taster", "self", [s("sweetness", 3), s("bitterness", 8), s("roasted", 8), s("sourness", 4), s("creaminess", 5), s("aftertaste_length", 8)]);
  p.demo = true;
  return store.saveProfile(p);
}

export function downloadText(name: string, text: string, type = "text/markdown") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
