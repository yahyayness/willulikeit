// SHA-256 helpers (Web Crypto — works in browsers and Node ≥ 19).

export async function sha256(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Canonical JSON: sorted keys, no whitespace — stable input for hashing. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(",")}}`;
}

export function uid(prefix: string): string {
  const r = globalThis.crypto.getRandomValues(new Uint8Array(6));
  return `${prefix}_${Date.now().toString(36)}${Array.from(r, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as any)) deepFreeze(v);
  }
  return o;
}
