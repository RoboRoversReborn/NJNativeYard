import dataset from "../data/plant-horticulture.v1.json";
import type { Plant, PlantHorticulture } from "./types";

export const HORTICULTURE_VERSION = dataset.version;
const profiles = dataset.records as Record<string, PlantHorticulture>;
const readable = (values?: string[]) => values?.join(" · ");

function heightRange(value?: string): [number, number] | undefined {
  if (!value) return undefined;
  const values = [
    ...value.matchAll(/(\d+(?:\.\d+)?) ft\.\s*(?:(\d+(?:\.\d+)?) in\.)?/g),
  ].map((m) => Number(m[1]) + Number(m[2] || 0) / 12);
  return values.length === 2 ? [values[0], values[1]] : undefined;
}

export function applyHorticulture(plant: Plant): Plant {
  const profile = profiles[plant.id];
  // Seed wildlife counts and support flags were not sourced species facts.
  // Preserve the original files as history, not as active quantified claims.
  const cleaned = {
    ...plant,
    horticulture: undefined,
    lepidoptera: undefined,
    specialistBeeSupport: undefined,
    deerResistance: undefined,
    bloomMonths: undefined,
    matureHeightFt: undefined,
    growthHabit: undefined,
    ornamentalFeatures: undefined,
  };
  if (!profile)
    return {
      ...cleaned,
      type: "Unknown",
      description: `${plant.commonName} (${plant.scientificName}) is included for identification and comparison. Detailed appearance and care information await a matched horticultural reference.`,
      sun: "Light requirements not yet sourced",
      moisture: "Soil moisture and drainage not yet sourced",
      bloom: "Bloom timing not yet sourced",
      height: "Mature height not yet sourced",
    };
  const a = profile.attributes;
  const sourceTypes = (a.PlantType || []).map((value) => value.toLowerCase());
  const lifeCycles = a.LifeCycle || [];
  const variableLifeCycle =
    lifeCycles.includes("Biennial") ||
    (lifeCycles.includes("Annual") && lifeCycles.includes("Perennial"));
  const type =
    sourceTypes.includes(plant.type.toLowerCase()) && plant.type !== "Perennial"
      ? plant.type
      : sourceTypes.includes("tree")
        ? "Tree"
        : sourceTypes.includes("shrub")
          ? "Shrub"
          : variableLifeCycle
            ? "Herb"
            : (sourceTypes.includes("annual") ||
                  lifeCycles.includes("Annual")) &&
                !lifeCycles.includes("Perennial")
              ? "Annual"
              : sourceTypes.includes("perennial") ||
                  sourceTypes.includes("herbaceous perennial") ||
                  lifeCycles.includes("Perennial")
                ? "Perennial"
                : "Unknown";
  return {
    ...cleaned,
    horticulture: profile,
    type,
    sun:
      readable(a.Light) || "Light requirements not supplied by matched source",
    moisture:
      readable(a.SoilDrainage) ||
      "Soil drainage not supplied by matched source",
    bloom:
      readable(a.FlowerBloomTime) || "Bloom season not supplied by this source",
    height:
      readable(a.Height) || "Mature height not supplied by matched source",
    matureHeightFt: heightRange(a.Height?.[0]),
  };
}
