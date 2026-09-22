// ---------------------------------------------------------------------------
// WillULikeIT preference vocabulary.
// Every preference attribute IS an MP6 Product Profile v0.1.1 canonical
// attribute (dimension + attribute name). We never invent a parallel scale:
// the user's "ideal" lives on the same 0–10 axis the Expected MP6 uses.
// Aliases follow the MP6 alias policy `canonicalize_with_original_preserved`:
// the source attribute name is kept alongside the canonical one.
// ---------------------------------------------------------------------------

export type Dimension = "sight" | "smell" | "taste" | "touch" | "sound" | "intuition";

export interface AttrDef {
  id: string; // MP6 canonical attribute
  dim: Dimension;
  label: string;
  question: string;
  low: string;
  high: string;
  aliases: string[];
  core?: boolean; // shown in quick onboarding
}

export const ATTRS: AttrDef[] = [
  { id: "sweetness", dim: "taste", label: "Sweetness", question: "How sweet do you like it?", low: "barely sweet", high: "very sweet", aliases: ["sweet"], core: true },
  { id: "bitterness", dim: "taste", label: "Bitterness", question: "How much bitterness do you enjoy?", low: "no bitterness", high: "intensely bitter", aliases: ["bitter"], core: true },
  { id: "sourness", dim: "taste", label: "Acidity", question: "How much sourness or acidity?", low: "flat, soft", high: "sharp, tangy", aliases: ["acidity", "acid", "sour", "tartness"], core: true },
  { id: "spicy", dim: "smell", label: "Warm spice", question: "Warm spices — clove, cinnamon, ginger, pepper?", low: "none", high: "loads", aliases: ["spice", "heat", "spiciness"], core: true },
  { id: "roasted", dim: "smell", label: "Roasted notes", question: "Roasted, toasted, caramelised aromas?", low: "none", high: "deeply roasted", aliases: ["roast", "toasted", "roastiness"], core: true },
  { id: "fruity", dim: "smell", label: "Fruity notes", question: "Fruity aromas — berry, citrus, stone fruit?", low: "none", high: "bursting", aliases: ["fruit", "fruitiness"], core: true },
  { id: "creaminess", dim: "touch", label: "Creaminess", question: "Creamy, smooth, melting textures?", low: "lean, dry", high: "very creamy", aliases: ["creamy", "smoothness_creamy"], core: true },
  { id: "crispness", dim: "touch", label: "Crunch / snap", question: "Crunch, crispness, a clean snap?", low: "soft", high: "very crunchy", aliases: ["crunch", "snap", "crunchiness"], core: true },
  { id: "odor_intensity", dim: "smell", label: "Aroma intensity", question: "How intense should the aroma be?", low: "discreet", high: "powerful", aliases: ["aroma_intensity", "smell_intensity"], core: true },
  { id: "aftertaste_length", dim: "taste", label: "Long finish", question: "How long should the taste linger?", low: "short, clean", high: "very long", aliases: ["aftertaste", "finish", "persistence", "finish_length"], core: true },
  { id: "taste_intensity", dim: "taste", label: "Taste intensity", question: "Overall strength of taste?", low: "delicate", high: "bold", aliases: ["intensity", "flavor_intensity", "flavour_intensity"] },
  { id: "saltiness", dim: "taste", label: "Saltiness", question: "How salty?", low: "unsalted", high: "salty", aliases: ["salty", "salt"] },
  { id: "umami", dim: "taste", label: "Umami", question: "Savoury, brothy depth?", low: "none", high: "deeply savoury", aliases: ["savory", "savoury"] },
  { id: "nutty", dim: "smell", label: "Nutty notes", question: "Nutty aromas — hazelnut, almond?", low: "none", high: "very nutty", aliases: ["nut", "nuttiness"] },
  { id: "floral", dim: "smell", label: "Floral notes", question: "Floral aromas — jasmine, rose, violet?", low: "none", high: "very floral", aliases: ["flower", "flowery"] },
  { id: "odor_complexity", dim: "smell", label: "Complexity", question: "Layered, complex aromas?", low: "simple", high: "very complex", aliases: ["complexity", "aroma_complexity"] },
  { id: "body", dim: "touch", label: "Body / richness", question: "Full-bodied, rich mouthfeel?", low: "light", high: "very full", aliases: ["body_richness", "richness", "mouthfeel_body"] },
  { id: "astringency_dryness", dim: "touch", label: "Astringency", question: "Drying, grippy astringency?", low: "none", high: "very drying", aliases: ["astringency", "dryness", "astringent"] }
];

export const ATTR_BY_ID: Record<string, AttrDef> = Object.fromEntries(ATTRS.map((a) => [a.id, a]));

const ALIAS_INDEX: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const a of ATTRS) {
    m[norm(a.id)] = a.id;
    for (const al of a.aliases) m[norm(al)] = a.id;
  }
  return m;
})();

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

/** Canonical WULIT/MP6 attribute id for a source attribute name, or null. */
export function canonicalAttr(source: string): string | null {
  return ALIAS_INDEX[norm(source)] ?? null;
}

export function attrLabel(id: string): string {
  return ATTR_BY_ID[id]?.label ?? id.replace(/_/g, " ");
}

// MP6 Studio dimension hues (shared with record.mp6.app / viewer.mp6.app).
export const DIM_HEX: Record<Dimension, string> = {
  taste: "#d9a520",
  smell: "#3f9aa8",
  touch: "#c9784f",
  sight: "#9aa23a",
  sound: "#6570c4",
  intuition: "#9a62c4"
};
