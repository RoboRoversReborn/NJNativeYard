import datasetJson from "@/data/nj-flora.v1.json";
import type {
  NjDataset,
  NjDeerResistance,
  NjNursery,
  NjPlantRecord,
  NjPlantStatus,
  NjReplacement,
  Plant,
  PlantStatus,
  Region,
} from "./types";

const dataset = datasetJson as NjDataset;

const removalById = new Map(
  dataset.removalProtocols.map((protocol) => [protocol.id, protocol]),
);
const replacementsByTarget = new Map<string, NjReplacement[]>();
const regionByZip = new Map(dataset.regions.map((region) => [region.zip, region]));
const countyByName = new Map(
  dataset.counties.map((county) => [county.name.toLowerCase(), county]),
);
const synonymMap = new Map(
  dataset.synonyms.map((entry) => [normalizePlantName(entry.synonym), entry.acceptedPlantId]),
);

for (const replacement of dataset.replacements) {
  const list = replacementsByTarget.get(replacement.targetPlantId) ?? [];
  list.push(replacement);
  replacementsByTarget.set(replacement.targetPlantId, list);
}

for (const list of replacementsByTarget.values()) {
  list.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.priority === "high" && b.priority !== "high" ? -1 : 1;
  });
}

const NJ_STATUS_LABELS: Record<NjPlantStatus, string> = {
  NATIVE_KEYSTONE: "NJ keystone native",
  NATIVE: "NJ native",
  NON_NATIVE_BENIGN: "Non-native · low risk",
  INVASIVE_REGULATED: "NJ regulated invasive",
  INVASIVE_WATCHLIST: "NJ watchlist invasive",
};

const STATUS_RANK: Record<PlantStatus, number> = {
  keystone: 0,
  native: 1,
  "non-native": 2,
  invasive: 3,
};

function toPlant(record: NjPlantRecord): Plant {
  const removal = record.removalProtocolId
    ? removalById.get(record.removalProtocolId)
    : undefined;

  return {
    id: record.id,
    commonName: record.commonName,
    scientificName: record.scientificName,
    status: record.status,
    type: record.type,
    sun: record.sun,
    moisture: record.moisture,
    bloom: record.bloom,
    height: record.height,
    description: record.description,
    lepidoptera: record.lepidoptera || undefined,
    swapIds: getSwapIds(record.id),
    removal: removal
      ? {
          method: removal.method,
          timing: removal.timing,
          safety: removal.safety,
          disposal: removal.disposal,
        }
      : undefined,
    njStatus: record.njStatus,
    njStatusLabel: getNjStatusLabel(record.njStatus),
    growthHabit: record.growthHabit,
    deerResistance: record.deerResistance,
    specialistBeeSupport: record.specialistBeeSupport,
    bloomMonths: record.bloomMonths,
    matureHeightFt: record.matureHeightFt,
    ornamentalFeatures: record.ornamentalFeatures,
  };
}

const plants = dataset.plants.map(toPlant);
const plantById = new Map(plants.map((plant) => [plant.id, plant]));

export const NJ_DATASET = dataset;
export const NJ_DATA_VERSION = dataset.meta.version;
export const NJ_DATA_META = dataset.meta;
export const NJ_COUNTIES = dataset.counties;
export const NJ_NURSERIES = dataset.nurseries;

export function getNjStatusLabel(status: NjPlantStatus): string {
  return NJ_STATUS_LABELS[status] ?? status;
}

export function getPlant(id: string): Plant | undefined {
  return plantById.get(id);
}

export function getPlants(ids: string[]): Plant[] {
  return ids
    .map((id) => plantById.get(id))
    .filter((plant): plant is Plant => Boolean(plant));
}

export function getAllPlants(): Plant[] {
  return plants;
}

export function getSwapIds(plantId: string): string[] {
  return (replacementsByTarget.get(plantId) ?? [])
    .map((replacement) => replacement.substitutePlantId)
    .filter((id, index, list) => list.indexOf(id) === index);
}

export function getSwapReason(plantId: string): string | undefined {
  return replacementsByTarget.get(plantId)?.[0]?.matchReason;
}

