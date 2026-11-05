import additions from "../data/catalog-expansion/approved-additions.v1.json";
import horticulture from "../data/plant-horticulture.v1.json";
import { enrichNjPlant, profileStatus, taxonKey } from "./nj-evidence";
import type { Plant, PlantHorticulture } from "./types";

export type AdmissionRecord = Omit<Plant, "status" | "type"> & {
  status: string;
  type: string;
  admission: {
    status: string;
    purpose: "garden" | "recognition";
    checkedOn: string;
    gardenEvidence: null | { url: string; sourceName: string };
    regionalEvidence: {
      scientificName: string;
      url: string;
      role: "native" | "listed-non-native";
      conservationExcluded: boolean;
    };
    horticulture: { plantId: string; source: PlantHorticulture["source"] };
    plantNet: {
      status: string;
      project: string;
      providerTaxon: { id: string; scientificNameWithoutAuthor: string };
      checkedOn: string;
      inventorySha256: string;
      matchRule: string;
    };
  };
};
const records = additions.records as unknown as AdmissionRecord[];
const care = horticulture.records as Record<string, PlantHorticulture>;
export const CATALOG_ADMISSION_POLICY = additions.policy;

export function additionPassesGate(record: AdmissionRecord): boolean {
  const proof = record.admission,
    profile = care[record.id],
    a = profile?.attributes;
  const same = (name: string) =>
    taxonKey(name) === taxonKey(record.scientificName);
  const has = (keys: string[]) => keys.some((key) => a?.[key]?.length);
  if (
    proof.status !== "approved" ||
    !["garden", "recognition"].includes(proof.purpose) ||
    proof.plantNet.status !== "matched" ||
    proof.plantNet.project !== "k-world-flora"
  )
    return false;
  if (
    !proof.plantNet.providerTaxon.id ||
    !same(proof.plantNet.providerTaxon.scientificNameWithoutAuthor) ||
    !proof.plantNet.checkedOn ||
    !/^[a-f0-9]{64}$/.test(proof.plantNet.inventorySha256)
  )
    return false;
  if (
    !proof.regionalEvidence.url ||
    !same(proof.regionalEvidence.scientificName)
  )
    return false;
  if (
    !profile ||
    profile.taxonScope === "genus" ||
    !same(profile.sourceTaxon) ||
    !same(profile.requestedTaxon || profile.sourceTaxon) ||
    profile.source.sha256 !== proof.horticulture.source.sha256 ||
    profile.source.url !== proof.horticulture.source.url
  )
    return false;
  if (
    !has(["PlantType", "GrowthHabit", "LifeCycle"]) ||
    !has([
      "LeafShape",
      "LeafType",
      "LeafMargin",
      "LeafArrangement",
      "LeafCharacteristics",
      "LeafFallColor",
      "FlowerShape",
      "FlowerColor",
      "FlowerBloomTime",
      "FruitType",
      "FruitColor",
      "StemColor",
      "BarkDescription",
    ])
  )
    return false;
  const plant = enrichNjPlant(record as Plant),
    role = profileStatus(plant);
  if (
    proof.regionalEvidence.role === "native" &&
    !plant.njEvidence?.sources.some(
      (source) => source.url === proof.regionalEvidence.url,
    )
  )
    return false;
  if (
    proof.regionalEvidence.role === "listed-non-native" &&
    (plant.njEvidence?.native === true || !plant.njEvidence?.sources.length)
  )
    return false;
  if (proof.purpose === "garden") {
    return (
      !!proof.gardenEvidence?.url &&
      same(proof.gardenEvidence.sourceName) &&
      !proof.regionalEvidence.conservationExcluded &&
      !plant.njEvidence?.doNotPlant &&
      ["native", "keystone"].includes(role) &&
      !!a.Light?.length &&
      !!a.SoilDrainage?.length &&
      record.landscapeContext?.recommendation !== "recognition-only"
    );
  }
  return record.landscapeContext?.recommendation === "recognition-only";
}

export function approvedCatalogAdditions(existing: Plant[]): Plant[] {
  const names = new Set(existing.map((p) => taxonKey(p.scientificName))),
    ids = new Set(existing.map((p) => p.id));
  return records
    .filter((record) => {
      const key = taxonKey(record.scientificName);
      if (names.has(key) || ids.has(record.id) || !additionPassesGate(record))
        return false;
      names.add(key);
      ids.add(record.id);
      return true;
    })
    .map((record): Plant => {
      const { admission, ...plant } = record;
      return {
        ...plant,
        status: record.status as Plant["status"],
        type: record.type as Plant["type"],
        providerCoverage: {
          provider: "PlantNet",
          project: admission.plantNet.project,
          taxonId: admission.plantNet.providerTaxon.id,
          scientificName:
            admission.plantNet.providerTaxon.scientificNameWithoutAuthor,
          checkedOn: admission.plantNet.checkedOn,
          matchRule: admission.plantNet.matchRule,
          inventorySha256: admission.plantNet.inventorySha256,
        },
      };
    });
}
