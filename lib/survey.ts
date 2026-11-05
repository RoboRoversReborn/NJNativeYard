import { canonicalReferenceTaxon } from "./taxon-names";
import { getAllPlants, getStatusMeta } from "./plants";
import { storedReferencePhotos } from "./plant-reference-store";
import referencePhotos from "../data/reference-photos.v1.json";
import { sampleYards, sampleYardById } from "./sample-yards";
import { PLANT_IMAGES } from "./recognition/plantImages";
import { PLANTS as extraPlants, KEYSTONE_GENERA } from "./recognition/njPlants";
import {
  enrichNjPlant,
  missingListedPlants,
  NJ_EVIDENCE_VERSION,
  taxonKey,
  profileStatus,
  taxonSearchNames,
  normalizeTaxon,
} from "./nj-evidence";
import type { Plant, PlantStatus } from "./types";
import { applyHorticulture } from "./plant-horticulture";
import { approvedCatalogAdditions } from "./catalog-additions";
import type { ComparisonCaptureContext } from "./observation-comparison";

export type ReferencePhoto = {
  url: string;
  author: string;
  license: string;
  citation?: string;
  source: "PlantNet" | "Wikimedia Commons";
  licenseUrl?: string;
  attributionUrl?: string;
};
export type Candidate = {
  externalProfile?: Plant;
  plantId?: string;
  scientificName: string;
  commonName: string;
  confidence?: number;
  clue?: string;
  referencePhotos?: ReferencePhoto[];
};
export type SurveyPlant = {
  externalProfile?: Plant;
  id: string;
  plantId?: string;
  suggestion: string;
  scientificName: string;
  box: { x: number; y: number; w: number; h: number };
  confidence?: number;
  reviewed: boolean;
  yardScope?: "yard" | "background";
  candidates: Candidate[];
  note?: string;
};
export type Survey = {
  id: string;
  createdAt: string;
  source: "sample" | "upload";
  zip: string;
  photo: string;
  photoMimeType?: "image/jpeg";
  photoFileName?: string;
  plants: SurveyPlant[];
  areaId?: string;
  photoPath?: string;
  revision?: string;
  sampleVersion?: number;
  sampleId?: string;
  assessmentHistory?: ScoreSnapshot[];
  observationNote?: string;
  captureEdits?: {changedAt:string;actorId:string;previous: import("./observation-comparison").ComparisonCaptureContext;next:import("./observation-comparison").ComparisonCaptureContext;note:string}[];
  comparisonEvidenceHistory?: import("./observation-comparison").ComparisonEvidence[];
  capture?: ComparisonCaptureContext;
  uploadedAt?: string;
  savedAt?: string;
  reviewedAt?: string;
};
const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const supplemental = extraPlants as Array<{
  sci: string;
  common: string;
  status: string;
  type: string;
  note?: string;
  subs?: string[];
}>;
const original = getAllPlants();
const names = new Set(original.map((p) => normalize(p.scientificName)));
const added: Plant[] = supplemental
  .filter((p) => !names.has(normalize(p.sci)))
  .map((p, i) => {
    const genus = p.sci.split(" ")[0] as keyof typeof KEYSTONE_GENERA;
    const status: PlantStatus =
      p.status === "invasive"
        ? "invasive"
        : p.status === "native"
          ? genus in KEYSTONE_GENERA
            ? "keystone"
            : "native"
          : "non-native";
    return {
      id: `extended-${i}`,
      commonName: p.common,
      scientificName: p.sci,
      status,
      type:
        (
          {
            tree: "Tree",
            shrub: "Shrub",
            perennial: "Perennial",
            groundcover: "Groundcover",
            vine: "Vine",
            grass: "Grass",
            fern: "Fern",
          } as Record<string, Plant["type"]>
        )[p.type] || "Perennial",
      sun: "Check species requirements",
      moisture: "Check species requirements",
      bloom: "Varies by species",
      height: "Varies by species",
      description:
        (p.status === "na_native"
          ? "Native in parts of North America, but not listed as native to New Jersey in this catalog. "
          : "") +
        (p.note ||
          "An additional species from the NJ identification catalog. Confirm the species and local suitability before planting or removal."),
      lepidoptera: status === "keystone" ? KEYSTONE_GENERA[genus] : undefined,
    };
  });