export function getReplacements(plantId: string): NjReplacement[] {
  return replacementsByTarget.get(plantId) ?? [];
}

export function findPlantCandidates(name: string): Plant[] {
  const normalized = normalizePlantName(name);
  if (!normalized) return [];

  const exact = plants.find(
    (plant) =>
      normalizePlantName(plant.scientificName) === normalized ||
      normalizePlantName(plant.commonName) === normalized,
  );
  if (exact) return [exact];

  const synonymId = synonymMap.get(normalized);
  if (synonymId) {
    const synonymPlant = plantById.get(synonymId);
    if (synonymPlant) return [synonymPlant];
  }

  const speciesMatches = plants.filter((plant) =>
    normalizePlantName(plant.scientificName).startsWith(`${normalized} `),
  );
  if (speciesMatches.length) return speciesMatches;

  const genus = normalized.split(" ")[0];
  const genusMatches = plants
    .filter(
      (plant) =>
        normalizePlantName(plant.scientificName).split(" ")[0] === genus ||
        normalizePlantName(plant.commonName).split(" ")[0] === genus,
    )
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  if (genusMatches.length) return genusMatches;

  return plants.filter((plant) =>
    normalizePlantName(plant.commonName).includes(normalized),
  );
}

export function findPlantByScientificName(name: string): Plant | undefined {
  return findPlantCandidates(name)[0];
}

export function getNurseries(county?: string): NjNursery[] {
  const normalizedCounty = county?.toLowerCase();
  const exact = normalizedCounty
    ? dataset.nurseries.filter(
        (nursery) => nursery.county.toLowerCase() === normalizedCounty,
      )
    : [];
  const statewide = dataset.nurseries.filter((nursery) =>
    ["statewide", "regional"].includes(nursery.county.toLowerCase()),
  );
  const others = dataset.nurseries.filter(
    (nursery) =>
      !exact.some((item) => item.id === nursery.id) &&
      !statewide.some((item) => item.id === nursery.id),
  );

  return [...exact, ...statewide, ...others];
}

export function getCounty(name: string) {
  return countyByName.get(name.trim().toLowerCase());
}

export function isNjZip(rawZip: string): boolean {
  const zip = String(rawZip ?? "").replace(/\D/g, "").slice(0, 5);
  if (zip.length !== 5) return false;
  const numeric = Number(zip);
  return numeric >= 7000 && numeric <= 8999;
}

export function regionForZip(rawZip: string): Region {
  const zip = String(rawZip ?? "").replace(/\D/g, "").slice(0, 5) || "07645";
  const exact = regionByZip.get(zip);

  if (exact) {
    return {
      ...exact,
      isNj: true,
      isEstimate: false,
    };
  }

  if (isNjZip(zip)) {
    return {
      zip,
      zone: "6b",
      ecoregion: "New Jersey statewide baseline",
      ecoregionCode: "EPA Level III 64/84",
      city: "New Jersey",
      state: "NJ",
      county: "New Jersey",
      province: "Statewide",
      soilPh: "Mixed NJ soils",
      isNj: true,
      isEstimate: true,
      notice:
        "We do not have a county-level match for this ZIP yet. Using a statewide NJ baseline; try a nearby ZIP for a more precise province.",
    };
  }

  return {
    zip,
    zone: "6b",
    ecoregion: "Outside New Jersey",
    ecoregionCode: "",
    city: "Outside New Jersey",
    state: "",
    county: "",
    province: "",
    soilPh: "",
    isNj: false,
    isEstimate: true,
    notice:
      "NativeYard NJ is calibrated for New Jersey ZIP codes (070–089). Choose an NJ ZIP to use the local ecological data.",
  };
}

export function normalizePlantName(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/['’][^'’]*['’]/g, " ")
    .replace(/\b(spp|sp|var|cv|subsp)\.?\b/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function deerResistanceLabel(value?: NjDeerResistance): string {
  if (value === "HIGH") return "High deer resistance";
  if (value === "LOW") return "Deer often browse";
  if (value === "MODERATE") return "Moderate deer resistance";
  return "Deer resistance unknown";
}
