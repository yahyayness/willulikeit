// Acceptance tests — thread brief §20 (numbered to match).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeFit, likingIndex } from "../src/lib/fit";
import { parseMp6 } from "../src/lib/mp6";
import { parseJrf, ingredientProxy } from "../src/lib/jrf";
import { freezePrediction, buildOutcome } from "../src/lib/predict";
import { WulitStore, memoryKV } from "../src/lib/store";
import { buildExport, parseImport } from "../src/lib/evidence";
import { buildBrief } from "../src/lib/brief";
import { deriveFromAnchors, CHOCOLATE_ANCHORS } from "../src/lib/anchors";
import type { SensoryProfile, UserPreference, UserProfile } from "../src/lib/types";
import { sha256 } from "../src/lib/hash";

const S = (f: string) => readFileSync(join(__dirname, "../public/samples", f), "utf8");
const pref = (attribute: string, ideal: number, importance = 2): UserPreference => ({ attribute, ideal, importance, source: "explicit_slider" });
const sens = (v: Record<string, number>): Pick<SensoryProfile, "values"> => ({
  values: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { value: x, source_attribute: k }]))
});

// Demo user and Expected MP6 from brief §21
const demoPrefs = [pref("sweetness", 3), pref("bitterness", 8), pref("roasted", 8), pref("sourness", 4), pref("creaminess", 5), pref("aftertaste_length", 8)];
const demoMp6 = sens({ sweetness: 4, bitterness: 7, roasted: 8, sourness: 5, creaminess: 4, aftertaste_length: 8 });

const profile = (prefs: UserPreference[], extra: Partial<UserProfile> = {}): UserProfile => ({
  id: "prof_test",
  name: "Tester",
  relation: "self",
  version: 1,
  createdAt: "2026-09-23T00:00:00Z",
  updatedAt: "2026-09-23T00:00:00Z",
  preferences: prefs,
  history: [],
  ...extra
});

describe("wulit-fit-v0.1", () => {
  test("§21 demo produces an interpretable high fit", () => {
    const r = computeFit(demoPrefs, demoMp6);
    expect(r.fit).toBeCloseTo(93.3, 1);
    expect(r.band).toBe("strong");
    expect(r.coverage).toBe(1);
  });

  test("1 · same profile + same MP6 → same fit result", () => {
    expect(computeFit(demoPrefs, demoMp6)).toEqual(computeFit(demoPrefs, demoMp6));
  });

  test("2 · missing attributes do not become zero", () => {
    const prefs = [pref("sweetness", 3), pref("saltiness", 9)];
    const r = computeFit(prefs, sens({ sweetness: 3 }));
    expect(r.fit).toBe(100); // salt is absent → excluded, not compared against 0
    expect(r.notDescribed).toEqual(["saltiness"]);
    expect(r.coverage).toBe(0.5);
    // an explicit 0 IS a value
    const r0 = computeFit(prefs, sens({ sweetness: 3, saltiness: 0 }));
    expect(r0.fit).toBeLessThan(100);
  });

  test("3 · a perfect attribute match yields maximal contribution", () => {
    const r = computeFit([pref("bitterness", 7)], sens({ bitterness: 7 }));
    expect(r.fit).toBe(100);
    expect(r.matches[0].abs).toBe(0);
  });

  test("4 · larger weighted mismatch lowers fit", () => {
    const a = computeFit([pref("sweetness", 3)], sens({ sweetness: 5 })).fit!;
    const b = computeFit([pref("sweetness", 3)], sens({ sweetness: 8 })).fit!;
    expect(b).toBeLessThan(a);
    const light = computeFit([pref("sweetness", 3, 1), pref("roasted", 8, 3)], sens({ sweetness: 9, roasted: 8 })).fit!;
    const heavy = computeFit([pref("sweetness", 3, 3), pref("roasted", 8, 1)], sens({ sweetness: 9, roasted: 8 })).fit!;
    expect(heavy).toBeLessThan(light);
  });

  test("5 · importance = 0 removes an attribute from effective contribution", () => {
    const base = computeFit([pref("roasted", 8)], sens({ roasted: 8, sweetness: 10 }));
    const withZero = computeFit([pref("roasted", 8), pref("sweetness", 0, 0)], sens({ roasted: 8, sweetness: 10 }));
    expect(withZero.fit).toBe(base.fit);
    expect(withZero.excludedZeroImportance).toEqual(["sweetness"]);
    expect(withZero.coverage).toBe(1);
  });

  test("6 · coverage is |C| / |active preferences|", () => {
    const r = computeFit([pref("a1", 1), pref("sweetness", 3), pref("bitterness", 5), pref("roasted", 5, 0)], sens({ sweetness: 3, roasted: 2 }));
    expect(r.coverage).toBeCloseTo(1 / 3, 2);
  });

  test("no overlap → no number, not zero", () => {
    const r = computeFit([pref("umami", 5)], sens({ sweetness: 3 }));
    expect(r.fit).toBeNull();
    expect(r.band).toBe("none");
  });
});

