import type { Plant, PlantHorticulture } from "./types";

export type ExplanationTopic =
  "recognition" | "growing" | "habitat" | "seasonal";
export type ExplanationFact = {
  field: string;
  label: string;
  values: string[];
};
export type PlantExplanation = {
  topic: ExplanationTopic;
  title: string;
  summaryFields: string[];
  lead: string;
  limitation: string;
  facts: ExplanationFact[];
  source: PlantHorticulture["source"];
  sourceTaxon: string;
  genusOnly: boolean;
};
const definitions: Record<
  ExplanationTopic,
  {
    title: string;
    summaryFields: string[];
    lead: string;
    limitation: string;
    fields: [string, string][];
  }
> = {
  recognition: {
    title: "What to look for",
    summaryFields: [
      "LeafShape",
      "LeafMargin",
      "FlowerColor",
      "FlowerBloomTime",
    ],
    lead: "Compare these botanical features together with the referenced taxon. The profile describes a plant, rather than verifying the identity in your photograph.",
    limitation:
      "A single feature does not confirm an identification. Compare more than one feature with a close-up photo.",
    fields: [
      ["Family", "Botanical family"],
      ["LifeCycle", "Life cycle"],
      ["LeafCharacteristics", "Foliage characteristics"],
      ["LeafArrangement", "Leaf arrangement"],
      ["LeafType", "Leaf type"],
      ["LeafShape", "Leaf shape"],
      ["LeafMargin", "Leaf margin"],
      ["LeafColor", "Leaf colour"],
      ["LeafFeel", "Leaf surface"],
      ["LeafLength", "Leaf length"],
      ["LeafWidth", "Leaf width"],
      ["HairsPresent", "Hairs present"],
      ["FlowerColor", "Flower colour"],
      ["FlowerShape", "Flower shape"],
      ["FlowerInflorescence", "Flower inflorescence"],
      ["FlowerBloomTime", "Flowering season"],
      ["FruitType", "Fruit type"],
      ["FruitColor", "Fruit colour"],
      ["StemColor", "Stem colour"],
      ["StemCrossSection", "Stem cross-section"],
      ["Appendage", "Appendages"],
    ],
  },
  growing: {
    title: "Growing conditions in the reference",
    summaryFields: ["Width", "SoilDrainage"],
    lead: "The source lists cultural conditions and dimensions for this taxon. These describe general growing requirements, not a site assessment of your New Jersey yard.",
    limitation:
      "General horticultural conditions are separate from NJ nativity, conservation notes and local suitability.",
    fields: [
      ["Light", "Light exposure"],
      ["Height", "Mature height"],
      ["Width", "Mature spread"],
      ["GrowthHabit", "Growth habit"],
      ["GrowthRate", "Growth rate"],
      ["SoilDrainage", "Soil drainage"],
      ["SoilTexture", "Soil texture"],
      ["SoilPH", "Soil pH"],
      ["HardinessZones", "Source hardiness range"],
      ["Maintenance", "Maintenance level"],
    ],
  },
  habitat: {
    title: "Habitat & life around this plant",
    summaryFields: ["Attracts"],
    lead: "The reference records origin, landscape settings and wildlife associations. These are source-described relationships and contexts, not observations of wildlife in this yard or proof of NJ native status.",
    limitation:
      "Source-reported associations, rather than a count of wildlife supported by this individual plant or yard. Origin and garden settings do not establish NJ native status.",
    fields: [
      ["Attracts", "Reported wildlife associations"],
      [
        "Origin",
        "Source-described origin",
      ],
      [
        "LandscapeLocation",
        "Landscape settings in the source",
      ],
      [
        "LandscapeTheme",
        "Landscape themes in the source",
      ],
    ],
  },
  seasonal: {
    title: "A little more to notice",
    summaryFields: ["FlowerBloomTime", "FruitDisplayTime"],
    lead: "The source’s seasonal observations describe reported flowering, fruit display and autumn foliage. They are seasonal descriptions, not an NJ-specific calendar or a pruning and control schedule.",
    limitation:
      "Seasonal windows come from the general reference; timing in your NJ yard can vary by site and weather. Use separately sourced advice for care or control.",
    fields: [
      ["FlowerBloomTime", "Reported bloom season"],
      ["FlowerColor", "Flower colour"],
      [
        "FruitDisplayTime",
        "Reported fruit display",
      ],
      ["FruitType", "Fruit type"],
      ["FruitColor", "Fruit colour"],
      ["LeafFallColor", "Autumn foliage colour"],
    ],
  },
};

/** Exact documented source values; disclosure never rewrites facts or infers care. */
export function plantExplanation(
  plant: Plant,
  topic: ExplanationTopic,
): PlantExplanation | null {
  const profile = plant.horticulture;
  if (!profile) return null;
  const definition = definitions[topic];
  const facts = definition.fields.flatMap(([field, label]) => {
    const values = [...new Set(profile.attributes[field] || [])];
    return values.length ? [{ field, label, values }] : [];
  });
  return {
    ...definition,
    topic,
    facts,
    source: { ...profile.source },
    sourceTaxon: profile.sourceTaxon,
    genusOnly: profile.taxonScope === "genus",
  };
}

export const BOTANICAL_TERM_SOURCE = {
  label: "Oregon State University botanical glossary",
  url: "https://landscapeplants.oregonstate.edu/glossary",
};
// General term definitions are separately attributed; they add no species-level observation.
const termHelp: Record<string, string> = {
  Alternate: "One leaf attaches at each stem node.",
  Opposite: "Two leaves attach at the same stem node.",
  Entire: "The leaf edge has no teeth.",
  Serrate: "The edge has forward-pointing, saw-like teeth.",
  Simple: "The leaf blade is not divided into separate leaflets.",
  Compound: "The leaf is divided into distinct leaflets.",
  Ovate: "An egg-like outline, wider toward its base.",
  Obovate: "An egg-like outline, wider toward its tip.",
  Cuneate: "A wedge-like outline narrowing toward its base.",
  Linear: "Long and narrow, with roughly parallel sides.",
  Lanceolate: "A narrow, lance-like outline, widest below the middle.",
  Cordate: "A heart-like outline with a notch at its base.",
  Raceme: "Flowers form an elongated, unbranched cluster.",
  Panicle: "Flowers form a branched cluster.",
};
export function botanicalTermHelp(fact: ExplanationFact) {
  if (
    ![
      "LeafArrangement",
      "LeafMargin",
      "LeafType",
      "LeafShape",
      "FlowerInflorescence",
    ].includes(fact.field)
  )
    return [];
  return fact.values.flatMap((term) =>
    termHelp[term] ? [{ term, meaning: termHelp[term] }] : [],
  );
}
