// Freezing a prediction: snapshot every input, hash it, deep-freeze it.
// After this point the FitResult is never rewritten — outcomes live apart.

import { computeFit, FIT_ALGORITHM, likingIndex, sensoryAgreement } from "./fit";
import { canonicalJson, deepFreeze, sha256, uid } from "./hash";
import type { FitResult, JrfSummary, Outcome, SensoryProfile, UserProfile } from "./types";

export async function profileHash(p: Pick<UserProfile, "id" | "version" | "preferences">): Promise<string> {
  const prefs = [...p.preferences].sort((a, b) => a.attribute.localeCompare(b.attribute));
  return sha256(canonicalJson({ id: p.id, version: p.version, preferences: prefs }));
}

export async function freezePrediction(args: {
  profile: UserProfile;
  sensory: SensoryProfile;
  jrf?: JrfSummary;
  batchId?: string;
  context?: FitResult["context"];
  now?: string;
  id?: string;
}): Promise<FitResult> {
  const { profile, sensory, jrf } = args;
  const comp = computeFit(profile.preferences, sensory);
  const sensorySnapshot: Record<string, number> = {};
  for (const [k, v] of Object.entries(sensory.values)) sensorySnapshot[k] = v.value;
  const payload: Omit<FitResult, "fitResultHash"> = {
    ...comp,
    id: args.id ?? uid("fit"),
    batchId: args.batchId ?? uid("batch"),
    algorithmVersion: FIT_ALGORITHM,
    profileId: profile.id,
    profileName: profile.name,
    profileRelation: profile.relation,
    profileVersion: `${profile.id}@v${profile.version}`,
    profileHash: await profileHash(profile),
    profileSnapshot: profile.preferences.map((p) => ({ ...p })),
    item: {
      id: sensory.itemId,
      name: sensory.itemName,
      category: sensory.category,
      jrfHash: jrf?.sourceHash,
      jrfName: jrf?.name,
      jrfVersion: jrf?.version,
      expectedMp6Hash: sensory.kind === "proxy" ? undefined : sensory.sourceHash,
      sensoryKind: sensory.kind,
      synthetic: sensory.synthetic,
      sourceFile: sensory.sourceFile
    },
    sensorySnapshot,
    recipe: jrf ? JSON.parse(JSON.stringify(jrf)) : undefined,
    context: args.context ?? {},
    createdAt: args.now ?? new Date().toISOString(),
    frozen: true
  };
  const fitResultHash = await sha256(canonicalJson(payload));
  const result: FitResult = { ...payload, fitResultHash };
  return deepFreeze(result);
}

export function buildOutcome(args: {
  fit: FitResult;
  hedonic: number;
  sensoryMatch?: Outcome["sensoryMatch"];
  mostDifferent?: string;
  notes?: string;
  observed?: { profile: SensoryProfile; hash: string };
  now?: string;
}): Outcome {
  const li = likingIndex(args.hedonic);
  const o: Outcome = {
    id: uid("out"),
    fitResultId: args.fit.id,
    hedonic: args.hedonic,
    likingIndex: li,
    fitLikingGap: args.fit.fit === null ? NaN : Math.round((li - args.fit.fit) * 10) / 10,
    sensoryMatch: args.sensoryMatch,
    mostDifferent: args.mostDifferent || undefined,
    notes: args.notes?.trim() || undefined,
    createdAt: args.now ?? new Date().toISOString()
  };
  if (args.observed) {
    o.observed = {
      mp6Hash: args.observed.hash,
      sourceFile: args.observed.profile.sourceFile,
      agreement: sensoryAgreement(args.fit.sensorySnapshot, args.observed.profile),
      posthocFit: computeFit(args.fit.profileSnapshot, args.observed.profile).fit
    };
  }
  return deepFreeze(o);
}
