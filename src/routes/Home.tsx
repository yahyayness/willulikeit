import { useState } from "react";
import { store, useApp, go } from "../state";
import { runDemo } from "../actions";
import { FLOTILLA } from "../versions";
import { Fireflies } from "../components/viz";

export function Home() {
  const { tick } = useApp();
  void tick;
  const [busy, setBusy] = useState(false);
  const profiles = store.profiles();
  const hasSelf = profiles.some((p) => p.relation === "self" && !p.demo);
  const preds = store.predictions();
  const outs = store.outcomes();
  const pending = preds.filter((p) => !outs.some((o) => o.fitResultId === p.id)).slice(-3).reverse();

  const demo = async () => {
    setBusy(true);
    try {
      const b = await runDemo();
      go(`r/${b}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Firefly, for taste · experimental PoC</p>
        <h1>
          Will U Like <span className="q">It?</span>
        </h1>
        <p className="lede">
          Find out before you make it. Tell us what you like, bring a recipe (<b>JRF</b>) and its predicted sensory profile (<b>Expected MP6</b>), and get a transparent{" "}
          <b>Personal Sensory Fit</b> — for you, or for the person you're cooking for. Then tell us whether we were right.
        </p>
        <div className="cta">
          <a className="btn primary big" href={hasSelf ? "#/predict" : "#/taste"}>
            {hasSelf ? "Predict a fit" : "Take the 60-second taste sweep"}
          </a>
          <button className="btn big" onClick={demo} disabled={busy}>
            {busy ? "Lighting up…" : "Try the 30-second demo"}
          </button>
        </div>
        <div className="steps3">
          <div className="s">
            <span className="n">01</span>
            <b>Tell us what you like</b>
            <span>Start with eight quick taps. Refine only if you want to.</span>
          </div>
          <div className="s">
            <span className="n">02</span>
            <b>Load an MP6 or JRF</b>
            <span>From record.mp6.app and jrf.recipes — or pick a sample.</span>
          </div>
          <div className="s">
            <span className="n">03</span>
            <b>See the fit. Taste. Tell us.</b>
            <span>The prediction is frozen first; reality grades it after.</span>
          </div>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="block">
          <p className="eyebrow">Tasted it yet?</p>
          <div className="hist">
            {pending.map((p) => (
              <a key={p.id} className="card hitem" href={`#/after/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <span className="sc">{p.fit === null ? "—" : Math.round(p.fit)}</span>
                <span>
                  <b>{p.item.name}</b>
                  <div className="meta">
                    for {p.profileName} · predicted {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </span>
                <span className="btn sm">Tell us →</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="block">
        <p className="eyebrow">Where this sits in the flotilla</p>
        <h2>Five questions, five places.</h2>
        <p className="small" style={{ marginTop: 6 }}>
          WillULikeIT doesn't guess what food tastes like — it consumes the recipe and the predicted sensory state from the Studio, and adds the one missing layer: <i>you</i>.
        </p>
        <div className="stackmap" style={{ marginTop: 14 }}>
          <a href={FLOTILLA.jrf}>
            <span className="nm" style={{ color: "var(--jrf)" }}>JRF · jrf.recipes</span>
            <span className="q">What is it, and how is it made?</span>
            <span className="go">↗</span>
          </a>
          <a href={FLOTILLA.recorder}>
            <span className="nm" style={{ color: "var(--mp6)" }}>MP6 · record.mp6.app</span>
            <span className="q">What will it feel like — and what did it?</span>
            <span className="go">↗</span>
          </a>
          <div className="here" style={{ position: "relative", overflow: "hidden" }}>
            <span className="nm">WULIT · you are here</span>
            <span className="q">Given who you are, will you like it?</span>
            <span className="go">●</span>
            <Fireflies />
          </div>
          <a href={FLOTILLA.feelllm}>
            <span className="nm" style={{ color: "var(--feel)" }}>FEELLLM · feelllm.org</span>
            <span className="q">Why — and what should we change?</span>
            <span className="go">↗</span>
          </a>
          <a href="#/log">
            <span className="nm" style={{ color: "var(--ink-soft)" }}>ABED · your log</span>
            <span className="q">What did we learn?</span>
            <span className="go">→</span>
          </a>
        </div>
      </section>

      <section className="block">
        <p className="eyebrow">Built honestly</p>
        <div className="steps3">
          <div className="s">
            <b>A fit, not a probability</b>
            <span>A transparent distance between your stated ideal and the predicted profile. Calibration comes later, from real outcomes.</span>
          </div>
          <div className="s">
            <b>Missing is not zero</b>
            <span>Skipped preferences and undescribed attributes are left out — and the coverage says so.</span>
          </div>
          <div className="s">
            <b>Frozen before tasting</b>
            <span>Every prediction is hashed and locked. Your verdict is stored beside it, never over it.</span>
          </div>
        </div>
      </section>
    </>
  );
}