describe("freeze & outcome", () => {
  test("7/8 · frozen fit cannot mutate; actual liking stored separately", async () => {
    const mp6 = parseMp6(S("dark-chocolate-70.expected.mp6"), "d70.mp6");
    const sp = { ...mp6.profile!, sourceHash: await sha256(S("dark-chocolate-70.expected.mp6")) };
    const fit = await freezePrediction({ profile: profile(demoPrefs), sensory: sp });
    const before = JSON.stringify(fit);
    expect(Object.isFrozen(fit)).toBe(true);
    expect(() => {
      (fit as any).fit = 1;
    }).toThrow();
    const store = new WulitStore(memoryKV());
    store.addPredictions([fit]);
    const out = buildOutcome({ fit, hedonic: 8, sensoryMatch: "partly" });
    store.addOutcome(out);
    expect(JSON.stringify(store.prediction(fit.id))).toBe(before);
    expect(store.outcomesFor(fit.id)[0].hedonic).toBe(8);
    expect(out.likingIndex).toBe(87.5);
    expect(out.fitLikingGap).toBeCloseTo(87.5 - fit.fit!, 1);
    expect(fit.fitResultHash).toMatch(/^[0-9a-f]{64}$/);
    expect(() => store.addPredictions([fit])).toThrow(/never overwritten/);
  });

  test("observed MP6 → separate sensory agreement + post-hoc fit, prediction untouched", async () => {
    const exp = parseMp6(S("dark-chocolate-70.expected.mp6")).profile!;
    const obs = parseMp6(S("dark-chocolate-70.observed-demo.mp6")).profile!;
    expect(exp.kind).toBe("expected");
    expect(obs.kind).toBe("observed");
    const fit = await freezePrediction({ profile: profile(demoPrefs), sensory: exp });
    const out = buildOutcome({ fit, hedonic: 6, observed: { profile: obs, hash: "abc" } });
    expect(out.observed!.agreement!.n).toBeGreaterThan(3);
    expect(out.observed!.posthocFit).not.toBe(fit.fit);
    expect(fit.fit).toBe(computeFit(demoPrefs, exp).fit);
  });

  test("hedonic scale is enforced", () => {
    expect(() => likingIndex(0)).toThrow();
    expect(() => likingIndex(10)).toThrow();
    expect(likingIndex(1)).toBe(0);
    expect(likingIndex(9)).toBe(100);
  });
});

