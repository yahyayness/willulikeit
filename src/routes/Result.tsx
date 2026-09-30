import { useMemo, useState } from "react";
import { store, useApp, go, downloadText, copyText } from "../state";
import { Dial, Radar, DeltaRows, Fireflies } from "../components/viz";
import { KindBadge } from "../components/controls";
import { BAND_COPY, reasonLine } from "../lib/fit";
import { attrLabel } from "../lib/vocab";
import { buildBrief, briefFileName, QUESTIONS, type BriefQuestion } from "../lib/brief";
import { FLOTILLA } from "../versions";
import type { FitResult, JrfSummary } from "../lib/types";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function Result({ batchId, focus }: { batchId?: string; focus?: string }) {
  const { tick } = useApp();
  void tick;
  const fits = store.predictions().filter((p) => p.batchId === batchId);
  const [showBrief, setShowBrief] = useState(false);
  if (!fits.length)
    return (
      <section className="block">
        <h2>Prediction not found.</h2>
        <p className="small">It may have been made in another browser. Predictions live on the device that made them — export/import from the Log to move them.</p>
        <a className="btn" href="#/predict">
          Make a prediction
        </a>
      </section>
    );
  const f = fits.find((x) => x.id === focus) ?? fits[0];
  const outcome = store.outcomesFor(f.id).slice(-1)[0];
  const jrf: JrfSummary | undefined = f.recipe;
  const who = f.profileRelation === "self" ? (f.profileName === "Me" ? "YOU" : f.profileName) : f.profileName;
  const verdictTitle = f.fit === null ? BAND_COPY[f.band].title : f.coverage < 0.4 ? "Insufficient coverage" : f.coverage < 0.6 ? `Provisional · ${BAND_COPY[f.band].short}` : BAND_COPY[f.band].title;

  return (
    <>
      <section className="block" style={{ marginTop: 18 }}>
        <div className="lantern">
          <Fireflies />
          <div className="vs">
            <b>{who}</b>
            <span className="x">×</span>
            <b>{f.item.name}</b>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 10 }}>
            <KindBadge kind={f.item.sensoryKind} />
            {f.item.synthetic && <span className="badge syn">synthetic data</span>}
            {f.profileRelation === "other" && <span className="badge proxy">profile stated on their behalf</span>}
            <span className="badge frozen" title={`Frozen ${f.createdAt} · profile hash ${f.profileHash}`}>
              🔒 frozen {new Date(f.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            </span>
          </div>

          <div className="scoreline">
            <Dial fit={f.fit} coverage={f.coverage} />
            <div>
              <div className={`verdict ${f.band}`}>{verdictTitle}</div>
              <div className="small" style={{ marginTop: 8 }}>
                Personal Sensory Fit <span className="badge derived">derived · {f.algorithmVersion}</span>
              </div>
              <div style={{ marginTop: 12, maxWidth: 280 }}>
                <div className="spread tiny">
                  <span>coverage</span>
                  <span className="mono">
                    {f.compared.length} of {f.compared.length + f.notDescribed.length} weighted preferences
                  </span>
                </div>
                <div className="meter" style={{ marginTop: 4 }}>
                  <i style={{ width: `${f.coverage * 100}%`, background: "#7fd0db" }} />
                </div>
              </div>
              <p className="disclaim">
                Experimental estimate from {f.profileRelation === "self" ? "your" : `${f.profileName}'s`} stated preferences and the item's{" "}
                {f.item.sensoryKind === "expected" ? "predicted" : f.item.sensoryKind === "proxy" ? "proxy" : ""} sensory profile. Not a validated probability.
                {f.coverage < 0.4 && f.fit !== null ? " Coverage is too low to classify overall fit; the number only reflects the few comparable preferences." : f.coverage < 0.6 && f.fit !== null ? " Provisional result because less than 60% of active preferences are represented." : ""}
                {f.item.sensoryKind === "proxy" ? " Built on a crude ingredient proxy — weaker still." : ""}
              </p>
            </div>
          </div>

          {f.fit !== null && (
            <ul className="reasons">
              {f.matches.slice(0, 3).map((m) => (
                <li key={m.attribute} className="ok">
                  <span className="ic">✓</span>
                  <span>{reasonLine(m, f.profileRelation === "other" ? f.profileName : undefined)}</span>
                  <span className="val">
                    {fmt(m.predicted)} vs {fmt(m.user_preference)}
                  </span>
                </li>
              ))}
              {f.mismatches.slice(0, 3).map((m) => (
                <li key={m.attribute} className="no">
                  <span className="ic">△</span>
                  <span>
                    {m.label}: {reasonLine(m, f.profileRelation === "other" ? f.profileName : undefined)}
                  </span>
                  <span className="val">
                    {fmt(m.predicted)} vs {fmt(m.user_preference)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {f.fit === null && <p className="small">None of the stated preferences are described by this item's sensory profile, so there is nothing honest to compute.</p>}

          {f.compared.length > 0 && (
            <div className="twin">
              <Radar compared={f.compared} itemLabel={f.item.sensoryKind === "expected" ? "predicted item" : "item"} />
              <DeltaRows compared={f.compared} />
            </div>
          )}

          {(f.notDescribed.length > 0 || f.notInProfile.length > 0) && (
            <p className="tiny" style={{ marginTop: 14 }}>
              {f.notDescribed.length > 0 && <>Not described by the item (left out, not zero): {f.notDescribed.map(attrLabel).join(", ")}. </>}
              {f.notInProfile.length > 0 && <>Described but no stated preference: {f.notInProfile.map(attrLabel).join(", ")}.</>}
            </p>
          )}

          {fits.length > 1 && <TableView fits={fits} focus={f.id} />}

          <div className="lantern-actions">
            <button className="btn fly" onClick={() => setShowBrief((s) => !s)}>
              {showBrief ? "Hide FEELLLM brief" : "Ask FEELLLM why →"}
            </button>
            {outcome ? (
              <a className="btn" href={`#/after/${f.id}`}>
                See prediction vs outcome
              </a>
            ) : (
              <a className="btn" href={`#/after/${f.id}`}>
                I tasted it — was it right?
              </a>
            )}
            <a className="btn" href="#/predict">
              Predict another
            </a>
          </div>

          <details className="adv">
            <summary>Provenance</summary>
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>fit_result_id</dt>
              <dd>{f.id}</dd>
              <dt>algorithm</dt>
              <dd>{f.algorithmVersion} · D = {f.distance ?? "—"} · fit = 100·(1 − D/10)</dd>
              <dt>fit_result_hash</dt>
              <dd>{f.fitResultHash}</dd>
              <dt>profile</dt>
              <dd>
                {f.profileVersion} · {f.profileHash.slice(0, 16)}…
              </dd>
              <dt>expected_mp6_hash</dt>
              <dd>{f.item.expectedMp6Hash ?? "— (no MP6 file)"}</dd>
              <dt>jrf_hash</dt>
              <dd>{f.item.jrfHash ? `${f.item.jrfHash} (${f.item.jrfName ?? ""} v${f.item.jrfVersion ?? "?"})` : "—"}</dd>
              <dt>source file</dt>
              <dd>{f.item.sourceFile ?? "—"}</dd>
              <dt>context</dt>
              <dd>{f.context.occasion ?? "—"}</dd>
            </dl>
          </details>
        </div>
      </section>

      {showBrief && <BriefPanel fits={fits} focus={f} jrf={jrf} />}

      <section className="block">
        <p className="eyebrow">What happens next</p>
        <div className="steps3">
          <div className="s">
            <b>Make it, taste it</b>
            <span>Or record the tasting at record.mp6.app for an Observed MP6.</span>
          </div>
          <div className="s">
            <b>Tell us how it went</b>
            <span>One tap on the 9-point scale. The prediction above stays as it is.</span>
          </div>
          <div className="s">
            <b>Grow the dataset</b>
            <span>Every verdict is a data point for personal learning, and later, for the Firefly network.</span>
          </div>
        </div>
      </section>
    </>
  );
}

function TableView({ fits, focus }: { fits: FitResult[]; focus: string }) {
  const sorted = [...fits].sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1));
  return (
    <div style={{ marginTop: 22 }}>
      <p className="eyebrow">Around the table</p>
      <table className="table-fit">
        <thead>
          <tr>
            <th>who</th>
            <th>fit</th>
            <th>biggest gap</th>
            <th>coverage</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((x) => (
            <tr key={x.id} className={x.id === focus ? "sel" : ""} style={{ cursor: "pointer" }} onClick={() => go(`r/${x.batchId}/${x.id}`)}>
              <td>
                {x.profileName}
                {x.profileRelation === "other" ? <span className="tiny"> · proxy</span> : null}
              </td>
              <td className="n">{x.fit === null ? "—" : Math.round(x.fit)}</td>
              <td className="small">{x.mismatches[0] ? `${x.mismatches[0].label} (${x.mismatches[0].delta > 0 ? "+" : ""}${fmt(x.mismatches[0].delta)})` : "none"}</td>
              <td className="mono tiny">{Math.round(x.coverage * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BriefPanel({ fits, focus, jrf }: { fits: FitResult[]; focus: FitResult; jrf?: JrfSummary }) {
  const { toast } = useApp();
  const [q, setQ] = useState<BriefQuestion>(fits.length > 1 ? "table" : "why_like");
  const [custom, setCustom] = useState("");
  const [all, setAll] = useState(fits.length > 1);
  const target = all ? fits : [focus];
  const name = target.length === 1 ? target[0].profileName : "everyone";
  const md = useMemo(() => buildBrief({ fits: target, jrf, question: q, customQuestion: custom }), [target, jrf, q, custom]);
  const qs: BriefQuestion[] = fits.length > 1 ? ["table", "why_like", "least_aligned", "modify", "custom"] : ["why_like", "least_aligned", "modify", "custom"];
  return (
    <section className="block brief-box">
      <p className="eyebrow">FEELLLM handoff · deterministic brief</p>
      <h3>Ask why — without letting an LLM make up the number.</h3>
      <p className="small">
        WillULikeIT computes; FEELLLM explains. This brief carries the frozen fit, the sensory profile and its provenance, and tells the model not to invent its own liking score. Paste it into FEELLLM or any LLM.
      </p>
      <div className="row" style={{ marginTop: 10 }}>
        {qs.map((k) => (
          <button key={k} className="chip" aria-pressed={q === k} onClick={() => setQ(k)}>
            {k === "custom" ? "Your own question" : QUESTIONS[k as Exclude<BriefQuestion, "custom">](name).replace(/\?.*$/, "?")}
          </button>
        ))}
      </div>
      {q === "custom" && (
        <input type="text" style={{ marginTop: 10 }} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. How can I raise the fit above 85 without reducing ginger?" />
      )}
      {fits.length > 1 && (
        <label className="row small" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> include everyone at the table ({fits.length})
        </label>
      )}
      <textarea readOnly value={md} style={{ marginTop: 12 }} aria-label="Brief preview" />
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn primary"
          onClick={async () => {
            const ok = await copyText(md);
            toast(ok ? <span>Brief copied — paste it into your AI (Claude, ChatGPT, Gemini…)</span> : "Copy failed — use Download instead");
          }}
        >
          Copy brief
        </button>
        <button className="btn" onClick={() => downloadText(briefFileName(focus), md)}>
          Download .md
        </button>
        <a className="btn" href={FLOTILLA.feelllm + "/#/food"} target="_blank" rel="noreferrer" style={{ borderColor: "var(--feel)", color: "var(--feel)" }}>
          After tasting: tell FEELLLM how it felt ↗
        </a>
      </div>
      {/* Gate 2 (BETA-MA-003 / BETA-VINCE-002): the link lands on FEELLLM's food flow, not its home page. */}
      <p className="tiny" style={{ marginTop: 8 }}>
        The brief goes to any AI as your first message. FEELLLM is for afterwards: drop the same <b>.mp6</b> there and add how it actually felt.
        Prefer no files at all? Use the <a href="https://studio.ajinomatrix.com/#/guided">AJX Studios Guided workflow</a>.
      </p>
    </section>
  );
}