const curated: Plant[] = [
  {
    id: "cotinus-coggygria",
    commonName: "Smoketree",
    scientificName: "Cotinus coggygria",
    status: "non-native",
    type: "Shrub",
    sun: "Full sun; tolerates partial shade",
    moisture: "Well-drained soil; drought tolerant once established",
    bloom: "Smoky flower clusters in the growing season",
    height: "About 10–15 ft, depending on cultivar",
    description:
      "A deciduous shrub or small tree with rounded leaves and airy, smoke-like flower clusters. Cultivars may have green, purple, or yellow foliage. It can serve as a specimen or informal hedge.",
    swapIds: ["physocarpus-opulifolius", "amelanchier-canadensis"],
  },
];
const profiles: Plant[] = [
  ...original,
  ...added,
  ...curated.filter((p) => !names.has(normalize(p.scientificName))),
];
const existingProfiles = [...profiles, ...missingListedPlants(profiles)];
export const catalog: Plant[] = [
  ...existingProfiles,
  ...approvedCatalogAdditions(existingProfiles),
]
  .map(enrichNjPlant)
  .map(applyHorticulture);
// Map donor replacement names back to the unified catalog without guessing genus status.
for (const plant of catalog.filter((p) => p.id.startsWith("extended-"))) {
  const entry = supplemental.find(
    (p) => normalize(p.sci) === normalize(plant.scientificName),
  );
  plant.swapIds = (entry?.subs || [])
    .map(
      (s) =>
        catalog.find((p) => normalize(p.scientificName) === normalize(s))?.id,
    )
    .filter((id): id is string => Boolean(id));
}
const catalogById = new Map(catalog.map((p) => [p.id, p]));
const catalogByTaxon = new Map(
  catalog.map((p) => [taxonKey(p.scientificName), p]),
);
export const plantById = (id?: string) =>
  id ? catalogById.get(id) : undefined;
