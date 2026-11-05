import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../lib/survey";
import { plantStory } from "../lib/plant-stories";

test("curated stories require exact taxa and unchanged supporting source facts", () => {
  const stories = catalog.filter((plant) => plantStory(plant));
  assert.equal(stories.length, 4);
  for (const plant of stories) {
    const story = plantStory(plant)!;
    assert.ok(story.opening && story.recognitionCue && story.nextObservation);
    assert.equal(story.source.url, plant.horticulture!.source.url);
    assert.equal(
      plantStory({ ...plant, scientificName: "Unknown taxon" }),
      undefined,
    );
    assert.equal(plantStory({ ...plant, horticulture: undefined }), undefined);
    const changed = structuredClone(plant);
    changed.horticulture!.attributes[story.evidence[0].field] = [];
    assert.equal(plantStory(changed), undefined);
    story.evidence[0].values.length = 0;
    story.source.url = "https://invalid.example/";
    assert.ok(plantStory(plant)!.evidence[0].values.length > 0);
    assert.notEqual(plantStory(plant)!.source.url, story.source.url);
  }
});
