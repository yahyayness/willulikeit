// ---------------------------------------------------------------------------
// ajx-core · guard — failure must degrade, never terminate (brief §29).
//   * environment classification (browser/OS family, viewport class) — no UA string kept
//   * error sanitisation (type, scrubbed message ≤120, file:line frames only)
//   * global onerror / unhandledrejection capture → onFatal + telemetry
//   * safe drafts: versioned, validated, quarantined on crash, debounced
//   * a framework-free recovery surface for static tools
// Nothing here ever reads or transmits user content.
// ---------------------------------------------------------------------------

export const GUARD_VERSION = "ajx-guard@0.1.0";

export function envClass(nav = typeof navigator !== "undefined" ? navigator : null, win = typeof window !== "undefined" ? window : null) {
  const ua = String(nav?.userAgent || "");
  let browser_family = "other";
  if (/; wv\)|FBAN|FBAV|Instagram|TikTok|Line\//i.test(ua)) browser_family = "webview";
  else if (/SamsungBrowser/i.test(ua)) browser_family = "samsung";
  else if (/Edg\//i.test(ua)) browser_family = "edge";
  else if (/Firefox|FxiOS/i.test(ua)) browser_family = "firefox";
  else if (/Chrome|CriOS|Chromium/i.test(ua)) browser_family = "chrome";
  else if (/Safari/i.test(ua)) browser_family = "safari";
  let os_family = "other";
  if (/Android/i.test(ua)) os_family = "android";
  else if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (nav?.maxTouchPoints || 0) > 1)) os_family = "ios";
  else if (/Mac OS X|Macintosh/i.test(ua)) os_family = "macos";
  else if (/Windows/i.test(ua)) os_family = "windows";
  else if (/Linux|CrOS/i.test(ua)) os_family = "linux";
  const w = win?.innerWidth || 0;
  const viewport_class = w === 0 ? "unknown" : w < 380 ? "xs" : w < 640 ? "sm" : w < 1024 ? "md" : "lg";
  return { browser_family, os_family, viewport_class };
}

