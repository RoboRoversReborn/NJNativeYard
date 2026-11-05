import data from "../data/reference-samples.v6.json";
import type { SurveyPlant } from "./survey";
export type SampleYard = {
  id: string;
  title: string;
  description: string;
  photo: string;
  sourceUrl: string;
  credit: string;
  licenseUrl?: string;
  photoWidth?: number;
  photoHeight?: number;
  imageKind?: "generated-illustration" | "source-photograph";
  photoAlt?: string;
  fixtureVersion?: number;
  evidence?: {
    origin?: string;
    intendedSpeciesNotIdentifications?: boolean;
    imageSha256?: string | null;
    provisional?: boolean;
    illustrativePlanEstimateOnly?: boolean;
    photoEstimateOnly?: boolean;
    computedScore?: number | null;
  };
  plants: SurveyPlant[];
};
export const sampleYards = data as SampleYard[];
export const sampleYardById = (id?: string) =>
  sampleYards.find((sample) => sample.id === id);
