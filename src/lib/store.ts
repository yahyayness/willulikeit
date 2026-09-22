// Local-first store. One interface, swappable implementation (TT-P pattern):
// today localStorage (with in-memory fallback when storage is unavailable);
// a consented pseudonymous backend can slot in later behind the same API.
// Predictions and outcomes are APPEND-ONLY.

import type { FitResult, Outcome, UserProfile } from "./types";

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

export function browserKV(): KV {
  const mem = memoryKV();
  const ok = (() => {
    try {
      const t = "__wulit_probe__";
      window.localStorage.setItem(t, "1");
      window.localStorage.removeItem(t);
      return true;
    } catch {
      return false;
    }
  })();
  if (!ok) return mem;
  return {
    get: (k) => {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return mem.get(k);
      }
    },
    set: (k, v) => {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        mem.set(k, v);
      }
    },
    remove: (k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        mem.remove(k);
      }
    }
  };
}

const K = {
  profiles: "wulit.v1.profiles",
  predictions: "wulit.v1.predictions",
  outcomes: "wulit.v1.outcomes",
  activeProfile: "wulit.v1.activeProfile"
};

export class WulitStore {
  constructor(private kv: KV) {}

  private read<T>(key: string, fallback: T): T {
    const raw = this.kv.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  private write(key: string, v: unknown) {
    this.kv.set(key, JSON.stringify(v));
  }

  profiles(): UserProfile[] {
    return this.read<UserProfile[]>(K.profiles, []);
  }
  profile(id: string): UserProfile | undefined {
    return this.profiles().find((p) => p.id === id);
  }
  /** Saves a profile. If preferences changed, the previous version is archived and version++. */
  saveProfile(next: UserProfile, note?: string): UserProfile {
    const all = this.profiles();
    const i = all.findIndex((p) => p.id === next.id);
    const now = new Date().toISOString();
    if (i < 0) {
      const created = { ...next, version: next.version || 1, createdAt: next.createdAt || now, updatedAt: now, history: next.history ?? [] };
      this.write(K.profiles, [...all, created]);
      return created;
    }
    const prev = all[i];
    const changed = JSON.stringify(sortPrefs(prev.preferences)) !== JSON.stringify(sortPrefs(next.preferences));
    const saved: UserProfile = changed
      ? {
          ...next,
          version: prev.version + 1,
          updatedAt: now,
          history: [...(prev.history ?? []), { version: prev.version, savedAt: prev.updatedAt, preferences: prev.preferences, note }]
        }
      : { ...next, version: prev.version, updatedAt: now, history: prev.history ?? [] };
    all[i] = saved;
    this.write(K.profiles, all);
    return saved;
  }
  deleteProfile(id: string) {
    this.write(K.profiles, this.profiles().filter((p) => p.id !== id));
  }
  activeProfileId(): string | null {
    return this.kv.get(K.activeProfile);
  }
  setActiveProfileId(id: string) {
    this.kv.set(K.activeProfile, id);
  }

  predictions(): FitResult[] {
    return this.read<FitResult[]>(K.predictions, []);
  }
  prediction(id: string): FitResult | undefined {
    return this.predictions().find((p) => p.id === id);
  }
  addPredictions(list: FitResult[]) {
    const all = this.predictions();
    const ids = new Set(all.map((p) => p.id));
    for (const p of list) {
      if (ids.has(p.id)) throw new Error(`Prediction ${p.id} already exists — frozen predictions are never overwritten.`);
    }
    this.write(K.predictions, [...all, ...list]);
  }

  outcomes(): Outcome[] {
    return this.read<Outcome[]>(K.outcomes, []);
  }
  outcomesFor(fitId: string): Outcome[] {
    return this.outcomes().filter((o) => o.fitResultId === fitId);
  }
  addOutcome(o: Outcome) {
    if (!this.prediction(o.fitResultId)) throw new Error("Outcome refers to an unknown prediction.");
    this.write(K.outcomes, [...this.outcomes(), o]);
  }

  clearAll() {
    Object.values(K).forEach((k) => this.kv.remove(k));
  }

  /** Merge an import — never overwrites existing predictions/outcomes. */
  importData(data: { profiles?: UserProfile[]; predictions?: FitResult[]; outcomes?: Outcome[] }) {
    const counts = { profiles: 0, predictions: 0, outcomes: 0 };
    const profs = this.profiles();
    for (const p of data.profiles ?? []) {
      if (!profs.some((x) => x.id === p.id)) {
        profs.push(p);
        counts.profiles++;
      }
    }
    this.write(K.profiles, profs);
    const preds = this.predictions();
    for (const p of data.predictions ?? []) {
      if (!preds.some((x) => x.id === p.id)) {
        preds.push(p);
        counts.predictions++;
      }
    }
    this.write(K.predictions, preds);
    const outs = this.outcomes();
    for (const o of data.outcomes ?? []) {
      if (!outs.some((x) => x.id === o.id)) {
        outs.push(o);
        counts.outcomes++;
      }
    }
    this.write(K.outcomes, outs);
    return counts;
  }
}

function sortPrefs(p: UserProfile["preferences"]) {
  return [...p].sort((a, b) => a.attribute.localeCompare(b.attribute)).map((x) => [x.attribute, x.ideal, x.importance, x.source]);
}
