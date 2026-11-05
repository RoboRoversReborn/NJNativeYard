import dataset from "../data/plant-actions.v1.json";

export type PlantActionRecord = {
  kind: "observe" | "care" | "control";
  title: string;
  season: string;
  detail: string;
  source: { label: string; url: string; checkedOn: string; sha256?: string };
  scope: string;
  evidence: {
    basis: "explicit-source-advice" | "source-phenology";
    sourceField: string;
  };
  identificationRequired: boolean;
};

export const PLANT_ACTIONS_VERSION = dataset.version;
export const PLANT_ACTIONS_COVERAGE = dataset.coverage;
const records = dataset.records as Record<string, PlantActionRecord[]>;

/** Only curated source-backed actions; generic fallback belongs to the UI. */
export function curatedPlantActions(plantId: string): PlantActionRecord[] {
  return (records[plantId] || []).map((action) => ({
    ...action,
    source: { ...action.source },
    evidence: { ...action.evidence },
  }));
}
