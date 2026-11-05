import fs from "node:fs";
import references from "../data/nj-evidence.v2.json";
import baseline from "../data/catalog-expansion/baseline-249.v1.json";
import guide from "../data/catalog-expansion/garden-guide-screen.v1.json";
import { catalog } from "../lib/survey";
import { taxonKey } from "../lib/nj-evidence";

const coverage = JSON.parse(
  fs.readFileSync(
    "docs/evidence/plantnet-nj-candidate-coverage.v1.json",
    "utf8",
  ),
) as { matches: { requestedScientificName: string; status: string }[] };
const provider = new Map(
  coverage.matches.map((row) => [
    taxonKey(row.requestedScientificName),
    row.status,
  ]),
);
const countBy = (values: string[]) =>
  values.reduce<Record<string, number>>(
    (counts, key) => ((counts[key] = (counts[key] || 0) + 1), counts),
    {},
  );
const baselineKeys = new Set(
  baseline.profiles.map((p) => taxonKey(p.scientificName)),
);
const currentKeys = new Set(catalog.map((p) => taxonKey(p.scientificName)));
const flora = new Map(
  references.flora.map((p) => [taxonKey(p.scientificName), p]),
);
const invasive = new Map(
  references.invasive.map((p) => [taxonKey(p.scientificName), p]),
);
const watch = new Map(
  references.watch.map((p) => [taxonKey(p.scientificName), p]),
);
const program = new Set(
  references.nativeProgram.map((p) => taxonKey(p.scientificName)),
);
const keystone = new Set(
  references.keystoneGenera.map((p) => p.genus.toLowerCase()),
);
const garden = new Map(
  guide.chartTaxa.map((p) => [taxonKey(p.canonicalName), p]),
);
const coreChecked = new Set(guide.coreCheckedCandidateNames.map(taxonKey));
const eligible = references.native.filter((p) => !p.doNotPlant);
const groups = new Map<string, typeof eligible>();
for (const row of eligible) {
  const key = taxonKey(row.scientificName);
  groups.set(key, [...(groups.get(key) || []), row]);
}
const candidates = [...groups.entries()].map(([key, rows]) => {
  const row = rows[0],
    origin = flora.get(key)?.originCode;
  const flags = [
    ...(origin === "NI"
      ? ["mixed broader-origin code; exact local taxon needs review"]
      : []),
    ...(invasive.has(key)
      ? ["NJ native / established-invasive source conflict"]
      : []),
    ...(watch.has(key) ? ["uncertain ecological watch listing"] : []),
    ...(/\bx\b|×/i.test(row.scientificName)
      ? ["hybrid identity and horticultural suitability require review"]
      : []),
  ];
  const gardenEvidence = garden.get(key);
  return {
    key,
    scientificName: row.scientificName,
    commonName: row.commonName,
    alreadyInBaseline: baselineKeys.has(key),
    alreadyInCurrent: currentKeys.has(key),
    sourceGrowthForm: row.growthForm,
    ecoregions: row.ecoregions,
    broadOriginCode: origin || "not in report",
    nativeProgramCorroborated: program.has(key),
    potentialGroup: keystone.has(key.split(" ")[0]) ? "keystone" : "native",
    flags,
    gardenGuideEvidence: gardenEvidence
      ? { sourceName: gardenEvidence.sourceName, note: gardenEvidence.note }
      : null,
    careCoreSourceChecked: coreChecked.has(key),
    careCheckScope: coreChecked.has(key)
      ? "Rich primary extension profile imported and independently reviewed"
      : "Not evaluated for a new detailed care profile",
    providerCheck:
      provider.get(key) || "baseline profile; new-addition gate not evaluated",
    gardenTier: flags.length
      ? "held for identity/origin/ecological review"
      : coreChecked.has(key) && gardenEvidence
        ? "documented NJ garden-guide match; rich profile checked"
        : "garden relevance not yet evaluated",
  };
});
const remaining = candidates.filter((p) => !p.alreadyInBaseline);
const clear = remaining.filter((p) => !p.flags.length);
const knownIssueFree = remaining.filter(
  (p) => !p.flags.some((f) => !f.startsWith("hybrid")),
);
const guideMissing = guide.chartTaxa
  .filter((p) => !baselineKeys.has(taxonKey(p.canonicalName)))
  .map((p) => ({
    ...p,
    listedInNJDEP: references.native.some(
      (n) => taxonKey(n.scientificName) === taxonKey(p.canonicalName),
    ),
    conservationExcluded:
      references.native.find(
        (n) => taxonKey(n.scientificName) === taxonKey(p.canonicalName),
      )?.doNotPlant ?? null,
    coreChecked: coreChecked.has(taxonKey(p.canonicalName)),
  }));
