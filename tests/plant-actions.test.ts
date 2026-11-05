import test from "node:test";
import assert from "node:assert/strict";
import {
  curatedPlantActions,
  PLANT_ACTIONS_COVERAGE,
} from "../lib/plant-actions";
import { sampleYards } from "../lib/sample-yards";
import curatedPrioritySamples from "../data/reference-samples.v1.json";

test("the original curated priority identities retain attributed plant-specific actions", () => {
  const ids = new Set(
    curatedPrioritySamples.flatMap((sample) =>
      sample.plants.map((p) => p.plantId!),
    ),
  );
  assert.equal(ids.size, 19);
  assert.ok(PLANT_ACTIONS_COVERAGE.profilesWithActions >= 19);
  let count = 0;
  for (const id of ids) {
    const actions = curatedPlantActions(id);
    assert.ok(actions.length > 0, id);
    for (const action of actions) {
      count++;
      assert.ok(action.title && action.season && action.detail && action.scope);
      assert.ok(action.source.url.startsWith("https://"));
      assert.equal(action.source.checkedOn, "2026-11-04");
      assert.ok(action.evidence.sourceField);
      if (action.kind === "control")
        assert.equal(action.identificationRequired, true);
      if (action.kind === "observe")
        assert.equal(action.evidence.basis, "source-phenology");
    }
  }
  assert.equal(count, PLANT_ACTIONS_COVERAGE.sampleActionCount);
  assert.deepEqual(curatedPlantActions("not-in-curated-actions"), []);
});

test("source-specific timing preserves cultivar and establishment limits", () => {
  const hosta = curatedPlantActions("extended-15");
  assert.match(hosta[0].season, /After flowering/);
  assert.ok(hosta.some((a) => /before leaves unfurl/.test(a.season)));
  const blueberry = curatedPlantActions("vaccinium-corymbosum").find((a) =>
    /pruning window/.test(a.title),
  )!;
  assert.match(blueberry.season, /Late winter, from the third year/);
  const hydrangea = curatedPlantActions("hydrangea-macrophylla")[0];
  assert.match(hydrangea.detail, /old wood, new growth, or both/);
  assert.match(hydrangea.detail, /not a verified NJ cutoff/);
  assert.match(
    curatedPlantActions("symphyotrichum-novae-angliae")[0].season,
    /Spring/,
  );
  assert.match(
    curatedPlantActions("extended-96")[0].season,
    /Immediately after flowering/,
  );
  const ivy = curatedPlantActions("hedera-helix").find(
    (a) => a.kind === "control",
  )!;
  assert.match(ivy.source.label, /Rutgers/);
  assert.match(ivy.detail, /leave the upper growth attached/);
});

test("callers cannot mutate the stored action source or record", () => {
  const copy = curatedPlantActions("buxus-sempervirens");
  copy[0].source.url = "https://invalid.example/";
  copy[0].title = "Changed";
  assert.notEqual(
    curatedPlantActions("buxus-sempervirens")[0].title,
    "Changed",
  );
  assert.ok(
    !curatedPlantActions("buxus-sempervirens")[0].source.url.includes(
      "invalid",
    ),
  );
});

test("unresolved regions receive no fabricated species-specific actions", () => {
  const unresolved = sampleYards
    .flatMap((s) => s.plants)
    .filter((p) => !p.plantId);
  // Authored sample compositions may contain only mapped intended species.
  // Exercise an unresolved upload independently of the current sample lineup.
  assert.deepEqual(curatedPlantActions(""), []);
  assert.deepEqual(curatedPlantActions("unmatched-upload-specimen"), []);
  for (const region of unresolved)
    assert.deepEqual(curatedPlantActions(region.plantId || ""), []);
});
