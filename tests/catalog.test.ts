import test from "node:test";
import assert from "node:assert/strict";
import {
  catalog,
  exactPlant,
  summary,
  exampleSurvey,
  scoreContributions,
} from "../lib/survey";
import { profileStatus, nativePlantingOption } from "../lib/nj-evidence";
import { sampleYards } from "../lib/sample-yards";
import horticulture from "../data/plant-horticulture.v1.json";
import references from "../data/nj-evidence.v2.json";

test("unmatched profiles expose no unsourced legacy care or appearance claims", () => {
  const unmatched = catalog.filter((p) => !p.horticulture);
  assert.equal(unmatched.length, 18);
  for (const plant of unmatched) {
    for (const field of [plant.sun, plant.moisture, plant.bloom, plant.height])
      assert.match(field, /not yet sourced/, plant.id);
    assert.equal(plant.type, "Unknown");
    assert.equal(plant.matureHeightFt, undefined);
    assert.equal(plant.ornamentalFeatures, undefined);
    assert.match(plant.description, /await a matched horticultural reference/);
  }
});

test("current catalog preserves baseline IDs and expands to 558 source-gated profiles and enriches resolved sample identities without inventing genus matches", () => {
  assert.equal(catalog.length, 558);
  assert.equal(new Set(catalog.map((p) => p.id)).size, 558);
  assert.equal(Object.keys(horticulture.records).length, 540);
  assert.equal(horticulture.unmatched.length, 18);
  for (const sample of sampleYards)
    for (const region of sample.plants) {
      if (!region.plantId) {
        assert.equal(exactPlant(region.scientificName), undefined);
        continue;
      }
      const plant = catalog.find((p) => p.id === region.plantId)!;
      assert.ok(
        plant?.horticulture,
        `${sample.title}: ${plant?.scientificName}`,
      );
      assert.ok(plant.horticulture.attributes.Light.length);
    }
  for (const profile of Object.values(horticulture.records)) {
    assert.match(profile.source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(profile.source.url.startsWith("https://"));
    assert.ok(Object.keys(profile.attributes).length >= 6);
    for (const values of Object.values(profile.attributes))
      for (const value of values) {
        assert.ok(value.length > 0);
        assert.doesNotMatch(value, /<script|AWSAccessKeyId|Signature=/);
      }
  }
});

test("source facts replace old care claims without filling absent fields or species wildlife counts", () => {
  const boxwood = exactPlant("Buxus sempervirens")!;
  assert.equal(
    boxwood.height,
    boxwood.horticulture!.attributes.Height.join(" · "),
  );
  assert.match(boxwood.height, /20 ft/);
  const rose = exactPlant("Rosa multiflora")!;
  assert.match(rose.moisture, /not supplied by matched source/);
  const goldenrod = exactPlant("Solidago rugosa")!;
  assert.match(goldenrod.height, /not supplied by matched source/);
  assert.equal(exactPlant("Rudbeckia hirta")!.type, "Herb");
  assert.ok(
    catalog.every(
      (p) =>
        p.lepidoptera === undefined && p.specialistBeeSupport === undefined,
    ),
  );
});

test("NJ origin and ecological status use independent evidence and keep uncertain lineages unassessed", () => {
  assert.equal(references.flora.length, 3048);
  assert.equal(references.native.length, 1519);
  assert.equal(references.keystoneGenera.length, 54);
  assert.equal(
    profileStatus(exactPlant("Hydrangea quercifolia")!),
    "unverified",
  );
  assert.equal(
    nativePlantingOption(exactPlant("Hydrangea quercifolia")!),
    false,
  );
  assert.equal(profileStatus(exactPlant("Acer palmatum")!), "invasive");
  assert.equal(exactPlant("Acer palmatum")!.njEvidence?.legalListed, false);
  assert.equal(exactPlant("Reynoutria japonica")!.njStatus, undefined);
  assert.equal(
    exactPlant("Reynoutria japonica")!.njEvidence?.invasiveStatus,
    "Widespread",
  );
  const reed = exactPlant("Phragmites australis")!;
  assert.equal(profileStatus(reed), "unverified");
  assert.equal(reed.njEvidence?.taxonConflict, true);
  assert.equal(exactPlant("Phragmites australis subsp. americanus"), undefined);
  assert.equal(exactPlant("Sambucus nigra"), undefined);
  assert.equal(
    exactPlant("Sambucus nigra subsp. canadensis")?.id,
    exactPlant("Sambucus canadensis")?.id,
  );
  assert.equal(
    exactPlant("Muenchhusia moscheutos")?.id,
    exactPlant("Hibiscus moscheutos")?.id,
  );
  const watch = exactPlant("Hydrangea paniculata")!;
  assert.equal(watch.njEvidence?.watchStatus, "Uncertain");
  assert.notEqual(profileStatus(watch), "invasive");
  assert.equal(exactPlant("Cercis canadensis")!.njEvidence?.doNotPlant, true);
  assert.equal(nativePlantingOption(exactPlant("Cercis canadensis")!), false);
  for (const sample of sampleYards) {
    const survey = exampleSurvey(undefined, sample.id),
      stats = summary(survey),
      parts = scoreContributions(survey);
    assert.equal(stats.assessed + stats.unknown, stats.total);
    assert.ok(
      Math.abs(
        parts.entries.reduce((sum, e) => sum + e.points, 0) +
          parts.bonuses +
          parts.adjustment -
          stats.score!,
      ) < 0.00001,
    );
  }
});


test("explicit Central American origin is non-native while unresolved American ranges stay pending", () => {
  const ageratum = exactPlant("Ageratum houstonianum")!;
  assert.equal(profileStatus(ageratum), "non-native");
  assert.ok(ageratum.njEvidence?.sources.some(source => source.url === "https://plants.ces.ncsu.edu/plants/ageratum-houstonianum/"));
  assert.equal(profileStatus(exactPlant("Hydrangea quercifolia")!), "unverified");
  assert.equal(profileStatus(exactPlant("Phlox paniculata")!), "native");
});

test("documented cranberry-viburnum synonyms resolve without borrowing the parent NJ category", () => {
  const american = exactPlant("Viburnum trilobum")!;
  assert.equal(exactPlant("Viburnum opulus var. americanum")?.id, american.id);
  assert.equal(exactPlant("Viburnum opulus ssp. trilobum")?.id, american.id);
  assert.notEqual(exactPlant("Viburnum opulus")?.id, american.id);
  assert.equal(profileStatus(american), "unverified");
  assert.equal(profileStatus(exactPlant("Viburnum opulus")!), "unverified");
});

test("exact sourced origin corrections classify phlox and five previously pending taxa", () => {
  for (const name of ["Phlox paniculata", "Rudbeckia hirta"]) {
    const plant = exactPlant(name)!;
    assert.equal(profileStatus(plant), name === "Rudbeckia hirta" ? "keystone" : "native");
    assert.equal(plant.njEvidence?.native, true);
    assert.ok(plant.njEvidence?.sources.some(source => /Kew|GRIN/.test(source.label)));
  }
  for (const name of ["Penstemon digitalis", "Paeonia lactiflora", "Hosta sieboldiana", "Rhododendron simsii"]) {
    assert.equal(profileStatus(exactPlant(name)!), "non-native");
  }
});
