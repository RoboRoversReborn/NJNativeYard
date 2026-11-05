import { canonicalReferenceTaxon, referenceTaxonKey } from "./taxon-names";
import originOverrides from "../data/nj-origin-overrides.v1.json";
import data from "../data/nj-evidence.v2.json";
import taxonomy from "../data/nj-taxonomy-aliases.v1.json";
import horticulture from "../data/plant-horticulture.v1.json";
import type { Plant, PlantHorticulture, PlantStatus } from "./types";

export const NJ_EVIDENCE_VERSION = `${data.version}/horticulture:${horticulture.version}/taxonomy:${taxonomy.version}/origin:${originOverrides.version}/rules:2026-11-05.1`;
export const NJ_EVIDENCE_SOURCES = data.sources;
export const normalizeTaxon = (name: string) =>
  referenceTaxonKey(name) ?? name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/×/g, " x ")
    .replace(/\bssp\./g, "subsp.")
    .replace(/\s+/g, " ")
    .trim();
const aliases = new Map(
  taxonomy.aliases.map((a) => [normalizeTaxon(a.from), normalizeTaxon(a.to)]),
);
// Equivalences are explicit audited records. A different source heading alone
// must never create a taxonomic alias or collapse a parent species/subspecies.
export function taxonKey(name: string): string {
  let key = normalizeTaxon(name);
  const seen = new Set<string>();
  while (aliases.has(key) && !seen.has(key)) {
    seen.add(key);
    key = aliases.get(key)!;
  }
  return key;
}
export function taxonSearchNames(name: string): string[] {
  const key = taxonKey(name);
  return [
    ...new Set([
      normalizeTaxon(name),
      key,
      ...[...aliases.keys()].filter((alias) => taxonKey(alias) === key),
    ]),
  ];
}
function index<T extends { scientificName: string }>(rows: T[]) {
  return new Map(rows.map((r) => [taxonKey(r.scientificName), r]));
}
const nativeIndex = index(data.native),
  programIndex = index(data.nativeProgram),
  floraIndex = index(data.flora),
  invasiveIndex = index(data.invasive),
  watchIndex = index(data.watch);
const keystoneIndex = new Map(
  data.keystoneGenera.map((r) => [r.genus.toLowerCase(), r]),
);
const care = horticulture.records as Record<string, PlantHorticulture>;
const legalIndex = index(
  data.legal
    .filter((r) => r.scientificName !== "Phyllostachys species")
    .map((r) => ({
      ...r,
      scientificName: r.subspecies
        ? `${r.scientificName} var. brevipedunculata`
        : r.scientificName,
    })),
);
const nativeKeys = [...nativeIndex.keys(), ...programIndex.keys()];
const source = (key: keyof typeof data.sources) => ({
  label: data.sources[key].title,
  url: data.sources[key].url,
});

function foreignOrigin(profile?: PlantHorticulture) {
  const origins = profile?.attributes.Origin;
  if (!origins?.length) return false;
  const text = origins.join(" ");
  // Explicit Central/South American origin is outside NJ. Do not interpret a
  // general American/US range or absence from an NJ list as introduced origin.
  if (origins.every((origin) => /^(?:central|south|central and south) america$/i.test(origin.trim()))) return true;
  // Positive foreign-origin wording is evidence; missing NJ or a broad US
  // range is not. These deliberately conservative rules leave ambiguity open.
  return (
    /\b(asia|europe|africa|australia|japan|china|korea|taiwan|mediterranean|new zealand)\b/i.test(
      text,
    ) &&
    !/\b(america|united states|u\.?s\.?a?|canada|mexico|caribbean|worldwide|cosmopolitan)\b/i.test(
      text,
    )
  );
}

export function profileStatus(plant: Plant): PlantStatus | "unverified" {
  return plant.njEvidence?.assessmentStatus || plant.status;
}

