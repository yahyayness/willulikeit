import { ATTR_BY_ID, DIM_HEX, attrLabel } from "../lib/vocab";
import type { FitReason } from "../lib/types";

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0f1113" />
      <circle cx="16" cy="16" r="10" fill="#d6f24c" opacity=".16" />
      <circle cx="16" cy="16" r="6.5" fill="#d6f24c" opacity=".3" />
      <circle cx="16" cy="16" r="3.8" fill="#d6f24c" />
      <path d="M9 23.5 L16 16 L23 23.5" stroke="#d6f24c" strokeOpacity=".35" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function Fireflies() {
  return (
    <>
      <i className="firefly" style={{ top: "18%", right: "12%" }} />
      <i className="firefly f2" style={{ top: "42%", right: "28%" }} />
      <i className="firefly f3" style={{ top: "12%", left: "58%" }} />
    </>
  );
}

/** Circular dial; the arc glows like a firefly when the fit is high. */
export function Dial({ fit, coverage }: { fit: number | null; coverage: number }) {
  const R = 78,
    C = 2 * Math.PI * R,
    sweep = 0.78; // 280° arc
  const frac = fit === null ? 0 : fit / 100;
  const color = fit === null ? "#555" : fit >= 65 ? "#d6f24c" : fit >= 50 ? "#f0c64a" : "#f08a6a";
  return (
    <div className="dial" aria-label={fit === null ? "No fit computable" : `Personal Sensory Fit ${Math.round(fit)} out of 100`}>
      <svg viewBox="0 0 184 184">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform="rotate(129 92 92)">
          <circle cx="92" cy="92" r={R} fill="none" stroke="#21252b" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${C * sweep} ${C}`} />
          <circle
            cx="92"
            cy="92"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${C * sweep * frac} ${C}`}
            filter={fit !== null && fit >= 65 ? "url(#glow)" : undefined}
            style={{ transition: "stroke-dasharray .9s cubic-bezier(.2,.8,.2,1)" }}
          />
          {/* coverage — thin inner arc */}
          <circle cx="92" cy="92" r={R - 14} fill="none" stroke="#21252b" strokeWidth="3" strokeDasharray={`${2 * Math.PI * (R - 14) * sweep} 999`} />
          <circle cx="92" cy="92" r={R - 14} fill="none" stroke="#7fd0db" strokeWidth="3" strokeDasharray={`${2 * Math.PI * (R - 14) * sweep * coverage} 999`} />
        </g>
      </svg>
      <div className="num">
        <b>{fit === null ? "—" : Math.round(fit)}</b>
        <span>/ 100 FIT</span>
      </div>
    </div>
  );
}

