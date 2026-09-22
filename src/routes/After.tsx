import { useState } from "react";
import { store, useApp, loadMp6Text, fetchSample, type LoadedMp6 } from "../state";
import { buildOutcome } from "../lib/predict";
import { HedonicBand, DropZone, KindBadge, Field, HEDONIC_LABELS } from "../components/controls";
import { attrLabel } from "../lib/vocab";
import { SAMPLES } from "../actions";
import { FLOTILLA } from "../versions";
import type { Outcome } from "../lib/types";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function After({ fitId }: { fitId?: string }) {
  const { tick, refresh, toast } = useApp();
  void tick;
  const fit = fitId ? store.prediction(fitId) : undefined;
  const outcomes = fitId ? store.outcomesFor(fitId) : [];
  const [hedonic, setHedonic] = useState<number>();
  const [match, setMatch] = useState<Outcome["sensoryMatch"]>();
  const [diff, setDiff] = useState("");
  const [notes, setNotes] = useState("");
  const [obs, setObs] = useState<LoadedMp6>();
  const [again, setAgain] = useState(false);

  if (!fit)
    return (
      <section className="block">
        <h2>Prediction not found.</h2>
        <a className="btn" href="#/log">
          Open the log
        </a>
      </section>
    );

  const latest = outcomes[outcomes.length - 1];
  const showForm = !latest || again;
  const who = fit.profileRelation === "self" ? "you" : fit.profileName;
  const obsOk = obs?.parse.ok ? obs.parse.profile! : undefined;

  const save = () => {
    if (!hedonic) return;
    const o = buildOutcome({ fit, hedonic, sensoryMatch: match, mostDifferent: diff || undefined, notes, observed: obsOk ? { profile: obsOk, hash: obs!.hash } : undefined });
    store.addOutcome(o);
    setAgain(false);
    setHedonic(undefined);
    setObs(undefined);
    refresh();
    toast(<span>Outcome recorded · the prediction stays <b>frozen</b></span>);
  };

  return (
    <>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <p className="eyebrow">Step 3 · after tasting</p>
        <h2>
          Did {who} like {fit.item.name}?
        </h2>
        <p className="lede" style={{ fontSize: 16 }}>
          The prediction below was frozen on {new Date(fit.createdAt).toLocaleString()}. Your answer is stored beside it, never over it — misses are kept, because they are evidence the next explicitly versioned learner can learn from.
        </p>
      </section>

      <section className="block">
        <div className="card spread">
          <div>
            <div className="tiny mono">🔒 FROZEN PREDICTION · {fit.algorithmVersion}</div>
            <div style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 700 }}>{fit.fit === null ? "—" : Math.round(fit.fit)} / 100</div>
            <div className="small">
              for {fit.profileName} · coverage {Math.round(fit.coverage * 100)}%
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <KindBadge kind={fit.item.sensoryKind} />
            {fit.item.synthetic && <span className="badge syn">synthetic</span>}
            <a className="btn sm ghost" href={`#/r/${fit.batchId}/${fit.id}`}>
              view
            </a>
          </div>
        </div>
      </section>

      {latest && !again && <OutcomeView fitScore={fit.fit} o={latest} count={outcomes.length} onAgain={() => setAgain(true)} />}

      {showForm && (
        <section className="block">
          <div className="card">
            <Field label={`Overall — how much did ${who === "you" ? "you" : who} like it?`}>
              <HedonicBand value={hedonic} onChange={setHedonic} />
            </Field>
            <Field label="Did the predicted sensory description match what was tasted?" hint="Sensory agreement and liking are separate questions — a prediction can be right about the taste and wrong about the liking.">
              <div className="row">
                {(["yes", "partly", "no"] as const).map((m) => (
                  <button key={m} className="chip" aria-pressed={match === m} onClick={() => setMatch(match === m ? undefined : m)}>
                    {m}
                  </button>
                ))}
              </div>
            </Field>
            {match && match !== "yes" && (
              <Field label="What was most different? (optional)">
                <select value={diff} onChange={(e) => setDiff(e.target.value)}>
                  <option value="">—</option>
                  {Object.keys(fit.sensorySnapshot).map((k) => (
                    <option key={k} value={k}>
                      {attrLabel(k)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Anything else? (optional)">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Say it like it is." />
            </Field>
            <Field label="Observed MP6 (optional)" hint="Record the tasting at record.mp6.app and drop the file here. We'll compare predicted vs observed sensory state — separately from liking.">
              {obs ? (
                <div className="drop loaded">
                  <div className="spread">
                    <b style={{ fontSize: 15 }}>{obs.parse.ok ? obs.parse.profile!.itemName : obs.fileName}</b>
                    <button className="skipbtn" onClick={() => setObs(undefined)}>
                      remove
                    </button>
                  </div>
                  {obs.parse.ok ? (
                    <div className="row" style={{ gap: 6, marginTop: 6 }}>
                      <KindBadge kind={obs.parse.profile!.kind} />
                      <span className="small">{Object.keys(obs.parse.profile!.values).length} comparable attributes</span>
                    </div>
                  ) : (
                    <div className="small" style={{ color: "var(--warn)" }}>
                      {obs.parse.error}
                    </div>
                  )}
                  {obsOk && obsOk.kind === "expected" && <div className="tiny" style={{ color: "var(--amber)", marginTop: 6 }}>⚠ This file says it is a prediction, not an observation.</div>}
                </div>
              ) : (
                <>
                  <DropZone accept=".mp6,.json" title="Drop the observed .mp6" hint="Read locally — never uploaded." onText={async (t, n) => setObs(await loadMp6Text(t, n))} />
                  <div className="row" style={{ marginTop: 8 }}>
                    <a className="btn sm ghost" href={FLOTILLA.recorder} target="_blank" rel="noreferrer">
                      Record at record.mp6.app ↗
                    </a>
                    {fit.item.id === "dark-chocolate-70" && (
                      <button className="btn sm ghost" onClick={async () => setObs(await loadMp6Text(await fetchSample(SAMPLES.d70Observed), "dark-chocolate-70.observed-demo.mp6"))}>
                        use the demo observed file
                      </button>
                    )}
                  </div>
                </>
              )}
            </Field>
            <div className="row" style={{ marginTop: 18 }}>
              <button className="btn primary big" disabled={!hedonic} onClick={save}>
                Record outcome
              </button>
              {again && (
                <button className="btn ghost" onClick={() => setAgain(false)}>
                  Cancel
                </button>
              )}
              {!hedonic && <span className="small">Pick a number from 1 to 9 first.</span>}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function OutcomeView({ fitScore, o, count, onAgain }: { fitScore: number | null; o: Outcome; count: number; onAgain: () => void }) {
  const gap = Number.isFinite(o.fitLikingGap) ? o.fitLikingGap : null;
  const verdict =
    gap === null ? "No fit was computable, so there is no numeric fit↔liking comparison." : Math.abs(gap) <= 12.5 ? "The two exploratory indices are numerically close." : gap > 0 ? "Your liking index was higher than the fit index." : "Your liking index was lower than the fit index.";
  const ag = o.observed?.agreement;
  let diagnosis: string | null = null;
  if (o.observed && ag && gap !== null && o.observed.posthocFit !== null) {
    const posthocGap = o.likingIndex - o.observed.posthocFit;
    diagnosis =
      Math.abs(posthocGap) < Math.abs(gap) - 5
        ? "The exploratory fit↔liking gap is smaller when fit is recomputed on what was actually tasted; this is a diagnostic clue that sensory forecast differences may matter."
        : Math.abs(posthocGap) > 12.5
          ? "A sizable exploratory gap remains even against the observed sensory profile; more outcomes are needed before attributing the cause."
          : "Expected/observed sensory agreement and liking remain separate questions; this result is diagnostic only.";
  }
  return (
    <section className="block">
      <div className="lantern">
        <p className="eyebrow">Prediction vs outcome{count > 1 ? ` · latest of ${count}` : ""}</p>
        <div className="verdict likely" style={{ color: gap !== null && Math.abs(gap) <= 12.5 ? "var(--fly)" : "#f0c64a" }}>
          {verdict}
        </div>
        <div className="pvso">
          <div>
            <div className="k">predicted fit · frozen</div>
            <div className="v">{fitScore === null ? "—" : Math.round(fitScore)}</div>
            <div className="s">wulit-fit-v0.1, 0–100</div>
          </div>
          <div>
            <div className="k">actual liking</div>
            <div className="v">{o.hedonic}/9</div>
            <div className="s">
              {HEDONIC_LABELS[o.hedonic - 1]} · index {fmt(o.likingIndex)}
            </div>
          </div>
          <div>
            <div className="k">fit ↔ liking gap</div>
            <div className="v">{gap === null ? "—" : `${gap > 0 ? "+" : ""}${fmt(gap)}`}</div>
            <div className="s">liking index − Personal Sensory Fit</div>
          </div>
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>
          Liking index = (hedonic − 1) / 8 × 100. The fit↔liking gap is an exploratory side-by-side comparison only: these two scales are not yet empirically calibrated to one another, so this is not a statistical prediction error.
        </p>
        {o.sensoryMatch && (
          <p className="small" style={{ marginTop: 8 }}>
            Sensory description matched: <b style={{ color: "var(--night-text)" }}>{o.sensoryMatch}</b>
            {o.mostDifferent ? ` · most different: ${attrLabel(o.mostDifferent)}` : ""}
          </p>
        )}
        {o.observed && (
          <div style={{ marginTop: 14 }}>
            <p className="eyebrow">Expected vs observed MP6 — a separate question</p>
            {ag ? (
              <>
                <p className="small">
                  Mean absolute difference on {ag.n} shared attributes: <b style={{ color: "var(--night-text)" }}>{fmt(ag.meanAbsDelta)}</b> / 10. Fit re-scored against the observed profile:{" "}
                  <b style={{ color: "var(--night-text)" }}>{o.observed.posthocFit === null ? "—" : Math.round(o.observed.posthocFit)}</b> (post-hoc, for diagnosis only — the frozen prediction is unchanged).
                </p>
                <div className="deltas" style={{ marginTop: 10 }}>
                  {ag.perAttr.map((p) => (
                    <div className="drow" key={p.attribute}>
                      <div className="lab">
                        <span>{attrLabel(p.attribute)}</span>
                        <span className="w">
                          expected {fmt(p.expected)} · observed {fmt(p.observed)}
                        </span>
                      </div>
                      <div className="dtrack">
                        <div className="base" />
                        <div className="gap" style={{ left: `${Math.min(p.expected, p.observed) * 10}%`, width: `${Math.abs(p.expected - p.observed) * 10}%`, background: "#7fd0db" }} />
                        <div className="item" style={{ left: `${p.expected * 10}%`, background: "#7fd0db" }} title="expected" />
                        <div className="item" style={{ left: `${p.observed * 10}%`, background: "#7fd6a3", border: "2px solid #0f1113" }} title="observed" />
                      </div>
                    </div>
                  ))}
                </div>
                {diagnosis && <p className="small" style={{ marginTop: 12 }}>{diagnosis}</p>}
              </>
            ) : (
              <p className="small">The observed file shares no attributes with the expected profile, so no agreement can be computed.</p>
            )}
          </div>
        )}
        {o.notes && (
          <p className="small" style={{ marginTop: 10 }}>
            “{o.notes}”
          </p>
        )}
        <div className="lantern-actions">
          <a className="btn fly" href="#/predict">
            Predict the next one →
          </a>
          <a className="btn" href="#/log">
            Open the log
          </a>
          <button className="btn" onClick={onAgain}>
            Add another tasting
          </button>
        </div>
      </div>
    </section>
  );
}
