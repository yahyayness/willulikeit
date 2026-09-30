// ---------------------------------------------------------------------------
// ajx-core · studios-bar — the slim, additive "AJX STUDIOS · [tool]" frame and
// the single registry of Classic / Pro tools (brief §14, §24).
// It never replaces a tool's own header or identity: it prepends a 40px bar.
// ---------------------------------------------------------------------------

export const AJX_STUDIOS_URL_DEFAULT = "https://studio.ajinomatrix.com";

export function studiosUrl() {
  try {
    if (typeof window !== "undefined" && typeof window.AJX_STUDIOS_URL === "string") return window.AJX_STUDIOS_URL.replace(/\/$/, "");
  } catch { /* */ }
  return AJX_STUDIOS_URL_DEFAULT;
}

/** One registry used by the shell's Classic page, the bar and the portals. */
export const CLASSIC_TOOLS = Object.freeze([
  { id: "jrf-studio", group: "Recipes (JRF)", name: "JRF Studio", url: "https://jrf.recipes", does: "Extract a recipe from a video or page, view, validate and convert .jrf files", reads: ".jrf · .json · 9 legacy recipe dialects", writes: ".jrf · AJNV4.3 .json", step: "extract", status: "live" },
  { id: "recorder", group: "Sensory (MP6)", name: "MP6 Recorder", url: "https://record.mp6.app", does: "Predict an Expected MP6 from a JRF, or record a real tasting (Observed MP6)", reads: ".jrf", writes: "Expected .mp6 · Observed .mp6", step: "sensory", status: "live" },
  { id: "converter", group: "Sensory (MP6)", name: "MP6 Converter", url: "https://convert.mp6.app", does: "Turn panel spreadsheets into .mp6", reads: ".xlsx · .csv · .ods", writes: ".mp6", step: "sensory", status: "live" },
  { id: "viewer", group: "Sensory (MP6)", name: "MP6 Viewer", url: "https://viewer.mp6.app", does: "Read any .mp6 at a glance", reads: ".mp6 (all dialects)", writes: "—", step: "sensory", status: "live" },
  { id: "validator", group: "Sensory (MP6)", name: "MP6 Validator", url: "https://validate.mp6.app", does: "Check identity & compatibility of an .mp6", reads: ".mp6", writes: ".validated.mp6", step: "sensory", status: "live" },
  { id: "player", group: "Sensory (MP6)", name: "MP6 Player", url: "https://player.mp6.app", does: "Play the timeline of a tasting", reads: ".mp6", writes: ".mp6", step: "interpret", status: "live" },
  { id: "report", group: "Sensory (MP6)", name: "MP6 Report", url: "https://report.mp6.app", does: "Human-readable sensory report and share card", reads: ".mp6", writes: "summary .json", step: "interpret", status: "live" },
  { id: "compare", group: "Sensory (MP6)", name: "MP6 Compare", url: "https://compare.mp6.app", does: "Compare two .mp6 files", reads: ".mp6", writes: "—", step: "interpret", status: "source-pending", note: "Unaudited — source pending; preserved unchanged" },
  { id: "willulikeit", group: "Fit", name: "WillULikeIT", url: "https://willulikeit.vercel.app", does: "Personal Sensory Fit between a taste profile and an Expected MP6", reads: ".mp6 · .jrf", writes: "fit export .json · brief .md", step: "predict_fit", status: "live" },
  { id: "feelllm", group: "Interpret", name: "FEELLLM", url: "https://feelllm.org", does: "Turn how it felt into a Feeling Brief for your AI", reads: ".mp6", writes: "brief .md", step: "interpret", status: "live" },
  { id: "mp6-portal", group: "Hubs", name: "MP6 Studio portal", url: "https://mp6.app", does: "The MP6 open sensory format and its tools", reads: "—", writes: "—", step: null, status: "live" },
  { id: "ajinoverse-hub", group: "Hubs", name: "Ajinoverse hub", url: "https://ajinoverse.org", does: "Federation hub: TT-P, AJNV, heritage tools", reads: "—", writes: "—", step: null, status: "live" }
]);