export const exactPlant = (name: string) => catalogByTaxon.get(taxonKey(name));
const searchById = new Map(
  catalog.map((plant) => [
    plant.id,
    normalizeTaxon(
      [plant.commonName, ...taxonSearchNames(plant.scientificName)].join(" | "),
    ),
  ]),
);
export function matchesPlantSearch(plant: Plant, query: string): boolean {
  return (
    searchById.get(plant.id) ||
    normalizeTaxon(plant.commonName + " " + plant.scientificName)
  ).includes(normalizeTaxon(query));
}
export const category = (p: Plant) => {
  const meta = getStatusMeta(p);
  if (profileStatus(p) === "unverified")
    return {
      ...meta,
      label: /\bspp?\./i.test(p.scientificName) || p.horticulture?.taxonScope === "genus" ? "Plant not identified" : "NJ status pending",
      short: "Pending",
      description:
        "Botanical identity and NJ ecological status are separate. This taxon needs NJ-specific corroboration before it contributes to the score.",
      action: "Check NJ evidence",
      color: "var(--category-unverified)",
      soft: "color-mix(in srgb, var(--category-unverified) 6%, white)",
      border: "var(--category-unverified)",
    };
  if (!p.njEvidence) return meta;
  return {
    ...meta,
    label: p.njEvidence.invasiveStatus
      ? `NJISST ${p.njEvidence.invasiveStatus.toLowerCase()} invasive`
      : p.njEvidence.legalListed
        ? "NJDA listed invasive"
        : p.status === "non-native"
          ? "Non-native"
          : meta.label,
    description:
      p.status === "non-native"
        ? "A non-native catalog match. Non-native status alone does not establish invasiveness or safety."
        : p.njEvidence.invasiveStatus
          ? "Listed for ecological concern in New Jersey by the NJ Invasive Species Strike Team."
          : meta.description,
  };
};
export const SCORE_VERSION = "species-mix-v4-mild-nonnative";
export type ScoreSnapshot = {
  version: typeof SCORE_VERSION | "species-mix-v3-signed" | "species-mix-v1" | "species-mix-v2" | "species-mix-v2-scope";
  catalogVersion?: string;
  recordedAt: string;
  score: number | null;
  nativeShare: number | null;
  assessed: number;
  total: number;
  reviewed: number;
  coverage: number;
  provisional: boolean;
  fingerprint: string;
  assessmentScope?: "photo" | "yard" | "illustrative";
  scopeProvisional?: boolean;
  scope?: { yard: number; background: number; unconfirmed: number };
  rawScore?: number | null;
};
/** Reference-only fallback: full evidence inventory, never the garden recommendation catalog. */
export function referencePlant(scientificName: string, commonName = scientificName): Plant | undefined {
  const canonicalName = canonicalReferenceTaxon(scientificName);
  if (!canonicalName) return undefined;
  return enrichNjPlant({ id: `reference:${normalizeTaxon(canonicalName)}`, commonName, scientificName: canonicalName, status: "non-native", type: "Unknown", sun: "", moisture: "", height: "", bloom: "", description: "", apiOnly: true });
}
export const resolvedPlant = (plant: SurveyPlant) =>
  plantById(plant.plantId) || exactPlant(plant.scientificName) ||
  (plant.externalProfile?.apiOnly && normalizeTaxon(plant.externalProfile.scientificName) === normalizeTaxon(plant.scientificName) ? { ...enrichNjPlant(plant.externalProfile), description: plant.externalProfile.description } : referencePlant(plant.scientificName, plant.suggestion));
export const assessablePlant = (region: SurveyPlant) => {
  const plant = resolvedPlant(region);
  return plant && profileStatus(plant) !== "unverified" ? plant : undefined;
};
export const regionStatus = (plant: SurveyPlant) =>
  assessablePlant(plant)?.status || "unverified";
