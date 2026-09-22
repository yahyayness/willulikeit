import { useEffect, useMemo, useState } from "react";
import { store, useApp, go, newProfile } from "../state";
import { ATTRS, attrLabel } from "../lib/vocab";
import { CHOCOLATE_ANCHORS, QUICK_SWEEP, QUICK_SWEEP_VALUES, deriveFromAnchors, applyDerived, type DerivedPref } from "../lib/anchors";
import { PrefSlider, HedonicBand, Field } from "../components/controls";
import type { UserPreference, UserProfile } from "../lib/types";

export function Taste({ id }: { id?: string }) {
  const { tick, refresh, toast } = useApp();
  void tick;
  const profiles = store.profiles();
  const targetId = id && id !== "new" ? id : !id ? store.activeProfileId() ?? profiles.find((p) => p.relation === "self")?.id : undefined;
  const current = targetId ? store.profile(targetId) : undefined;

  const [creating, setCreating] = useState<null | "self" | "other">(null);
  const [newName, setNewName] = useState("");

  const create = (relation: "self" | "other") => {
    const name = relation === "self" ? newName.trim() || "Me" : newName.trim();
    if (!name) return;
    const p = store.saveProfile(newProfile(name, relation));
    store.setActiveProfileId(p.id);
    setCreating(null);
    setNewName("");
    refresh();
    go(`taste/${p.id}`);
  };

  const showCreate = id === "new" || !current || creating;

  return (
    <>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <p className="eyebrow">Step 1 · taste profile</p>
        <h2>Tell us what {current && !showCreate ? (current.relation === "self" ? "you like" : `${current.name} likes`) : "you like"}.</h2>
        <p className="lede" style={{ fontSize: 16 }}>
          Your ideal sits on the same 0–10 axes an Expected MP6 uses, so the comparison is direct. Skip anything you're unsure of — skipped means unknown, not neutral.
        </p>
      </section>

      <div className="row" style={{ marginTop: 18 }} role="tablist" aria-label="Profiles">
        {profiles.map((p) => (
          <a key={p.id} className="chip" aria-pressed={!showCreate && current?.id === p.id} href={`#/taste/${p.id}`} onClick={() => store.setActiveProfileId(p.id)}>
            <span className="dot" />
            {p.name}
            {p.relation === "other" ? " · for them" : ""}
            {p.demo ? " · demo" : ""}
          </a>
        ))}
        <button className="chip" onClick={() => setCreating("self")} aria-pressed={creating === "self"}>
          + me
        </button>
        <button className="chip" onClick={() => setCreating("other")} aria-pressed={creating === "other"}>
          + someone else
        </button>
      </div>

      {showCreate ? (
        <section className="card" style={{ marginTop: 16 }}>
          {creating === "other" || id === "new" ? (
            <>
              <h3>Who are you predicting for?</h3>
              <p className="small">
                A guest, a partner, a child, a client. You'll answer on their behalf — WillULikeIT labels the profile as a <b>proxy</b> ("stated by you, for them"), never as their own report.
              </p>
              <Field label="Their name or nickname">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Coco, Dad, table 4" autoFocus onKeyDown={(e) => e.key === "Enter" && create("other")} />
              </Field>
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn primary" disabled={!newName.trim()} onClick={() => create("other")}>
                  Create their profile
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>Start with you.</h3>
              <Field label="What should we call you? (optional — stays on this device)">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Me" onKeyDown={(e) => e.key === "Enter" && create("self")} />
              </Field>
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn primary" onClick={() => create("self")}>
                  Create my profile
                </button>
                <button className="btn ghost" onClick={() => setCreating("other")}>
                  It's for someone else
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        <ProfileEditor key={current!.id + "@" + current!.version} profile={current!} onSaved={(p) => { refresh(); toast(<span>Saved <b>{p.name}</b> · profile v{p.version}</span>); }} />
      )}
    </>
  );
}

function ProfileEditor({ profile, onSaved }: { profile: UserProfile; onSaved: (p: UserProfile) => void }) {
  const [prefs, setPrefs] = useState<UserPreference[]>(profile.preferences);
  const [name, setName] = useState(profile.name);
  const [ratings, setRatings] = useState<Record<string, number>>(profile.anchorRatings ?? {});
  const [derived, setDerived] = useState<DerivedPref[] | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sweepOpen, setSweepOpen] = useState(profile.preferences.length === 0);
  useEffect(() => setDirty(true), [prefs, name, ratings]);
  useEffect(() => setDirty(false), []);

  const byAttr = useMemo(() => Object.fromEntries(prefs.map((p) => [p.attribute, p])), [prefs]);
  const setPref = (attribute: string, p: UserPreference | null) => setPrefs((all) => (p ? [...all.filter((x) => x.attribute !== attribute), p] : all.filter((x) => x.attribute !== attribute)));
  const sweepAnswered = QUICK_SWEEP.filter((q) => !!byAttr[q.attribute]).length;
  const setSweep = (attribute: string, ideal: number) =>
    setPref(attribute, { attribute, ideal, importance: 2, source: "quick_sweep" });
  const core = ATTRS.filter((a) => a.core);
  const more = ATTRS.filter((a) => !a.core);
  const activeCount = prefs.filter((p) => p.importance > 0).length;
  const who = profile.relation === "self" ? "you" : profile.name;

  const save = () => {
    const saved = store.saveProfile({ ...profile, name: name.trim() || profile.name, preferences: prefs, anchorRatings: ratings });
    store.setActiveProfileId(saved.id);
    setDirty(false);
    onSaved(saved);
  };

  return (
    <>
      <section className="card" style={{ marginTop: 16 }}>
        <div className="spread">
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Profile name">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <div className="small" style={{ textAlign: "right" }}>
            <span className={`badge ${profile.relation === "self" ? "stated" : "proxy"}`}>{profile.relation === "self" ? "stated by you" : `proxy · stated for ${profile.name}`}</span>
            <div className="tiny mono" style={{ marginTop: 6 }}>
              v{profile.version}
              {profile.history.length ? ` · ${profile.history.length} earlier version${profile.history.length > 1 ? "s" : ""} kept` : ""}
            </div>
          </div>
        </div>
      </section>

      <section className="block quick-sweep">
        <div className="spread">
          <div>
            <p className="eyebrow">60-second start · {sweepAnswered}/{QUICK_SWEEP.length} answered</p>
            <h3>Quick Taste Sweep</h3>
            <p className="small">Eight taps are enough to make a useful first profile. Skip anything you cannot answer; nothing skipped is treated as average.</p>
          </div>
          {profile.preferences.length > 0 && (
            <button className="btn sm ghost" type="button" onClick={() => setSweepOpen((v) => !v)}>{sweepOpen ? "Hide sweep" : "Open sweep"}</button>
          )}
        </div>
        {sweepOpen && (
          <div className="card sweep-grid" style={{ marginTop: 12 }}>
            {QUICK_SWEEP.map((q, idx) => {
              const pref = byAttr[q.attribute];
              return (
                <div className="sweep-card" key={q.id}>
                  <div className="sweep-num">{String(idx + 1).padStart(2, "0")}</div>
                  <div className="sweep-copy">
                    <b>{q.prompt}</b>
                    <span>{q.hint}</span>
                  </div>
                  <div className="sweep-options" role="radiogroup" aria-label={q.prompt}>
                    {QUICK_SWEEP_VALUES.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={pref?.ideal === o.value}
                        className={pref?.ideal === o.value ? "chosen" : ""}
                        title={`${o.label} · ${o.value}/10`}
                        onClick={() => setSweep(q.attribute, o.value)}
                      >
                        <span>{o.label}</span>
                      </button>
                    ))}
                    <button type="button" className="skip" onClick={() => setPref(q.attribute, null)}>Skip</button>
                  </div>
                  <div className="sweep-ends"><span>{q.lowLabel}</span><span>{q.highLabel}</span></div>
                </div>
              );
            })}
            <div className="sweep-finish">
              <div>
                <b>{sweepAnswered >= 6 ? "Good enough to start." : "Answer at least a few that feel obvious."}</b>
                <div className="tiny">You can refine every value later. This is an experimental preference estimate, not a validated taste phenotype.</div>
              </div>
              <button
                className="btn primary"
                type="button"
                disabled={sweepAnswered < 4}
                onClick={() => { save(); setSweepOpen(false); }}
              >
                Save this first profile
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="block">
        <p className="eyebrow">Optional · category shortcut</p>
        <h3>Want a better chocolate profile? Rate a few chocolate styles {profile.relation === "other" ? `as ${profile.name} would` : "you know"}.</h3>
        <p className="small">
          Rate only the ones {who === "you" ? "you've" : "they've"} tasted. Liked styles pull the ideal toward their typical profile. Reference profiles are synthetic approximations, not measurements.
        </p>
        <div className="card anchors" style={{ marginTop: 12 }}>
          {CHOCOLATE_ANCHORS.map((a) => (
            <div className="anchor" key={a.id}>
              <div className="spread">
                <span className="nm">
                  {a.label}
                  <span>{a.hint}</span>
                </span>
                {ratings[a.id] ? (
                  <button className="skipbtn" onClick={() => setRatings(({ [a.id]: _, ...r }) => r)}>
                    clear
                  </button>
                ) : (
                  <span className="tiny">not rated</span>
                )}
              </div>
              <div style={{ marginTop: 6 }}>
                <HedonicBand compact value={ratings[a.id]} onChange={(v) => setRatings((r) => ({ ...r, [a.id]: v }))} label={`How much ${who === "you" ? "do you" : "does " + profile.name} like ${a.label}?`} />
              </div>
            </div>
          ))}
          <div className="row">
            <button className="btn sm" disabled={!Object.keys(ratings).length} onClick={() => setDerived(deriveFromAnchors(ratings))}>
              Derive an ideal from these ratings
            </button>
            <span className="tiny">1 = dislike extremely · 9 = like extremely</span>
          </div>
          {derived && (
            <div className="alert info">
              {derived.length === 0 ? (
                <>Nothing rated above 5 ("neither"), so there's nothing to learn an ideal from. We don't guess.</>
              ) : (
                <>
                  <b>Derived ideal</b> (weighted by how much each liked style was liked):
                  <div className="mono" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.8 }}>
                    {derived.map((d) => (
                      <span key={d.attribute} style={{ marginRight: 12, whiteSpace: "nowrap" }}>
                        {attrLabel(d.attribute)} {d.ideal}
                        {d.importance === 3 ? "★" : ""}
                      </span>
                    ))}
                  </div>
                  <div className="tiny" style={{ marginTop: 4 }}>★ = liked and disliked styles differ strongly here, so importance is set to "a lot".</div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button
                      className="btn sm primary"
                      onClick={() => {
                        setPrefs((p) => applyDerived(p, derived));
                        setDerived(null);
                      }}
                    >
                      Apply to the sliders below
                    </button>
                    <button className="btn sm ghost" onClick={() => setDerived(null)}>
                      Not now
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="block">
        <div className="spread">
          <div>
            <p className="eyebrow">Refine if you want · {activeCount} active attribute{activeCount === 1 ? "" : "s"}</p>
            <h3>{profile.relation === "self" ? "Your ideal intensities" : `${profile.name}'s ideal intensities`}</h3>
          </div>
        </div>
        <div className="card" style={{ marginTop: 10 }}>
          <details className="adv" open={profile.preferences.length > 0 && profile.preferences.some((p) => p.source === "explicit_slider")}>
            <summary>Refine the 10 main sensory preferences</summary>
            {core.map((a) => (
              <PrefSlider key={a.id} attribute={a.id} pref={byAttr[a.id]} onChange={(p) => setPref(a.id, p)} />
            ))}
          </details>
          <details className="adv">
            <summary>More attributes ({more.length}) — saltiness, umami, nutty, floral, complexity, body…</summary>
            {more.map((a) => (
              <PrefSlider key={a.id} attribute={a.id} pref={byAttr[a.id]} onChange={(p) => setPref(a.id, p)} />
            ))}
          </details>
        </div>
      </section>

      <div className="row" style={{ position: "sticky", bottom: 12, background: "var(--paper)", padding: "10px 0", zIndex: 5 }}>
        <button className="btn primary big" onClick={save} disabled={!dirty && profile.preferences.length > 0}>
          Save profile
        </button>
        <a className="btn big" href="#/predict" onClick={() => dirty && save()}>
          Next: predict a fit →
        </a>
      </div>

      <section className="block">
        <details className="adv">
          <summary>Advanced · raw profile, versions, delete</summary>
          <pre>{JSON.stringify({ ...profile, preferences: prefs }, null, 2)}</pre>
          {!confirmDel ? (
            <button className="btn sm ghost" onClick={() => setConfirmDel(true)}>
              Delete this profile…
            </button>
          ) : (
            <div className="row">
              <span className="small">Delete {profile.name}? Frozen predictions made with it are kept.</span>
              <button
                className="btn sm"
                style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
                onClick={() => {
                  store.deleteProfile(profile.id);
                  go("taste/new");
                }}
              >
                Yes, delete
              </button>
              <button className="btn sm ghost" onClick={() => setConfirmDel(false)}>
                Keep
              </button>
            </div>
          )}
        </details>
      </section>
    </>
  );
}
