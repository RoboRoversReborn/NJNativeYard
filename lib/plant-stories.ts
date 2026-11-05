import dataset from "../data/plant-stories.v1.json";
import type { Plant, PlantHorticulture } from "./types";

export type PlantStoryRecord = {
  sourceTaxon: string;
  opening: string;
  recognitionCue: string;
  nextObservation: string;
  source: PlantHorticulture["source"];
  scope: string;
  evidence: { field: string; values: string[] }[];
};

export const PLANT_STORIES_VERSION = dataset.version;
const records = dataset.records as Record<string, PlantStoryRecord>;
const normalize = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

/** Curated stories fail closed if their matched taxon or source facts change. */
export function plantStory(plant: Plant): PlantStoryRecord | undefined {
  const story = records[plant.id];
  const profile = plant.horticulture;
  if (
    !story ||
    !profile ||
    profile.taxonScope === "genus" ||
    normalize(plant.scientificName) !== normalize(story.sourceTaxon) ||
    normalize(profile.sourceTaxon) !== normalize(story.sourceTaxon) ||
    profile.source.url !== story.source.url ||
    profile.source.sha256 !== story.source.sha256 ||
    !story.evidence.every(({ field, values }) =>
      values.every((value) => profile.attributes[field]?.includes(value)),
    )
  )
    return undefined;
  return {
    ...story,
    source: { ...story.source },
    evidence: story.evidence.map(({ field, values }) => ({
      field,
      values: [...values],
    })),
  };
}