/** Pending verification is not a fifth ecological category. */
export function pendingPlantLabel(region: SurveyPlant): "NJ status pending" | "Plant not identified" | "Not yet in our NJ catalog" {
  const plant = resolvedPlant(region);
  if (!plant && canonicalReferenceTaxon(region.scientificName)) return "Not yet in our NJ catalog";
  return plant && !/\bspp?\./i.test(plant.scientificName) && plant.horticulture?.taxonScope !== "genus"
    ? "NJ status pending" : "Plant not identified";
}
export const SCORE_WEIGHTS = {
  keystone: 100,
  native: 85,
  "non-native": -5,
  invasive: -50,
};
type AssessmentInput = Pick<Survey, "plants"> & Partial<Pick<Survey, "source">>;
export function assessmentScope(survey: AssessmentInput) {
  const real = survey.source === "upload";
  const background = survey.plants.filter(
    (p) => p.yardScope === "background",
  ).length;
  const yard = survey.plants.filter(
    (p) => p.yardScope === "yard" || (!real && p.yardScope !== "background"),
  ).length;
  const unconfirmed = real
    ? survey.plants.filter((p) => !p.yardScope).length
    : 0;
  const mode = !real
    ? "illustrative"
    : yard > 0 || !unconfirmed
      ? "yard"
      : "photo";
  const plants = survey.plants.filter((p) =>
    real
      ? mode === "photo"
        ? !p.yardScope
        : p.yardScope === "yard"
      : p.yardScope !== "background",
  );
  return {
    plants,
    mode,
    counts: { yard, background, unconfirmed },
    provisional: real && unconfirmed > 0,
  };
}
export function summary(survey: AssessmentInput) {
  const scope = assessmentScope(survey);
  const counts: Record<PlantStatus | "unverified", number> = {
    keystone: 0,
    native: 0,
    "non-native": 0,
    invasive: 0,
    unverified: 0,
  };
  const species = new Map<string, Plant>();
  let reviewed = 0;
  for (const region of scope.plants) {
    const plant = assessablePlant(region);
    if (region.reviewed) reviewed++;
    if (plant) {
      counts[plant.status]++;
      species.set(plant.scientificName.toLowerCase(), plant);
    } else counts.unverified++;
  }
  const total = scope.plants.length,
    assessed = total - counts.unverified;
  const knownSpecies = [...species.values()];
  const nativeSpecies = knownSpecies.filter(
    (p) => p.status === "native" || p.status === "keystone",
  );
  const weights = SCORE_WEIGHTS;
  const mix = knownSpecies.length
    ? knownSpecies.reduce((sum, p) => sum + weights[p.status], 0) /
      knownSpecies.length
    : 0;
  // The signed invasive weight already supplies the stronger negative term.
  const invasivePenalty = 0;
  const keystoneBonus = knownSpecies.some((p) => p.status === "keystone")
    ? 5
    : 0;
  const diversityBonus = nativeSpecies.length >= 3 ? 5 : 0;
  const rawScore = assessed ? mix + keystoneBonus + diversityBonus : null;
  const score = rawScore !== null
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(rawScore),
        ),
      )
    : null;
  const grade =
    score === null
      ? "A closer look will help"
      : scope.mode === "yard" && scope.provisional
        ? "An incomplete yard view"
        : scope.mode === "photo"
          ? "Your photo’s starting point"
          : assessed / Math.max(1, total) < 0.5
            ? "A first glimpse"
            : score >= 80
              ? "A thriving foundation"
              : score >= 60
                ? "Growing habitat"
                : score >= 40
                  ? "Room to grow"
                  : "Big opportunity";
  return {
    version: SCORE_VERSION,
    rawScore,
    assessmentScope: scope.mode as "photo" | "yard" | "illustrative",
    scope: scope.counts,
    scopeProvisional: scope.provisional,
    counts,
    reviewed,
    total,
    assessed,
    unknown: counts.unverified,
    reviewPending: total - reviewed,
    coverage: total ? Math.round((assessed / total) * 100) : 0,
    provisional:
      scope.provisional ||
      reviewed < total ||
      counts.unverified > 0 ||
      knownSpecies.some((p) => !p.njEvidence?.sources.length),
    nativeShare: assessed
      ? Math.round(((counts.native + counts.keystone) / assessed) * 100)
      : null,
    invasiveShare: assessed
      ? Math.round((counts.invasive / assessed) * 100)
      : null,
    speciesCount: knownSpecies.length,
    score,
    grade,
    breakdown: {
      mix: Math.round(mix * 10) / 10,
      invasivePenalty,
      keystoneBonus,
      diversityBonus,
    },
  };
}
export function scoreContributions(survey: AssessmentInput) {
  const stats = summary(survey);
  const species = [
    ...new Map(
      assessmentScope(survey)
        .plants.map(assessablePlant)
        .filter((p): p is Plant => !!p)
        .map((p) => [p.scientificName.toLowerCase(), p]),
    ).values(),
  ];
  const entries = (
    Object.keys(stats.counts) as (PlantStatus | "unverified")[]
  ).map((status) => {
    const base =
      status === "unverified" || !species.length
        ? 0
        : (species.filter((p) => p.status === status).length *
            SCORE_WEIGHTS[status]) /
          species.length;
    const points = base === 0 ? 0 : base;
    return {
      status,
      count: stats.counts[status],
      regionShare: stats.total ? (stats.counts[status] / stats.total) * 100 : 0,
      points,
    };
  });
  const bonuses =
    stats.breakdown.keystoneBonus + stats.breakdown.diversityBonus;
  return {
    entries,
    bonuses,
    adjustment:
      stats.score === null
        ? 0
        : stats.score - entries.reduce((sum, e) => sum + e.points, 0) - bonuses,
  };
}
export function scoreSnapshot(
  survey: Survey,
  recordedAt = new Date().toISOString(),
): ScoreSnapshot {
  const stats = summary(survey);
  return {
    version: SCORE_VERSION,
    catalogVersion: NJ_EVIDENCE_VERSION,
    recordedAt,
    score: stats.score,
    nativeShare: stats.nativeShare,
    assessed: stats.assessed,
    total: stats.total,
    reviewed: stats.reviewed,
    coverage: stats.coverage,
    provisional: stats.provisional,
    rawScore: stats.rawScore,
    assessmentScope: stats.assessmentScope,
    scopeProvisional: stats.scopeProvisional,
    scope: stats.scope,
    fingerprint: JSON.stringify([
      NJ_EVIDENCE_VERSION,
      survey.source,
      stats.assessmentScope,
      survey.plants
        .map((p) => [
          p.id,
          resolvedPlant(p)?.id || p.scientificName,
          p.reviewed,
          p.yardScope || null,
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ]),
  };
}
export function withScoreSnapshot(survey: Survey): Survey {
  const snapshot = scoreSnapshot(survey),
    history = survey.assessmentHistory || [];
  return history.at(-1)?.fingerprint === snapshot.fingerprint &&
    history.at(-1)?.version === SCORE_VERSION
    ? survey
    : { ...survey, assessmentHistory: [...history, snapshot] };
}
export function savedAssessment(survey: Survey) {
  const latest = survey.assessmentHistory?.at(-1);
  if (latest && !latest.assessmentScope && survey.source === "upload")
    return {
      ...summary(survey),
      ...latest,
      rawScore: latest.rawScore ?? null,
      assessmentScope: "photo" as const,
      provisional: true,
      scopeProvisional: true,
      scope: { yard: 0, background: 0, unconfirmed: latest.total },
    };
  return { ...summary(survey), ...latest, rawScore: latest ? latest.rawScore ?? null : summary(survey).rawScore };
}
export function scanComparison(surveys: Survey[], areaId: string) {
  return surveys
    .filter(
      (s) =>
        s.areaId === areaId && s.source === "upload" && s.plants.length > 0,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((survey) => ({
      survey,
      ...savedAssessment(survey),
    }));
}
export function exampleSurvey(zip = "08902", sampleId = "front-yard"): Survey {
  const sample = sampleYardById(sampleId) || sampleYards[0];
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: "sample",
    sampleVersion: 6,
    sampleId: sample.id,
    zip,
    photo: sample.photo,
    plants: structuredClone(sample.plants).map((p) => ({
      ...p,
      reviewed: false,
    })) as SurveyPlant[],
  };
}
export function normalizeBox(box: number[]) {
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v))) return null;
  const [y1, x1, y2, x2] = box.map((v) => Math.max(0, Math.min(1000, v)) / 10);
  return x2 > x1 && y2 > y1 ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null;
}
export const specimenPhoto = (scientificName: string) =>
  (PLANT_IMAGES as Record<string, string>)[scientificName] || null;

export function refreshSampleSurvey(survey: Survey): Survey {
  return survey.source === "sample" && survey.sampleVersion !== 6
    ? {
        ...exampleSurvey(survey.zip, survey.sampleId),
        id: survey.id,
        createdAt: survey.createdAt,
        areaId: survey.areaId,
      }
    : survey;
}

export const catalogReferences = (scientificName: string): ReferencePhoto[] => {
  const local = storedReferencePhotos(scientificName);
  return local.length ? local : (referencePhotos as Record<string, ReferencePhoto[]>)[scientificName.trim().replace(/\s+/g, " ")] || [];
};

