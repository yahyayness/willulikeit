import { FLOTILLA, VERSIONS } from "../versions";
import { ATTRS } from "../lib/vocab";

export function About() {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <p className="eyebrow">Method · honesty rules · roadmap</p>
        <h2>How WillULikeIT decides — and what it refuses to claim.</h2>
        <p className="lede" style={{ fontSize: 16 }}>
          In 1995, Firefly (born Ringo, at the MIT Media Lab) asked people to rate music, then matched them with people of similar taste. That needs a crowd. WillULikeIT starts with one person and the thing's predicted sensory profile — so it works on day one, and every verdict builds the crowd data a Firefly-style layer will need later.
        </p>
      </section>

      <section className="block">
        <h3>The fit, in one formula</h3>
        <div className="card" style={{ marginTop: 10 }}>
          <pre className="code">{`C   = attributes you care about (importance > 0)
      that the item's MP6 actually describes
D   = Σ w·|ideal − item| / Σ w          over C, on 0–10
Fit = 100 · (1 − D/10)                  clamped 0–100
coverage = |C| / |attributes you care about|`}</pre>
          <p className="small" style={{ marginTop: 10 }}>
            Importance: <i>doesn't matter</i> 0 (excluded) · <i>a little</i> 1 · <i>matters</i> 2 · <i>a lot</i> 3. A difference of ≤ 1.5 counts as a match. Bands: ≥ 80 likely strong fit · 65–79 likely good · 50–64 mixed · 35–49 probably not · &lt; 35 likely poor.
          </p>
          <p className="small">
            Your ideal lives on the same MP6 Product Profile v0.1.1 axes as the item ({ATTRS.length} attributes across taste, smell and touch), so nothing is translated between invented scales. Aliases (e.g. <span className="mono">acidity → sourness</span>, <span className="mono">body_richness → body</span>) follow MP6's
            "canonicalize with original preserved" policy.
          </p>
        </div>
      </section>

      <section className="block">
        <h3>Twelve rules this PoC keeps</h3>
        <ol className="small" style={{ lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Predicted sensory state and liking are different variables.</li>
          <li>Liking is not trained-panel intensity.</li>
          <li>Every prediction is hashed and frozen before any outcome exists.</li>
          <li>Profile edits create a new version; old versions are kept.</li>
          <li>Missing ≠ zero. An explicit 0 in an MP6 is a value; an absent attribute is unknown.</li>
          <li>"Doesn't matter" (importance 0) is not dislike.</li>
          <li>Skipped is not neutral — a skipped slider is left out entirely.</li>
          <li>The fit is not a probability. It gets calibrated only once real outcomes exist.</li>
          <li>FEELLLM explains; it never overwrites the number. The brief tells the LLM so.</li>
          <li>Actual liking is an outcome, not proof the Expected MP6 was right.</li>
          <li>Sensory agreement (expected vs observed MP6) and liking agreement are reported separately.</li>
          <li>Misses are kept. Negative results are data.</li>
        </ol>
      </section>

      <section className="block">
        <h3>What it reads</h3>
        <div className="card small" style={{ marginTop: 10 }}>
          <p>
            <b>MP6</b> — the frozen v0.1 container (<span className="mono">magic: "AJX-MP6"</span>), in both shapes the Studio produces: product-profile <span className="mono">scores</span> (Converter, AJNV4.3 projections) and Recorder <span className="mono">results</span>. It tells prediction from
            observation from the file's own markers (<span className="mono">evaluation_type</span>, <span className="mono">validation_status</span>, <span className="mono">data_class</span>, MP6-SIM/OBS). Unknown attributes are preserved, not dropped. Validate files at{" "}
            <a href={FLOTILLA.validate}>validate.mp6.app</a>.
          </p>
          <p>
            <b>JRF</b> — <span className="mono">ajinomotrix-protocol-version</span> 1.0 from <a href={FLOTILLA.jrf}>jrf.recipes</a> / <a href={FLOTILLA.studio}>ajinoverse.studio</a>: identity, ingredients, process. WillULikeIT does not predict taste from a recipe — that's the Recorder's Predictive
            Cuisine path. If a JRF has no Expected MP6, you can opt in to a clearly labelled crude ingredient proxy, or (better) generate the MP6 at <a href={FLOTILLA.recorder}>record.mp6.app</a>.
          </p>
          <p>
            <b>Samples</b> — the 70% bar and gianduja MP6 files are synthetic fixtures. The Elixir of Invincibility MP6 is the AJNV4.3 reconstruction from the Predictive Cuisine case (approximated from radar charts, not measured). The chocolate anchor profiles are typical-style approximations.
          </p>
        </div>
      </section>

      <section className="block">
        <h3>Three levels</h3>
        <div className="stackmap" style={{ marginTop: 10 }}>
          <div className="here">
            <span className="nm">LEVEL 1 · NOW</span>
            <span className="q">Transparent content-based fit for one person</span>
            <span className="go">●</span>
          </div>
          <a href="#/log">
            <span className="nm">LEVEL 2 · v0.2</span>
            <span className="q">Personal learner from your own 10–30 outcomes, explicitly versioned</span>
            <span className="go">○</span>
          </a>
          <a href="#/log">
            <span className="nm">LEVEL 3 · LATER</span>
            <span className="q">Firefly network: people like you × profiles like this — only once the data earns it</span>
            <span className="go">○</span>
          </a>
        </div>
      </section>

      <section className="block">
        <h3>Privacy</h3>
        <p className="small">
          No account, no server, no analytics. Profiles, predictions and outcomes are stored in this browser's local storage; files you drop are read locally and never uploaded. The FEELLLM brief is generated on your device — you choose where to paste it. Export or delete everything from the{" "}
          <a href="#/log">Log</a>.
        </p>
      </section>

      <section className="block">
        <h3>Credits</h3>
        <p className="small">
          An experimental Ajinomatrix SRL project, built alongside FEELLLM.org and the MP6 Studio. MP6 Recorder concept by Markus Ojala (SeAMK University). 9-point hedonic scale: Peryam &amp; Pilgrim (1957), via the TT-P protocol.
        </p>
        <p className="tiny mono">
          {Object.entries(VERSIONS)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ")}
        </p>
      </section>
    </>
  );
}