const BAR_CSS = `
#ajx-studios-bar{all:initial;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-sizing:border-box;width:100%;min-height:40px;padding:6px 14px;
 background:#14120f;color:#f4efe4;font:600 12px/1.2 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.06em;position:relative;z-index:2147482000}
#ajx-studios-bar *{box-sizing:border-box;font:inherit;letter-spacing:inherit}
#ajx-studios-bar .ajx-mark{display:inline-flex;align-items:center;gap:8px;color:#f4efe4;text-decoration:none;text-transform:uppercase}
#ajx-studios-bar .ajx-dots{display:inline-flex;gap:3px}
#ajx-studios-bar .ajx-dots i{display:block;width:6px;height:6px;border-radius:50%}
#ajx-studios-bar .ajx-tool{color:#c9c1b1;text-transform:uppercase}
#ajx-studios-bar .ajx-sp{flex:1}
#ajx-studios-bar a.ajx-link{color:#f4efe4;text-decoration:none;border:1px solid #4a443b;border-radius:999px;padding:6px 12px;min-height:30px;display:inline-flex;align-items:center;letter-spacing:.02em;font-weight:600}
#ajx-studios-bar a.ajx-link:hover,#ajx-studios-bar a.ajx-link:focus-visible{border-color:#f4efe4;outline:none}
#ajx-studios-bar a.ajx-link.primary{background:#f4efe4;color:#14120f;border-color:#f4efe4}
@media print{#ajx-studios-bar{display:none}}`;

export const STEP_COLORS = Object.freeze({ extract: "#2f9e6f", sensory: "#e8742c", predict_fit: "#9b5de5", interpret: "#3a86ff", adapt: "#e63946" });

/**
 * mountStudiosBar({ tool: "MP6 Player", toolId: "player", step?: "interpret" })
 * Idempotent; safe before or after DOMContentLoaded.
 */
export function mountStudiosBar(opts = {}) {
  if (typeof document === "undefined") return null;
  const run = () => {
    if (document.getElementById("ajx-studios-bar")) return document.getElementById("ajx-studios-bar");
    const base = studiosUrl();
    if (!document.getElementById("ajx-studios-bar-css")) {
      const st = document.createElement("style");
      st.id = "ajx-studios-bar-css";
      st.textContent = BAR_CSS;
      document.head.appendChild(st);
    }
    const bar = document.createElement("nav");
    bar.id = "ajx-studios-bar";
    bar.setAttribute("aria-label", "AJX Studios");
    const mark = document.createElement("a");
    mark.className = "ajx-mark";
    mark.href = base + "/";
    const dots = document.createElement("span");
    dots.className = "ajx-dots";
    dots.setAttribute("aria-hidden", "true");
    for (const c of Object.values(STEP_COLORS)) { const i = document.createElement("i"); i.style.background = c; dots.appendChild(i); }
    const name = document.createElement("span");
    name.textContent = "AJX Studios";
    mark.append(dots, name);
    const sep = document.createElement("span");
    sep.className = "ajx-tool";
    sep.textContent = "· " + (opts.tool || document.title || "Tool");
    const sp = document.createElement("span");
    sp.className = "ajx-sp";
    const guided = document.createElement("a");
    guided.className = "ajx-link primary";
    guided.href = base + "/#/guided";
    guided.textContent = "Guided workflow";
    const classic = document.createElement("a");
    classic.className = "ajx-link";
    classic.href = base + "/#/classic";
    classic.textContent = "All tools";
    bar.append(mark, sep, sp, guided, classic);
    document.body.insertBefore(bar, document.body.firstChild);
    return bar;
  };
  if (document.body) return run();
  document.addEventListener("DOMContentLoaded", run, { once: true });
  return null;
}
