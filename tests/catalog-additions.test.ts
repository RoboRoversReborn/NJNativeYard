import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import additions from "../data/catalog-expansion/approved-additions.v1.json";
import baseline from "../data/catalog-expansion/baseline-249.v1.json";
import {
  additionPassesGate,
  approvedCatalogAdditions,
  type AdmissionRecord,
} from "../lib/catalog-additions";
import { catalog, exactPlant, exampleSurvey, summary } from "../lib/survey";
import {
  nativePlantingOption,
  normalizeTaxon,
  profileStatus,
} from "../lib/nj-evidence";
import { plantGuidance } from "../lib/plant-guidance";
const records = additions.records as unknown as AdmissionRecord[];

test("all 309 additions retain exact independently audited provider evidence and preserve baseline IDs", () => {
  assert.equal(records.length, 309);
  const compressed = fs.readFileSync(
    "docs/evidence/plantnet-k-world-flora-inventory.v1.json.gz",
  );
  const digest = crypto.createHash("sha256").update(compressed).digest("hex");
  const inventory = JSON.parse(zlib.gunzipSync(compressed).toString()) as {
    species: { id: string; scientificNameWithoutAuthor: string }[];
  };
  const byId = new Map(inventory.species.map((p) => [p.id, p]));
  for (const record of records) {
    assert.ok(additionPassesGate(record), record.scientificName);
    const proof = record.admission.plantNet;
    const taxon = byId.get(proof.providerTaxon.id);
    assert.ok(taxon, record.scientificName);
    assert.equal(
      normalizeTaxon(taxon.scientificNameWithoutAuthor),
      normalizeTaxon(proof.providerTaxon.scientificNameWithoutAuthor),
    );
    assert.equal(proof.inventorySha256, digest);
    assert.equal(
      catalog.find((p) => p.id === record.id)?.providerCoverage?.taxonId,
      taxon.id,
    );
  }
  for (const record of baseline.profiles)
    assert.ok(catalog.some((p) => p.id === record.id));
  assert.equal(approvedCatalogAdditions(catalog).length, 0);
});

test("admission rejects ambiguous providers, wrong identities, conservation planting and missing source detail", () => {
  for (const mutate of [
    (r: AdmissionRecord) => {
      r.admission.plantNet.status = "ambiguous";
    },
    (r: AdmissionRecord) => {
      r.admission.plantNet.providerTaxon.scientificNameWithoutAuthor =
        "Quercus alba";
    },
    (r: AdmissionRecord) => {
      r.admission.regionalEvidence.conservationExcluded = true;
    },
    (r: AdmissionRecord) => {
      r.id = "missing-horticulture";
    },
    (r: AdmissionRecord) => {
      r.admission.horticulture.source.sha256 = "0".repeat(64);
    },
    (r: AdmissionRecord) => {
      r.admission.regionalEvidence.scientificName = "Unknown species";
    },
  ]) {
    const copy = structuredClone(records[0]);
    mutate(copy);
    assert.equal(additionPassesGate(copy), false);
  }
});

test("nonflowering recognition and garden eligibility are separate from catalog inclusion", () => {
  const fern = exactPlant("Adiantum pedatum")!;
  assert.ok(fern.horticulture);
  assert.equal(fern.horticulture.attributes.FlowerBloomTime, undefined);
  assert.ok(nativePlantingOption(fern));
  const woodland = exactPlant("Hydrophyllum virginianum")!;
  assert.equal(profileStatus(woodland), "native");
  assert.equal(nativePlantingOption(woodland), false);
  assert.match(woodland.landscapeContext!.note, /not ideal for small gardens/i);
  for (const record of records.filter(
    (r) => r.admission.purpose === "recognition",
  )) {
    const plant = catalog.find((p) => p.id === record.id)!;
    assert.equal(nativePlantingOption(plant), false, plant.scientificName);
    assert.ok(
      plantGuidance(plant).actions.every(
        (a) => !/prun|replant|add complementary/i.test(a.title),
      ),
    );
  }
});

test("semantic quarantine stays out and conflicting native roles earn no score credit", () => {
  assert.equal(exactPlant("Nasturtium officinale"), undefined);
  assert.equal(exactPlant("Schoenoplectus tabernaemontani"), undefined);
  for (const name of ["Cornus alba", "Xanthium strumarium"]) {
    const p = exactPlant(name)!;
    assert.equal(profileStatus(p), "unverified");
    const s = exampleSurvey();
    s.source = "upload";
    s.plants = [
      { ...s.plants[0], plantId: p.id, scientificName: p.scientificName },
    ];
    assert.equal(summary(s).assessed, 0);
    assert.equal(summary(s).score, null);
  }
});