describe("FEELLLM brief", () => {
  test("9 · brief carries provenance and labels simulation vs observation; deterministic", async () => {
    const exp = { ...parseMp6(S("gianduja-v1.1.0.expected.mp6"), "g.mp6").profile!, sourceHash: "h-mp6" };
    const jrf = { ...parseJrf(S("gianduja-v1.1.0.jrf"), "g.jrf").summary!, sourceHash: "h-jrf" };
    const fit = await freezePrediction({ profile: profile(demoPrefs), sensory: exp, jrf, id: "fit_x", batchId: "b", now: "2026-09-23T10:00:00Z" });
    const b1 = buildBrief({ fits: [fit], jrf, question: "modify" });
    const b2 = buildBrief({ fits: [fit], jrf, question: "modify" });
    expect(b1).toBe(b2);
    expect(b1).toContain("simulated");
    expect(b1).toContain("not a probability");
    expect(b1).toContain('"expected_mp6_hash": "h-mp6"');
    expect(b1).toContain('"jrf_hash": "h-jrf"');
    expect(b1).toContain("wulit-fit-v0.1");
    expect(b1).toMatch(/Do \*\*not\*\* produce your own liking score/);
    expect(b1).toContain("Piedmont IGP hazelnuts");
  });
});

describe("export / import", () => {
  test("10 · round-trip preserves profile, fit, outcome", async () => {
    const store = new WulitStore(memoryKV());
    const p = store.saveProfile(profile(demoPrefs));
    const fit = await freezePrediction({ profile: p, sensory: parseMp6(S("dark-chocolate-70.expected.mp6")).profile! });
    store.addPredictions([fit]);
    store.addOutcome(buildOutcome({ fit, hedonic: 7 }));
    const text = JSON.stringify(buildExport(store.profiles(), store.predictions(), store.outcomes()));
    const parsed = parseImport(text);
    expect(parsed.ok).toBe(true);
    const fresh = new WulitStore(memoryKV());
    if (parsed.ok) fresh.importData(parsed.data);
    expect(fresh.profiles()).toEqual(store.profiles());
    expect(fresh.predictions()).toEqual(JSON.parse(JSON.stringify(store.predictions())));
    expect(fresh.outcomes()).toEqual(JSON.parse(JSON.stringify(store.outcomes())));
    const ev = buildExport(store.profiles(), store.predictions(), store.outcomes()).events[0];
    expect(ev.event_type).toBe("personal_fit_evaluation");
    expect(ev.actual_liking).toBe(7);
    expect(ev.evidence_classes).toEqual(["stated_preference", "predicted_personal_fit", "actual_liking"]);
  });

  test("profile versioning archives the previous version", () => {
    const store = new WulitStore(memoryKV());
    const p1 = store.saveProfile(profile(demoPrefs));
    const p2 = store.saveProfile({ ...p1, preferences: [...p1.preferences, pref("nutty", 6)] });
    expect(p2.version).toBe(2);
    expect(p2.history[0].version).toBe(1);
    const p3 = store.saveProfile({ ...p2, name: "Renamed" });
    expect(p3.version).toBe(2);
  });
});

describe("11–14 · no backend, one user, no LLM, clear failures", () => {
  test("12/13 · works for one user and one item, synchronously, without any LLM", () => {
    const r = computeFit([pref("sweetness", 5)], sens({ sweetness: 5 }));
    expect(r.fit).toBe(100);
  });

  test("14 · invalid MP6/JRF fails clearly without silent repair", () => {
    expect(parseMp6("{not json").ok).toBe(false);
    expect(parseMp6('{"hello":1}').error).toMatch(/Not an MP6/);
    expect(parseMp6(S("gianduja-v1.1.0.jrf")).error).toMatch(/JRF/);
    expect(parseJrf(S("dark-chocolate-70.expected.mp6")).error).toMatch(/MP6/);
    expect(parseJrf('{"a":1}').ok).toBe(false);
    const empty = parseMp6(JSON.stringify({ magic: "AJX-MP6", evaluations: [{ id: "e", scores: { taste: { sweetness: null } } }] }));
    expect(empty.ok).toBe(false);
  });
});