const SCRUB = [
  [/(["'`])(?:(?!\1).){0,400}\1/g, "$1…$1"],            // quoted content (may contain user text)
  [/https?:\/\/[^\s)]+/g, "<url>"],
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>"],
  [/sk-[A-Za-z0-9_-]{6,}/g, "<key>"],
  [/\b\d{5,}\b/g, "<n>"]
];

export function scrub(s, max = 120) {
  let out = String(s ?? "");
  for (const [rx, rep] of SCRUB) out = out.replace(rx, rep);
  return out.slice(0, max);
}

/** { type, message, frames[] } — frames keep only file basename:line:col. */
export function sanitizeError(err) {
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Non-error thrown");
  const type = e.name && /^[A-Za-z]+$/.test(e.name) ? e.name : "Error";
  const frames = String(e.stack || "")
    .split("\n")
    .map((l) => {
      const m = l.match(/([^\/\s()?#]+\.(?:js|mjs|jsx|ts|tsx|html))(?:\?[^:]*)?:(\d+):(\d+)/);
      return m ? `${m[1]}:${m[2]}:${m[3]}` : null;
    })
    .filter(Boolean)
    .slice(0, 6);
  return { type, message: scrub(e.message), frames };
}

/**
 * Install global capture. Returns an uninstall function.
 * opts: { tool, version, getStep?: () => string, onFatal?: (info) => void, telemetry?: {track} }
 */
export function installGuard(opts = {}) {
  if (typeof window === "undefined") return () => {};
  const report = (err, origin) => {
    const info = { ...sanitizeError(err), origin, step: safeCall(opts.getStep) || null };
    try { opts.telemetry?.track?.("browser_error", { step: info.step, detail: { error_type: info.type, origin, message: info.message, frames: info.frames.join(" | ") } }); } catch { /* never throw from guard */ }
    try { opts.onFatal?.(info); } catch { /* */ }
    return info;
  };
  const onErr = (ev) => report(ev?.error || ev?.message, "onerror");
  const onRej = (ev) => report(ev?.reason, "unhandledrejection");
  window.addEventListener("error", onErr);
  window.addEventListener("unhandledrejection", onRej);
  return () => {
    window.removeEventListener("error", onErr);
    window.removeEventListener("unhandledrejection", onRej);
  };
}

function safeCall(fn) { try { return fn ? fn() : undefined; } catch { return undefined; } }

// ---------------- safe drafts ----------------
function store(kind) {
  try {
    const s = kind === "local" ? window.localStorage : window.sessionStorage;
    const k = "__ajx_probe__";
    s.setItem(k, "1"); s.removeItem(k);
    return s;
  } catch { return null; }
}

/**
 * Load a versioned draft. Returns null (and quarantines) when the draft is
 * unparseable, from another schema, fails `validate`, or was marked as
 * crash-causing by `markDraftCrashed`.
 */
export function loadDraft(key, { schema, validate, storage = "session" } = {}) {
  const s = store(storage);
  if (!s) return null;
  let raw;
  try { raw = s.getItem(key); } catch { return null; }
  if (!raw) return null;
  try {
    if (s.getItem(key + ".crashed") === "1") throw new Error("crash-marked");
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object" || d.__schema !== schema) throw new Error("schema");
    if (validate && !validate(d.state)) throw new Error("shape");
    return d.state;
  } catch {
    quarantineDraft(key, storage);
    return null;
  }
}

export function quarantineDraft(key, storage = "session") {
  const s = store(storage);
  if (!s) return;
  try {
    const raw = s.getItem(key);
    if (raw) s.setItem(key + ".quarantine", raw.slice(0, 200000));
    s.removeItem(key);
    s.removeItem(key + ".crashed");
  } catch { /* */ }
}

/** Called by error boundaries: the next load of this draft will quarantine it. */
export function markDraftCrashed(key, storage = "session") {
  const s = store(storage);
  try { s?.setItem(key + ".crashed", "1"); } catch { /* */ }
}

export function clearDraftCrashMark(key, storage = "session") {
  const s = store(storage);
  try { s?.removeItem(key + ".crashed"); } catch { /* */ }
}

export function saveDraft(key, state, { schema, storage = "session" } = {}) {
  const s = store(storage);
  if (!s) return false;
  try { s.setItem(key, JSON.stringify({ __schema: schema, saved_at: Date.now(), state })); return true; } catch { return false; }
}

/** Debounced saver: returns fn(state). Flushes on pagehide. */
export function draftSaver(key, opts = {}) {
  let t = null, last = null;
  const wait = opts.wait ?? 300;
  const flush = () => { if (last !== null) { saveDraft(key, last, opts); last = null; } if (t) { clearTimeout(t); t = null; } };
  if (typeof window !== "undefined") window.addEventListener("pagehide", flush);
  const fn = (state) => { last = state; if (t) clearTimeout(t); t = setTimeout(flush, wait); };
  fn.flush = flush;
  return fn;
}

// ---------------- recovery surface for static (non-React) tools ----------------
/**
 * Show an in-page recovery panel instead of a dead/blank page.
 * opts: { title, body, actions: [{label, onClick, primary}] }
 */
export function showRecoverySurface(opts = {}) {
  if (typeof document === "undefined") return null;
  let el = document.getElementById("ajx-recovery");
  if (!el) {
    el = document.createElement("div");
    el.id = "ajx-recovery";
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-live", "assertive");
    el.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:560px;margin:0 auto;background:#fffdf7;color:#1d1b16;border:2px solid #c0392b;border-radius:14px;padding:16px 18px;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.35)";
    document.body.appendChild(el);
  }
  el.innerHTML = "";
  const h = document.createElement("strong");
  h.textContent = opts.title || "Something went wrong on this step";
  h.style.cssText = "display:block;font-size:16px;margin-bottom:6px";
  const p = document.createElement("div");
  p.textContent = opts.body || "Nothing you entered was sent anywhere. You can try again or continue another way.";
  const row = document.createElement("div");
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:12px";
  const actions = opts.actions && opts.actions.length ? opts.actions : [{ label: "Reload this tool", primary: true, onClick: () => location.reload() }];
  for (const a of actions) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = a.label;
    b.style.cssText = `min-height:44px;padding:10px 16px;border-radius:10px;font:600 15px system-ui,sans-serif;cursor:pointer;border:2px solid #1d1b16;${a.primary ? "background:#1d1b16;color:#fff" : "background:#fff;color:#1d1b16"}`;
    b.addEventListener("click", () => { try { a.onClick?.(); } catch { /* */ } });
    row.appendChild(b);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Dismiss";
  close.style.cssText = "min-height:44px;padding:10px 12px;border:0;background:transparent;text-decoration:underline;cursor:pointer;font:15px system-ui,sans-serif;color:#1d1b16";
  close.addEventListener("click", () => el.remove());
  row.appendChild(close);
  el.append(h, p, row);
  try { row.querySelector("button")?.focus(); } catch { /* */ }
  return el;
}