const missingInvasive = references.invasive.filter(
  (p) => !baselineKeys.has(taxonKey(p.scientificName)),
);
const gardenUnchecked = remaining.filter(
  (p) => p.gardenTier === "garden relevance not yet evaluated",
);
const fullGardenScreen = {
  checkedOn: "2026-11-04",
  baselineProfiles: baseline.profiles.length,
  evaluated: remaining.length,
  tiers: countBy(remaining.map((p) => p.gardenTier)),
  uncheckedFacets: {
    count: gardenUnchecked.length,
    nativeProgramCorroborated: gardenUnchecked.filter(
      (p) => p.nativeProgramCorroborated,
    ).length,
    growthForms: countBy(gardenUnchecked.map((p) => p.sourceGrowthForm)),
    providerStatuses: countBy(gardenUnchecked.map((p) => p.providerCheck)),
  },
  limitation:
    "All remaining records matched locally; NJDA labeling-program membership and growth form do not establish garden suitability or current nursery availability. No bulk care-page audit was performed for the unchecked cohort.",
  candidates: remaining,
};
const report = {
  checkedOn: "2026-11-04",
  methodVersion: "local-funnel-v1",
  baselineProfiles: baseline.profiles.length,
  currentProfiles: catalog.length,
  scope:
    "Full local source matching plus snapshot-based provider coverage; garden relevance independently documented for five additions only. No profiles are added by this script.",
  sourceScopes: {
    native: references.sources.native,
    flora: references.sources.flora,
    guide: { url: guide.source, sha256: guide.sha256, scope: guide.scope },
    keystone: references.sources.keystone,
  },
  funnel: {
    rawNJDEPNativeRows: references.native.length,
    conservationExcluded: references.native.filter((p) => p.doNotPlant).length,
    noDoNotPlantRaw: eligible.length,
    canonicalUnique: groups.size,
    duplicateKeys: [...groups.entries()]
      .filter(([, r]) => r.length > 1)
      .map(([key, r]) => ({ key, names: r.map((p) => p.scientificName) })),
    baselineOverlap: candidates.filter((p) => p.alreadyInBaseline).length,
    remainingUnique: remaining.length,
    afterKnownOriginInvasionWatchFlags: knownIssueFree.length,
    hybridIdentityHolds: remaining.filter((p) =>
      p.flags.some((f) => f.startsWith("hybrid")),
    ).length,
    afterAllKnownFlags: clear.length,
    currentOverlap: candidates.filter((p) => p.alreadyInCurrent).length,
  },
  remainingSourceFacts: {
    growthForms: countBy(remaining.map((p) => p.sourceGrowthForm)),
    ecoregionOccurrence: countBy(remaining.flatMap((p) => p.ecoregions)),
    noListedEcoregion: remaining.filter((p) => !p.ecoregions.length).length,
    broadOriginCodes: countBy(remaining.map((p) => p.broadOriginCode)),
    nativeProgramCorroborated: remaining.filter(
      (p) => p.nativeProgramCorroborated,
    ).length,
  },
  conservativeResearchEnvelope: {
    count: clear.length,
    groups: countBy(clear.map((p) => p.potentialGroup)),
    confidence:
      "High in the bounded source-match counts; garden relevance, cultivar identity and detailed care availability remain unmeasured for most records. Provider coverage is separately snapshot-checked. This is a research ceiling, not a proposed addition count or garden-ready inventory.",
    careCoreChecked: clear.filter((p) => p.careCoreSourceChecked).length,
    careNotCoreChecked: clear.filter((p) => !p.careCoreSourceChecked).length,
  },
  gardenScreen: {
    chartTaxa: guide.chartTaxa.length,
    alreadyInBaseline: guide.chartTaxa.filter((p) =>
      baselineKeys.has(taxonKey(p.canonicalName)),
    ).length,
    missingFromBaseline: guideMissing,
    knownCoreCheckedLowerBound: guide.coreCheckedCandidateNames,
    interpretation:
      "The five core-checked names are an already checked lower bound within a larger measured pool, not a final target or extrapolation to all remaining taxa.",
  },
  recognitionOnlyResearch: {
    missingEstablishedInvasiveRows: missingInvasive.length,
    missingEstablishedMarkedSoldForPlanting2025: missingInvasive.filter(
      (p) => p.soldForPlanting === "Yes",
    ).length,
    missingUncertainWatchRows: references.watch.filter(
      (p) => !baselineKeys.has(taxonKey(p.scientificName)),
    ).length,
    additionalIntroducedOccurrenceRows: references.flora.filter(
      (p) =>
        p.originCode === "I" && !baselineKeys.has(taxonKey(p.scientificName)),
    ).length,
    interpretation:
      "These overlapping pools are recognition research, not native planting recommendations, current stock or ready detailed profiles.",
  },
  taxonomyLimits:
    "Exact names and the verified alias table were reconciled for all 937 records. No fuzzy matches were accepted. Twelve known hybrid formulas are held separately. Remaining accepted-name changes and site/cultivar fit were not exhaustively resolved; no zero-unresolved-taxonomy claim is made.",
  candidates,
};
if (process.argv.includes("--write")) {
  fs.mkdirSync("docs/evidence", { recursive: true });
  fs.writeFileSync(
    "docs/evidence/nj-fullpool-garden-screen.v1.json",
    JSON.stringify(fullGardenScreen, null, 2) + "\n",
  );
  fs.writeFileSync(
    "docs/evidence/nj-catalog-opportunity.v1.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify(
    {
      funnel: report.funnel,
      researchEnvelope: report.conservativeResearchEnvelope,
      gardenChartTaxa: report.gardenScreen.chartTaxa,
      gardenMissing: guideMissing.length,
      recognitionResearch: report.recognitionOnlyResearch,
    },
    null,
    2,
  ),
);
