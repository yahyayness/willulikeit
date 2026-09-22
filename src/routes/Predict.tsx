import { useState } from "react";
import { store, useApp, go, loadMp6Text, loadJrfText, ensureDemoProfile } from "../state";
import { loadSampleIntoDraft, draftSensory, predictFor } from "../actions";
import { DropZone, KindBadge, Field } from "../components/controls";
import { attrLabel } from "../lib/vocab";
import { FLOTILLA } from "../versions";

export function Predict() {
  const { draft, setDraft, refresh, tick } = useApp();
  void tick;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const profiles = store.profiles();
  const active = store.activeProfileId();
  const selected = draft.selected.filter((id) => profiles.some((p) => p.id === id));
  const effectiveSel = selected.length ? selected : active && profiles.some((p) => p.id === active) ? [active] : profiles[0] ? [profiles[0].id] : [];

  const toggle = (id: string) => {
    const cur = new Set(effectiveSel);
    cur.has(id) ? cur.delete(id) : cur.add(id);
    setDraft({ selected: [...cur] });
  };

  const sample = async (k: "d70" | "gianduja" | "elixir" | "elixirJrfOnly") => {
    setBusy(k);
    setErr(null);
    try {
      setDraft(await loadSampleIntoDraft(k));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const ds = draftSensory(draft);
  const mp6 = draft.mp6;
  const jrf = draft.jrf;
  const prospectiveSensory = ds.sensory && ds.sensory.kind !== "observed" ? ds.sensory : undefined;
  const canPredict = !!prospectiveSensory && effectiveSel.length > 0;

  let linkNote: { ok: boolean; text: string } | null = null;
  if (mp6?.parse.ok && jrf?.parse.ok) {
    const lr = (mp6.parse.profile!.linkedRecipe ?? "").toLowerCase();
    const jv = jrf.parse.summary!.version;
    const ok = (lr && (lr.includes(jrf.fileName.toLowerCase()) || (jv && lr.includes(jv)))) || (jv && mp6.parse.profile!.itemId.includes(jv.replace(/\./g, "-")));
    linkNote = ok
      ? { ok: true, text: "The MP6 declares this recipe as its source." }
      : { ok: false, text: "The MP6 doesn't declare this JRF as its source. Make sure both describe the same item — the fit uses the MP6 only." };
  }

  const predict = async () => {
    if (!prospectiveSensory) return;
    setBusy("predict");
    try {
      const chosen = effectiveSel.map((id) => store.profile(id)!).filter(Boolean);
      const b = await predictFor(chosen, prospectiveSensory, ds.jrf, { occasion: draft.occasion.trim() || undefined, note: draft.note.trim() || undefined });
      refresh();
      go(`r/${b}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <p className="eyebrow">Step 2 · the experience</p>
        <h2>Who's it for, and what is it?</h2>
      </section>

      <section className="block" style={{ marginTop: 20 }}>
        <div className="pill-step">
          <i>A</i> who will taste it
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {profiles.map((p) => (
            <button key={p.id} className="chip" aria-pressed={effectiveSel.includes(p.id)} onClick={() => toggle(p.id)}>
              <span className="dot" />
              {p.name}
              {p.relation === "other" ? " · for them" : ""}
              <span className="tiny" style={{ color: "inherit", opacity: 0.7 }}>
                {p.preferences.filter((x) => x.importance > 0).length} attrs
              </span>
            </button>
          ))}
          <a className="chip" href="#/taste/new">
            + someone else
          </a>
          {!profiles.length && (
            <>
              <a className="chip" href="#/taste">
                + build my profile
              </a>
              <button
                className="chip"
                onClick={() => {
                  const p = ensureDemoProfile();
                  setDraft({ selected: [p.id] });
                  refresh();
                }}
              >
                use the demo taster
              </button>
            </>
          )}
        </div>
        {effectiveSel.length > 1 && <p className="tiny" style={{ marginTop: 8 }}>Several people selected — you'll get one frozen prediction each, and a table view.</p>}
      </section>

      <section className="block">
        <div className="pill-step">
          <i>B</i> what it is
        </div>
        <div className="slots" style={{ marginTop: 10 }}>
          <div>
            <div className="slot-title">
              <span className="sw" style={{ background: "var(--mp6)" }} />
              Expected MP6 <span className="tiny">— what it should taste like</span>
            </div>
            {mp6 ? (
              <div className={`drop loaded`} style={!mp6.parse.ok ? { borderColor: "var(--warn)", background: "#fdf3ef" } : undefined}>
                {mp6.parse.ok ? (
                  <>
                    <div className="spread">
                      <b style={{ fontSize: 15 }}>{mp6.parse.profile!.itemName}</b>
                      <button className="skipbtn" onClick={() => setDraft({ mp6: undefined })}>
                        remove
                      </button>
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 6 }}>
                      <KindBadge kind={mp6.parse.profile!.kind} />
                      {mp6.parse.profile!.synthetic && <span className="badge syn">synthetic</span>}
                    </div>
                    <div className="small" style={{ marginTop: 8 }}>
                      {Object.keys(mp6.parse.profile!.values).length} comparable attributes
                      {mp6.parse.profile!.unmapped.length ? ` · ${mp6.parse.profile!.unmapped.length} kept but not comparable` : ""}
                    </div>
                    <div className="tiny" style={{ marginTop: 4 }}>
                      {Object.entries(mp6.parse.profile!.values)
                        .slice(0, 8)
                        .map(([k, v]) => `${attrLabel(k)} ${v.value}`)
                        .join(" · ")}
                      {Object.keys(mp6.parse.profile!.values).length > 8 ? " …" : ""}
                    </div>
                    {mp6.parse.evaluations.length > 1 && (
                      <select
                        style={{ marginTop: 8 }}
                        value={mp6.evaluationIndex}
                        onChange={async (e) => setDraft({ mp6: await loadMp6Text(mp6.text, mp6.fileName, Number(e.target.value)) })}
                      >
                        {mp6.parse.evaluations.map((ev, i) => (
                          <option key={ev.id} value={i}>
                            {ev.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {mp6.parse.profile!.kind === "observed" && (
                      <div className="alert warn" style={{ marginTop: 8 }}>
                        This is an <b>Observed MP6</b>, so it cannot enter the prospective Predict path. Use it after tasting to compare the frozen prediction with what was actually experienced.
                      </div>
                    )}
                    {mp6.parse.warnings.map((w) => (
                      <div key={w} className="tiny" style={{ marginTop: 4, color: "var(--amber)" }}>
                        ⚠ {w}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="spread">
                      <b style={{ fontSize: 15 }}>{mp6.fileName}</b>
                      <button className="skipbtn" onClick={() => setDraft({ mp6: undefined })}>
                        remove
                      </button>
                    </div>
                    <div className="small" style={{ color: "var(--warn)", marginTop: 6 }}>
                      {mp6.parse.error}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <DropZone accept=".mp6,.json,application/json" title="Drop an .mp6 file" hint="From record.mp6.app (Predict mode) or any MP6 Studio tool. Read locally — never uploaded." onText={async (t, n) => setDraft({ mp6: await loadMp6Text(t, n) })} />
            )}
          </div>
          <div>
            <div className="slot-title">
              <span className="sw" style={{ background: "var(--jrf)" }} />
              JRF recipe <span className="tiny">— optional, what it is</span>
            </div>
            {jrf ? (
              <div className="drop loaded" style={!jrf.parse.ok ? { borderColor: "var(--warn)", background: "#fdf3ef" } : undefined}>
                {jrf.parse.ok ? (
                  <>
                    <div className="spread">
                      <b style={{ fontSize: 15 }}>
                        {jrf.parse.summary!.name}
                        {jrf.parse.summary!.version ? <span className="tiny mono"> v{jrf.parse.summary!.version}</span> : null}
                      </b>
                      <button className="skipbtn" onClick={() => setDraft({ jrf: undefined, useProxy: false })}>
                        remove
                      </button>
                    </div>
                    <div className="small" style={{ marginTop: 6 }}>
                      {jrf.parse.summary!.ingredients.length} ingredients · {jrf.parse.summary!.processes.length} process steps
                      {jrf.parse.summary!.status ? ` · ${jrf.parse.summary!.status}` : ""}
                    </div>
                    <div className="tiny" style={{ marginTop: 4 }}>
                      {jrf.parse.summary!.ingredients.map((i) => i.label).join(", ")}
                    </div>
                    {jrf.parse.warnings.map((w) => (
                      <div key={w} className="tiny" style={{ marginTop: 4, color: "var(--amber)" }}>
                        ⚠ {w}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="spread">
                      <b style={{ fontSize: 15 }}>{jrf.fileName}</b>
                      <button className="skipbtn" onClick={() => setDraft({ jrf: undefined })}>
                        remove
                      </button>
                    </div>
                    <div className="small" style={{ color: "var(--warn)", marginTop: 6 }}>
                      {jrf.parse.error}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <DropZone accept=".jrf,.json,application/json" title="Drop a .jrf file" hint="From jrf.recipes or Ajinoverse Studio. Gives FEELLLM the ingredients & process." onText={async (t, n) => setDraft({ jrf: await loadJrfText(t, n) })} />
            )}
          </div>
        </div>

        {linkNote && (
          <div className={`alert ${linkNote.ok ? "info" : "warn"}`} style={{ marginTop: 10 }}>
            {linkNote.ok ? "✓ " : "⚠ "}
            {linkNote.text}
          </div>
        )}

        {jrf?.parse.ok && !mp6?.parse.ok && (
          <div className="card" style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 17 }}>This recipe has no Expected MP6 yet.</h3>
            <p className="small">
              A recipe says how it's made, not how it will taste. The honest route: open <a href={FLOTILLA.recorder}>record.mp6.app</a>, generate the Expected MP6 (Predict mode) from this JRF, review it, then drop it here.
            </p>
            {jrf.parse.ingredientSensory.length > 0 ? (
              <label className="row small" style={{ marginTop: 8, cursor: "pointer", flexWrap: "nowrap", alignItems: "flex-start" }}>
                <input type="checkbox" checked={draft.useProxy} onChange={(e) => setDraft({ useProxy: e.target.checked })} />
                <span>
                  Use a <b>crude ingredient proxy</b> for now — the plain average of the {jrf.parse.ingredientSensory.length} ingredient
                  {jrf.parse.ingredientSensory.length > 1 ? "s" : ""} (of {jrf.parse.summary!.ingredients.length}) that carry sensory data in this JRF. Ignores amounts and process. Labelled as proxy everywhere.
                </span>
              </label>
            ) : (
              <p className="tiny">This JRF carries no ingredient-level sensory data, so no proxy is possible.</p>
            )}
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <p className="eyebrow">Or try a sample</p>
          <div className="samples">
            <button className="sample" onClick={() => sample("d70")} disabled={!!busy}>
              <b>Dark chocolate 70%</b>
              <span>Expected MP6 only · the §21 demo bar</span>
              <span className="tags">
                <span className="badge sim">sim</span>
                <span className="badge syn">fixture</span>
              </span>
            </button>
            <button className="sample" onClick={() => sample("gianduja")} disabled={!!busy}>
              <b>Hazelnut gianduja</b>
              <span>JRF from jrf.recipes + Expected MP6</span>
              <span className="tags">
                <span className="badge stated" style={{ color: "var(--jrf)" }}>jrf</span>
                <span className="badge sim">sim</span>
                <span className="badge syn">fixture</span>
              </span>
            </button>
            <button className="sample" onClick={() => sample("elixir")} disabled={!!busy}>
              <b>Elixir of Invincibility</b>
              <span>AJNV4.3 JRF + reconstructed MP6 — the Predictive Cuisine case</span>
              <span className="tags">
                <span className="badge stated" style={{ color: "var(--jrf)" }}>jrf</span>
                <span className="badge sim">sim</span>
                <span className="badge syn">reconstructed</span>
              </span>
            </button>
            <button className="sample" onClick={() => sample("elixirJrfOnly")} disabled={!!busy}>
              <b>Elixir — JRF only</b>
              <span>See what happens with a recipe and no MP6</span>
              <span className="tags">
                <span className="badge stated" style={{ color: "var(--jrf)" }}>jrf</span>
                <span className="badge proxy">no mp6</span>
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="pill-step">
          <i>C</i> context (optional)
        </div>
        <div className="card" style={{ marginTop: 10 }}>
          <Field label="Occasion" hint="Stored with the prediction as stated context. It does not change the score in v0.1.">
            <input type="text" value={draft.occasion} onChange={(e) => setDraft({ occasion: e.target.value })} placeholder="e.g. dessert after a heavy dinner, gift, tasting flight" />
          </Field>
        </div>
      </section>

      {err && <div className="alert err">{err}</div>}
      {ds.problem && !ds.sensory && (mp6 || jrf) && <p className="small" style={{ color: "var(--amber)" }}>{ds.problem}</p>}

      <div className="row" style={{ position: "sticky", bottom: 12, background: "var(--paper)", padding: "10px 0", zIndex: 5 }}>
        <button className="btn fly big" disabled={!canPredict || busy === "predict"} onClick={predict} style={{ borderColor: "var(--night)" }}>
          {busy === "predict" ? "Freezing prediction…" : `Predict ${effectiveSel.length > 1 ? `${effectiveSel.length} fits` : store.profile(effectiveSel[0])?.relation === "other" ? `${store.profile(effectiveSel[0])!.name}'s fit` : "my fit"} →`}
        </button>
        {!effectiveSel.length && <span className="small">Choose who it's for first.</span>}
        {ds.sensory?.kind === "observed" && <span className="small" style={{ color: "var(--amber)" }}>Observed MP6 belongs in After Tasting; load an Expected MP6 to make a prospective fit prediction.</span>}
      </div>
    </>
  );
}
