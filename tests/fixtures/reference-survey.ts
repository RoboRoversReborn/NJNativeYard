import reference from "../../data/reference-samples.v1.json";
import type { Survey } from "../../lib/survey";
/** Controlled six-region composition for component/math tests; not the active public samples. */
export function legacySurvey(zip = "08902"): Survey {
  const sample = reference[0];
  return {
    id: crypto.randomUUID(),
    createdAt: "2026-06-01T12:00:00Z",
    source: "sample",
    sampleVersion: 5,
    sampleId: sample.id,
    zip,
    photo: sample.photo,
    plants: structuredClone(sample.plants).map((p) => ({
      ...p,
      reviewed: false,
    })),
  };
}