/** Twin radar: your stated ideal vs the item's profile, on compared attributes only. */
export function Radar({ compared, itemLabel = "this item" }: { compared: FitReason[]; itemLabel?: string }) {
  const n = compared.length;
  if (n < 3) return <p className="small">The radar needs at least three shared attributes — see the lines on the right.</p>;
  const cx = 150,
    cy = 150,
    R = 104;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => [cx + (R * v * Math.cos(ang(i))) / 10, cy + (R * v * Math.sin(ang(i))) / 10];
  const poly = (key: "user_preference" | "predicted") => compared.map((c, i) => pt(i, c[key]).join(",")).join(" ");
  return (
    <div className="radar">
      <svg viewBox="-46 -6 392 312" role="img" aria-label="Radar comparing your ideal with the item's sensory profile">
        {[2, 4, 6, 8, 10].map((r) => (
          <polygon key={r} points={compared.map((_, i) => pt(i, r).join(",")).join(" ")} fill="none" stroke="#2c3138" strokeWidth={r === 10 ? 1.2 : 0.7} />
        ))}
        {compared.map((c, i) => {
          const [x, y] = pt(i, 10);
          const [lx, ly] = pt(i, 12.4);
          const hex = DIM_HEX[ATTR_BY_ID[c.attribute]?.dim ?? "taste"];
          return (
            <g key={c.attribute}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#2c3138" strokeWidth="0.7" />
              <text x={lx} y={ly} fill={hex} fontSize="10" fontFamily="ui-monospace, monospace" textAnchor={Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end"} dominantBaseline="middle">
                {shortLabel(c.label)}
              </text>
            </g>
          );
        })}
        <polygon points={poly("predicted")} fill="rgba(127,208,219,.16)" stroke="#7fd0db" strokeWidth="1.8" />
        <polygon points={poly("user_preference")} fill="rgba(214,242,76,.10)" stroke="#d6f24c" strokeWidth="2" strokeDasharray="5 4" />
        {compared.map((c, i) => {
          const [x, y] = pt(i, c.user_preference);
          return <circle key={c.attribute} cx={x} cy={y} r="3" fill="#d6f24c" />;
        })}
      </svg>
      <div className="legend">
        <span>
          <i style={{ borderColor: "#d6f24c", borderTopStyle: "dashed" }} />
          your ideal
        </span>
        <span>
          <i style={{ borderColor: "#7fd0db" }} />
          {itemLabel}
        </span>
      </div>
    </div>
  );
}

function shortLabel(l: string) {
  return l.replace(" notes", "").replace("Aroma intensity", "Aroma").replace("Taste intensity", "Intensity").replace("Long finish", "Finish").replace(" / snap", "").replace(" / richness", "");
}

/** One line per compared attribute: ring = your ideal, dot = the item. */
export function DeltaRows({ compared }: { compared: FitReason[] }) {
  const rows = [...compared].sort((a, b) => b.weighted - a.weighted);
  return (
    <div className="deltas">
      {rows.map((c) => {
        const hex = DIM_HEX[ATTR_BY_ID[c.attribute]?.dim ?? "taste"];
        const lo = Math.min(c.user_preference, c.predicted) * 10;
        const hi = Math.max(c.user_preference, c.predicted) * 10;
        return (
          <div className="drow" key={c.attribute}>
            <div className="lab">
              <span>{attrLabel(c.attribute)}</span>
              <span className="w">
                {fmt(c.user_preference)} → {fmt(c.predicted)} · w{c.importance}
              </span>
            </div>
            <div className="dtrack">
              <div className="base" />
              <div className="gap" style={{ left: `${lo}%`, width: `${hi - lo}%`, background: c.abs > 1.5 ? "#f0c64a" : "#d6f24c" }} />
              <div className="ideal" style={{ left: `${c.user_preference * 10}%` }} title={`your ideal ${c.user_preference}`} />
              <div className="item" style={{ left: `${c.predicted * 10}%`, background: hex }} title={`item ${c.predicted}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Personal Sensory Fit index vs rescaled liking index — exploratory until calibrated. */
export function CalibrationPlot({ points }: { points: { x: number; y: number; label: string }[] }) {
  const W = 300,
    H = 220,
    P = 30;
  const sx = (v: number) => P + ((W - P - 10) * v) / 100;
  const sy = (v: number) => H - P - ((H - P - 10) * v) / 100;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 420 }} role="img" aria-label="Personal Sensory Fit index versus rescaled liking index">
      <rect x={P} y={10} width={W - P - 10} height={H - P - 10} fill="#fffdf8" stroke="#e0d8c7" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(100)} y2={sy(100)} stroke="#b9b1a0" strokeDasharray="4 4" />
      {[0, 50, 100].map((t) => (
        <g key={t}>
          <text x={sx(t)} y={H - 12} fontSize="9" textAnchor="middle" fill="#8e8676" fontFamily="ui-monospace">
            {t}
          </text>
          <text x={P - 6} y={sy(t) + 3} fontSize="9" textAnchor="end" fill="#8e8676" fontFamily="ui-monospace">
            {t}
          </text>
        </g>
      ))}
      <text x={(W + P) / 2} y={H - 1} fontSize="9.5" textAnchor="middle" fill="#5c554a">
        fit index
      </text>
      <text x={9} y={(H - P) / 2} fontSize="9.5" textAnchor="middle" fill="#5c554a" transform={`rotate(-90 9 ${(H - P) / 2})`}>
        liking index
      </text>
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="5" fill="#55650c" fillOpacity=".75" stroke="#fffdf8">
          <title>{p.label}</title>
        </circle>
      ))}
    </svg>
  );
}
