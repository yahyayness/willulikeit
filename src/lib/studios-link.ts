// Gate 3: links to studio.ajinomatrix.com follow the runtime override window.AJX_STUDIOS_URL
// (set only on preview deployments). No-op in production (override unset).
export function installStudiosLinkOverride(): void {
  const D = "https://studio.ajinomatrix.com";
  const u = () => String((window as unknown as { AJX_STUDIOS_URL?: string }).AJX_STUDIOS_URL || "").replace(/\/$/, "");
  document.addEventListener("click", (e) => {
    const o = u();
    const a = (e.target as Element | null)?.closest?.(`a[href^="${D}"]`) as HTMLAnchorElement | null;
    if (!a || !o || o === D) return;
    e.preventDefault();
    const t = o + (a.getAttribute("href") || "").slice(D.length);
    if (a.target === "_blank") window.open(t, "_blank", "noopener"); else window.location.href = t;
  }, true);
}
