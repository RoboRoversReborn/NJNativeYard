import test from "node:test";
import assert from "node:assert/strict";
import { canonicalReferenceTaxon, referenceTaxonKey } from "../lib/taxon-names";
import { enrichNjPlant, nativePlantingOption, normalizeTaxon, profileStatus, taxonKey } from "../lib/nj-evidence";
import { catalog, exactPlant, referencePlant, resolvedPlant, savedAssessment, summary, type Survey } from "../lib/survey";

test("exact reference names normalize hybrid spelling without collapsing identities", () => {
  for (const name of ["Prunus x subhirtella", "Prunus × subhirtella", "Prunus ×subhirtella", "  prunus   x   SUBHIRTELLA  "]) {
    assert.equal(canonicalReferenceTaxon(name), "Prunus × subhirtella");
    assert.equal(referenceTaxonKey(name), "prunus x subhirtella");
    assert.equal(normalizeTaxon(name), "prunus x subhirtella");
    assert.equal(taxonKey(name), "prunus x subhirtella");
  }
  assert.equal(canonicalReferenceTaxon("Sambucus nigra ssp. canadensis"), "Sambucus nigra subsp. canadensis");
  assert.equal(canonicalReferenceTaxon("Viburnum opulus var. americanum"), "Viburnum opulus var. americanum");
  assert.notEqual(referenceTaxonKey("Prunus x subhirtella"), referenceTaxonKey("Prunus subhirtella"));
  assert.notEqual(referenceTaxonKey("Sambucus nigra"), referenceTaxonKey("Sambucus nigra subsp. canadensis"));
  for (const name of ["", "Prunus", "Prunus sp.", "Prunus spp.", "Prunus spp", "Prunus x", "Prunus unknown", "Prunus cf. subhirtella", "Prunus incisa x Prunus itosakura", "Prunus x subhirtella 'Autumnalis'", "Prunus subhirtella Miq."]) {
    assert.equal(canonicalReferenceTaxon(name), undefined, name);
    assert.equal(referencePlant(name), undefined, name);
  }
});

test("exact hybrid has sourced foreign origin while API-only references stay outside recommendations", () => {
  const plant = referencePlant("Prunus x subhirtella", "Winter flowering cherry")!;
  assert.equal(plant.scientificName, "Prunus × subhirtella");
  assert.equal(profileStatus(plant), "non-native");
  assert.equal(plant.njEvidence?.native, false);
  assert.equal(plant.njEvidence?.originStatus, "introduced");
  assert.equal(plant.njEvidence?.legalListed, false);
  assert.equal(plant.njEvidence?.invasiveStatus, undefined);
  assert.ok(plant.njEvidence?.sources.some(source => source.url.endsWith("730318-1")));
  assert.equal(nativePlantingOption(plant), false);
  assert.equal(catalog.some(p => taxonKey(p.scientificName) === taxonKey(plant.scientificName)), false);
  assert.equal(exactPlant("Prunus x subhirtella"), undefined);
  assert.equal(profileStatus(referencePlant("Prunus subhirtella")!), "unverified");
  assert.equal(profileStatus(referencePlant("Prunus x subhirtella var. autumnalis")!), "unverified");
  assert.equal(profileStatus(referencePlant("Imaginaris x botanica")!), "unverified");
});

test("missing origin and genus evidence remain pending; native/foreign conflict stays unresolved", () => {
  const missing = referencePlant("Imaginaris botanica")!;
  assert.equal(profileStatus(missing), "unverified");
  const details = { facts: { Origin: ["Japan"] }, source: { label: "Exact reference fixture", url: "https://example.com/reference", checkedOn: "2026-11-05" } };
  const genus = enrichNjPlant({ ...missing, scientificName: "Prunus", referenceDetails: details });
  assert.equal(profileStatus(genus), "unverified");
  const conflict = enrichNjPlant({ ...referencePlant("Quercus alba")!, referenceDetails: details });
  assert.equal(profileStatus(conflict), "unverified");
  assert.equal(conflict.njEvidence?.taxonConflict, true);
  assert.equal(conflict.njEvidence?.native, null);
  assert.equal(nativePlantingOption(conflict), false);
});

test("hybrid upload resolves without mutating saved identity or historical assessment", () => {
  const survey: Survey = { id: "hybrid-upload", createdAt: "2026-11-04", source: "upload", zip: "08902", photo: "fixture", plants: [{ id: "plant", scientificName: "Prunus x subhirtella", suggestion: "Winter flowering cherry", reviewed: false, candidates: [], box: { x: 0, y: 0, w: 10, h: 10 } }], assessmentHistory: [{ version: "species-mix-v3-signed", recordedAt: "2026-11-04", score: 85, nativeShare: 100, assessed: 1, total: 1, reviewed: 1, coverage: 100, provisional: false, fingerprint: "historical" }] };
  const before = structuredClone(survey);
  assert.equal(resolvedPlant(survey.plants[0])?.scientificName, "Prunus × subhirtella");
  assert.equal(summary(survey).counts["non-native"], 1);
  assert.equal(savedAssessment(survey).score, 85);
  assert.deepEqual(survey, before);
});