export function enrichNjPlant(plant: Plant): Plant {
  const key = taxonKey(plant.scientificName),
    genus = key.split(" ")[0];
  const originOverride = originOverrides.records.find(record => taxonKey(record.scientificName) === key);
  const native = nativeIndex.get(key),
    program = programIndex.get(key),
    flora = floraIndex.get(key),
    invasive = invasiveIndex.get(key),
    watch = watchIndex.get(key);
  const legal =
    legalIndex.get(key) ||
    (genus === "phyllostachys"
      ? data.legal.find((r) => r.scientificName === "Phyllostachys species")
      : undefined);
  const careProfile = care[plant.id] || (plant.apiOnly && plant.referenceDetails ? { sourceTaxon: plant.scientificName, taxonScope: "species-or-hybrid" as const, attributes: plant.referenceDetails.facts, source: { ...plant.referenceDetails.source, sha256: "", scope: "Exact species labelled reference fields" } } : undefined);
  const foreign = foreignOrigin(careProfile);
  const nativeProof = !!native || !!program || originOverride?.njOrigin === "native";
  const mixed = flora?.originCode === "NI";
  const introduced = flora?.originCode === "I" || foreign || originOverride?.njOrigin === "non-native";
  const nativeLineage =
    (invasive || legal) &&
    nativeKeys.some(
      (n) => n.startsWith(key + " subsp.") || n.startsWith(key + " var."),
    );
  const conflict =
    (nativeProof && (!!invasive || !!legal || introduced)) || !!nativeLineage;
  const uncertainName =
    !canonicalReferenceTaxon(plant.scientificName) ||
    careProfile?.taxonScope === "genus";
  let assessment: PlantStatus | "unverified" = "unverified";
  if (!conflict && !uncertainName) {
    if (invasive || legal) assessment = "invasive";
    else if (nativeProof && !mixed)
      assessment = keystoneIndex.has(genus) ? "keystone" : "native";
    else if (introduced && !mixed) assessment = "non-native";
  }
  const status = assessment === "unverified" ? plant.status : assessment;
  const references: { label: string; url: string }[] = [];
  if (originOverride) references.push(originOverride.source);
  if (native) references.push(source("native"));
  if (program) references.push(source("nativeProgram"));
  if (flora) references.push(source("flora"));
  if (invasive) references.push(source("invasive"));
  if (watch) references.push(source("watch"));
  if (legal) references.push(source("legal"));
  if (foreign && careProfile)
    references.push({
      label: `${careProfile.source.label} · explicit foreign origin`,
      url: careProfile.source.url,
    });
  if (assessment === "keystone") references.push(source("keystone"));
  let note = conflict
    ? "Sources or native and introduced lineages overlap under this name. Confirm the exact taxon or subspecies; this unresolved category earns no ecological score points."
    : assessment === "unverified"
      ? "NJ ecological category remains unverified. A botanical profile or broad US-native code does not establish NJ nativity; this entry earns no ecological score points."
      : assessment === "invasive"
        ? `${invasive ? `NJISST lists this species as ${invasive.invasiveStatus.toLowerCase()}.` : "Listed in NJDA statutory invasive-plant guidance."} ${legal ? "Also on the NJDA statutory list; restrictions are phased in and cultivar exemptions can apply." : "An ecological listing does not itself establish a legal prohibition."}`
        : assessment === "non-native"
          ? "Introduced origin is corroborated. No established invasive listing was matched in the imported lists; this does not establish safety."
          : `The exact taxon is corroborated by an independent NJ-native reference.${assessment === "keystone" ? " Its genus is listed by NWF for Ecoregion 8; this is genus-level evidence, not a species-specific wildlife count." : ""}`;
  if (native?.doNotPlant)
    note += ` NJDEP conservation flag: ${native.conservationNote}. Excluded from routine native planting choices.`;
  if (watch)
    note +=
      " NJISST watch status is uncertain; it is kept separate from established invasion or a legal ban.";
  const originStatus =
    conflict || mixed
      ? "mixed origin"
      : nativeProof
        ? "NJ native"
        : introduced || invasive || legal
          ? "introduced"
          : "unresolved";
  return {
    ...plant,
    status,
    njStatus: undefined,
    njStatusLabel:
      assessment === "unverified"
        ? "NJ status pending"
        : assessment === "invasive"
          ? invasive
            ? `NJISST ${invasive.invasiveStatus.toLowerCase()} invasive`
            : "NJDA listed invasive"
          : assessment === "keystone"
            ? "Keystone native genus"
            : assessment === "native"
              ? "NJ native"
              : "Non-native · not listed invasive",
    ...(assessment !== "unverified" && status !== plant.status
      ? {
          description: `${plant.commonName} (${plant.scientificName}). ${note}`,
        }
      : {}),
    njEvidence: {
      checkedOn: originOverride?.checkedOn || data.checkedOn,
      native: assessment === "unverified" ? null : nativeProof ? true : false,
      invasiveStatus: invasive?.invasiveStatus,
      watchStatus: watch?.watchStatus,
      legalListed: !!legal,
      doNotPlant:
        !!native?.doNotPlant || !!invasive || !!watch || !!legal || conflict,
      ecoregions: native?.ecoregions || [],
      sources: references,
      note,
      assessmentStatus: assessment,
      originStatus,
      floraOriginCode: flora?.originCode,
      keystoneScope:
        assessment === "keystone" ? keystoneIndex.get(genus)?.scope : undefined,
      taxonConflict: conflict,
    },
  };
}

export function nativePlantingOption(plant: Plant) {
  if (plant.apiOnly) return false;
  return (
    (profileStatus(plant) === "native" ||
      profileStatus(plant) === "keystone") &&
    plant.njEvidence?.native === true &&
    !plant.njEvidence.doNotPlant &&
    plant.landscapeContext?.recommendation !== "recognition-only"
  );
}

// Preserve the ten pre-existing added statutory profiles and their IDs. The
// larger reference corpus is not promoted to thousands of garden profiles.
export function missingListedPlants(existing: Plant[]): Plant[] {
  const keys = new Set(existing.map((p) => taxonKey(p.scientificName)));
  return data.legal
    .filter(
      (r) =>
        r.scientificName !== "Phyllostachys species" &&
        !keys.has(taxonKey(r.scientificName)),
    )
    .map((r) => ({
      id: `nj-listed-${normalizeTaxon(r.scientificName).replace(/[^a-z]+/g, "-")}`,
      scientificName: r.scientificName,
      commonName: r.commonName,
      status: "invasive" as const,
      type:
        ({ Tree: "Tree", Shrub: "Shrub", Vine: "Vine", Herb: "Herb" } as const)[
          invasiveIndex.get(taxonKey(r.scientificName))?.growthForm as
            "Tree" | "Shrub" | "Vine" | "Herb"
        ] || "Unknown",
      sun: "Check species requirements",
      moisture: "Check species requirements",
      bloom: "Check species profile",
      height: "Check species profile",
      description:
        "A species listed by NJDA. Confirm identification and consult species-specific NJ guidance before acting.",
    }));
}
