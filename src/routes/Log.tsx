import { useRef, useState } from "react";
import { store, useApp, downloadText } from "../state";
import { buildExport, parseImport, toEvents } from "../lib/evidence";
import { CalibrationPlot } from "../components/viz";
import { KindBadge } from "../components/controls";

const MIN_SAMPLE = 5; // TT-P reliability floor

export function Log() {
  const { tick, refresh, toast } = useApp();
  void tick;
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const preds = [...store.predictions()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const outs = store.outcomes();
  const latestOut = (id: string) => outs.filter((o) => o.fitResultId === id).slice(-1)[0];
  const pairs = preds.map((p) => ({ p, o: latestOut(p.id) })).filter((x) => x.o && x.p.fit !== null);
  const meanGap = pairs.length ? pairs.reduce((s, x) => s + Math.abs(x.o!.likingIndex - x.p.fit!), 0) / pairs.length : null;
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <p className="eyebrow">ABED-ready evidence · stays on this device</p>
        <h2>What did we learn?</h2>
        <p className="lede" style={{ fontSize: 16 }}>
          Every frozen prediction, every verdict. This is the dataset the future personal learner (v0.2) and the Firefly network (later) will be built from — one honest data point at a time.
        </p>
      </section>

      <section className="block">
        <div className="card">
          <div className="spread">
            <div>
              <div className="tiny mono">PERSONAL CALIBRATION</div>
              <div style={{ fontFamily: "var(--display)", fontSize: 26, fontWeight: 700 }}>
                {pairs.length} rated prediction{pairs.length === 1 ? "" : "s"}
                {meanGap !== null ? ` · mean |fit↔liking gap| ${meanGap.toFixed(1)}` : ""}
              </div>
              <div className="small">
                {pairs.length < MIN_SAMPLE
                  ? `Exploratory only below ${MIN_SAMPLE} outcomes. ${MIN_SAMPLE - pairs.length} more to go before even describing a personal pattern — and the fit and liking scales remain uncalibrated.`
                  : "Observed, not learned — v0.1 never retunes itself. A personal learner (explicitly versioned) is the v0.2 step."}
              </div>
            </div>
          </div>
          {pairs.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <CalibrationPlot points={pairs.map((x) => ({ x: x.p.fit!, y: x.o!.likingIndex, label: `${x.p.item.name} · ${x.p.profileName}` }))} />
              <div className="tiny">Dashed line = equal numeric index, not validated agreement. Points above it have a higher liking index than fit index; the scales are not yet calibrated.</div>
            </div>
          )}
        </div>
      </section>

      <section className="block">
        <div className="spread">
          <h3>Predictions ({preds.length})</h3>
          <div className="row">
            <button className="btn sm" disabled={!preds.length} onClick={() => downloadText(`willulikeit-export-${stamp}.json`, JSON.stringify(buildExport(store.profiles(), store.predictions(), outs), null, 2), "application/json")}>
              Export all (JSON)
            </button>
            <button className="btn sm" disabled={!preds.length} onClick={() => downloadText(`willulikeit-events-${stamp}.jsonl`, toEvents(store.predictions(), outs).map((e) => JSON.stringify(e)).join("\n") + "\n", "application/x-ndjson")}>
              Evidence events (JSONL)
            </button>
            <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>
              Import…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                f.text().then((t) => {
                  const r = parseImport(t);
                  if (!r.ok) return setImportErr(r.error);
                  setImportErr(null);
                  const c = store.importData(r.data);
                  refresh();
                  toast(`Imported ${c.profiles} profiles, ${c.predictions} predictions, ${c.outcomes} outcomes (existing ones untouched)`);
                }).catch(() => setImportErr("The file could not be read from this device. Nothing was imported."));
                e.target.value = "";
              }}
            />
          </div>
        </div>
        {importErr && <div className="alert err" style={{ marginTop: 10 }}>{importErr}</div>}
        <div className="hist" style={{ marginTop: 12 }}>
          {!preds.length && (
            <div className="card small">
              Nothing yet. <a href="#/predict">Make your first prediction</a> or <a href="#/">try the demo</a>.
            </div>
          )}
          {preds.map((p) => {
            const o = latestOut(p.id);
            return (
              <div className="card hitem" key={p.id}>
                <span className="sc">{p.fit === null ? "—" : Math.round(p.fit)}</span>
                <span>
                  <a href={`#/r/${p.batchId}/${p.id}`} style={{ color: "inherit", fontWeight: 600 }}>
                    {p.item.name}
                  </a>
                  <div className="meta">
                    for {p.profileName}
                    {p.profileRelation === "other" ? " (proxy)" : ""} · {new Date(p.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className="row" style={{ gap: 5, marginTop: 4 }}>
                    <KindBadge kind={p.item.sensoryKind} />
                    {p.item.synthetic && <span className="badge syn">synthetic</span>}
                    {o && <span className="badge obs">tasted · {o.hedonic}/9</span>}
                    {o?.observed && <span className="badge obs">observed mp6</span>}
                  </div>
                </span>
                <a className="btn sm" href={`#/after/${p.id}`}>
                  {o ? "outcome" : "tasted?"}
                </a>
              </div>
            );
          })}
        </div>
      </section>

      <section className="block">
        <details className="adv">
          <summary>Local data · reset</summary>
          <p className="small">
            Profiles, predictions and outcomes stay in this browser's local storage unless you explicitly export or open an external linked tool. The WillULikeIT app itself has no backend or analytics in v0.1. Export before clearing if you want to keep them.
          </p>
          {!confirmClear ? (
            <button className="btn sm ghost" onClick={() => setConfirmClear(true)}>
              Delete all local WillULikeIT data…
            </button>
          ) : (
            <div className="row">
              <span className="small">This removes every profile, prediction and outcome on this device.</span>
              <button
                className="btn sm"
                style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
                onClick={() => {
                  store.clearAll();
                  try {
                    sessionStorage.clear();
                  } catch {
                    /* ignore */
                  }
                  setConfirmClear(false);
                  refresh();
                  toast("All local data deleted");
                }}
              >
                Yes, delete everything
              </button>
              <button className="btn sm ghost" onClick={() => setConfirmClear(false)}>
                Keep it
              </button>
            </div>
          )}
        </details>
      </section>
    </>
  );
}
