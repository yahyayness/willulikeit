# WillULikeIT.org — PoC v0.1.0

**Will U Like It? Find out before you make it.**
Firefly for taste, built honestly. It's a transparent, one-person, content-based predictor of **Personal Sensory Fit** between a stated taste profile and an item's **Expected MP6**. The recipe can come along as a **JRF**. Every use produces the user-evaluated sensory data that a later collaborative (Firefly-style) layer will need.

```
jrf.recipes      WHAT IS IT?                 JRF
record.mp6.app   WHAT WILL IT FEEL LIKE?     Expected MP6 (SIM) / Observed MP6 (OBS)
willulikeit.org  WILL YOU (OR THEY) LIKE IT? wulit-fit-v0.1   ← this app
feelllm.org      WHY — AND WHAT SHOULD WE CHANGE?  deterministic handoff brief
ABED / SEG / SRS WHAT DID WE LEARN?          evidence export (JSON / JSONL)
```

## Deploy (Vercel)
1. Push this folder to a Git repo and import it in Vercel. You can also run `npx vercel` in this folder.
2. Vercel detects Vite through `vercel.json`: build `npm run build`, output `dist`.
3. Add the domain `willulikeit.org` in Project → Settings → Domains.

It needs no environment variables, no backend and no API key.

## Local
```
npm install
npm test        # 19 contract tests (brief §20 acceptance list + real ecosystem files)
npm run dev
npm run build
```

## What it does
- **Taste profiles** for *you* and for *someone else*. Profiles made for someone else are labelled as a proxy ("stated by you, for them"). You set 10 core sliders plus 8 optional ones, each with an importance of 0–3. A skipped slider is **absent**, never neutral. The optional **chocolate anchor** shortcut lets you rate 7 styles on the TT-P 9-point hedonic scale. It derives an ideal from the styles you liked, and nothing is applied until you accept it. Every edit saves a new profile version and keeps the old one.
- **Item input:** you can drop an `.mp6` (Expected MP6) and/or a `.jrf`, or use the samples: 70% dark bar, Gianduja (JRF + MP6), Elixir of Invincibility (AJNV4.3 JRF + reconstructed MP6) and Elixir JRF-only. The reader handles both MP6 shapes the Studio produces: `scores` and Recorder `results`. It detects SIM vs OBS from the file's own markers, keeps unmapped attributes and fails clearly on bad input. For a JRF with no MP6, the app points to record.mp6.app. You can also opt in to a **crude ingredient proxy**, which is labelled as proxy everywhere.
- **Fit (`wulit-fit-v0.1`):** `D = Σw|p−x|/Σw` over the attributes both sides share, then `Fit = 100(1−D/10)`, plus coverage. The result also lists matches, mismatches, what the item doesn't describe, and bands. It is **not a probability.**
- **Freeze:** each prediction is SHA-256 hashed (profile, MP6 bytes, JRF bytes), deep-frozen and stored append-only.
- **Table mode:** predict for several people at once and get one frozen fit per person, with a "who at the table" view.
- **FEELLLM handoff:** a deterministic Markdown brief that carries the question, stated/simulated/derived labels, the recipe, the sensory table, the fit and its provenance. It explicitly tells the LLM **not to invent its own liking number**. You can copy it, download it as .md or open feelllm.org. There's no coupling to FEELLLM internals.
- **After tasting:** you record actual liking on the 9-point hedonic scale. The app shows liking index vs predicted fit and the resulting error. You can add an optional **Observed MP6**, which gives sensory agreement (expected vs observed) and a *post-hoc* fit, reported separately. That helps tell a wrong sensory prediction apart from a wrong taste profile.
- **Log:** a personal calibration plot and mean error (flagged as indicative below 5 outcomes). You can export everything (`wulit-export@1`), export ABED-ready `personal_fit_evaluation` events (JSONL), import without overwriting, or reset.

## Design
This is the in-between sibling of the flotilla:
- Paper, the Fraunces serif and the hedonic band come from FEELLLM / TT-P.
- The dark "lantern" stage, Archivo and the six MP6 dimension hues come from MP6 Studio.
- Its own identity is the **firefly glow** (`#d6f24c`) and the 4-colour flotilla strip JRF → MP6 → WULIT → FEELLLM.

## Files
- `src/lib/fit.ts`: the engine, pure TypeScript with no dependencies
- `mp6.ts`, `jrf.ts`: readers
- `predict.ts`: freezing and outcomes
- `brief.ts`: the FEELLLM handoff
- `evidence.ts`: ABED export
- `anchors.ts`: chocolate anchors
- `store.ts`: local-first store behind an interface, so a consented backend can drop in later
- `tests/engine.test.ts`: the tests
- `public/samples/`: demo files. The 70% and gianduja MP6s are **synthetic fixtures**.

## Not built on purpose (v0.1)
It has no accounts, social features, collaborative filtering, ML training, LLM-generated score or server persistence. It makes no health or allergy claims and never writes to Ajinoverse or MP6 production data.

## Roadmap
- **v0.2:** a personal learner from your own outcomes, explicitly versioned.
- **v0.3:** category models.
- **v0.4:** a hybrid/collaborative layer, only once the interaction density earns it.
- **v1:** multisensory experiences (fragrance, places, music).


## Public-deployment hardening (v0.1)

- Public JRF fixtures are sanitized demo copies with internal IDs/dependency references removed.
- Observed MP6 files are blocked from the prospective Predict action; they belong in After Tasting.
- The hedonic comparison is called a **fit↔liking gap**, not prediction error: the two indices are not yet empirically calibrated.
- Low sensory coverage gates the qualitative verdict (<40% = insufficient; 40–59% = provisional).
- Every frozen fit result has a SHA-256 `fitResultHash` in addition to input hashes.
- No Google-hosted fonts, analytics, backend, or required environment variables.