describe("real ecosystem files", () => {
  test("Elixir of Invincibility AJNV4.3 MP6 parses as expected/synthetic with canonical aliasing", () => {
    const r = parseMp6(S("elixir-of-invincibility-v1.1.0.expected.mp6"));
    expect(r.ok).toBe(true);
    const p = r.profile!;
    expect(p.kind).toBe("expected");
    expect(p.synthetic).toBe(true);
    expect(p.values.sweetness.value).toBe(5);
    expect(p.values.spicy.value).toBe(8);
    // touch.body is canonical; taste.body_richness preserved as unmapped alias
    expect(p.values.body.source_attribute).toBe("body");
    expect(p.unmapped.some((u) => u.attribute === "body_richness")).toBe(true);
    expect(p.values.dairy).toBeUndefined();
  });

  test("Sanitized public Elixir JRF reads identity and process without internal dependency data", () => {
    const j = parseJrf(S("elixir-of-invincibility-v1.1.0.jrf"));
    expect(j.ok).toBe(true);
    expect(j.summary!.version).toBe("1.1.0");
    expect(j.summary!.ingredients.map((i) => i.label)).toContain("ginger");
    expect(j.summary!.processes.find((p) => p.label === "Ferment")!.duration_s).toBe(432000);
    expect(j.ingredientSensory).toEqual([]);
    expect(ingredientProxy(j)).toBeNull();
  });
});

describe("anchors", () => {
  test("derive only from liked anchors; nothing liked → nothing derived", () => {
    expect(deriveFromAnchors({ milk: 3, d100: 2 })).toEqual([]);
    const d = deriveFromAnchors({ d85: 9, milk: 1 });
    const sweet = d.find((x) => x.attribute === "sweetness")!;
    expect(sweet.ideal).toBe(CHOCOLATE_ANCHORS.find((a) => a.id === "d85")!.profile.sweetness);
    expect(sweet.importance).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// AJX Studios Gate 2 — MP6 interoperability regressions (AJX-P0-009)
// ---------------------------------------------------------------------------
describe("Gate 2 · MP6 dialect interoperability", () => {
  const A = (f: string) => readFileSync(join(__dirname, "fixtures/ajx", f), "utf8");
  const golden = JSON.parse(A("parse-golden-pre-gate2.json")) as Record<string, any>;

  test("C · current Recorder Observed MP6 (nested results map) is readable in After tasting", () => {
    const r = parseMp6(A("recorder-v0222-observed.mp6"), "obs.mp6");
    expect(r.ok).toBe(true);
    expect(r.profile!.kind).toBe("observed");
    expect(r.profile!.values.creaminess.value).toBe(9.4);
    expect(r.profile!.values.sweetness.value).toBe(6.5);
  });

  test("D · Expected MP6 (current Recorder) still enters Predict as simulated", () => {
    const r = parseMp6(A("recorder-v0222-expected.mp6"), "exp.mp6");
    expect(r.ok).toBe(true);
    expect(r.profile!.kind).toBe("expected");
  });

  test("files that already worked parse IDENTICALLY to the pre-Gate-2 reader (frozen fits unaffected)", () => {
    for (const [key, before] of Object.entries(golden)) {
      if (!before.ok) continue; // only the previously-broken current Observed may change
      const dir = key.startsWith("../public") ? "../public/samples" : "fixtures/ajx";
      const f = key.split("/").pop()!;
      const after = parseMp6(readFileSync(join(__dirname, dir, f), "utf8"), f);
      expect(JSON.parse(JSON.stringify(after)), key).toEqual(before);
    }
  });

  test("Observed MP6 is never usable as a prediction; the rejected sound proposal is not in the observed profile", () => {
    const r = parseMp6(A("legacy-recorder-v022-observed-results-array.mp6"), "pathb.mp6");
    expect(r.profile!.kind).toBe("observed");
    expect(Object.values(r.profile!.values).some((v) => v.source_dimension === "sound")).toBe(false);
  });
});
