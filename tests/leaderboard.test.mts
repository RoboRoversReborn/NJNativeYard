import test from "node:test";
import assert from "node:assert/strict";
import { computeYardMetrics, formatTownOrCounty } from "../lib/gamification";
import { getLeaderboardYards } from "../lib/leaderboard-service";
import type { Survey } from "../lib/survey";

test("formatTownOrCounty masks street address and outputs only town or county", () => {
  const res1 = formatTownOrCounty("07042", "123 Private St Apt 4");
  assert.equal(res1.county, "Essex");
  assert.ok(res1.townOrCounty.includes("Essex County"));
  assert.ok(!res1.townOrCounty.includes("123 Private St"));

  const res2 = formatTownOrCounty("07901");
  assert.equal(res2.county, "Union");
  assert.ok(res2.townOrCounty.includes("Union County"));

  const resEmpty = formatTownOrCounty();
  assert.equal(resEmpty.townOrCounty, "New Jersey");
});

test("computeYardMetrics correctly aggregates species, score, and computes badges", () => {
  const mockSurvey: Survey = {
    id: "survey-1",
    createdAt: "2026-06-01T12:00:00Z",
    source: "upload",
    zip: "07901",
    photo: "https://example.com/photo.jpg",
    plants: [
      {
        id: "p1",
        scientificName: "Quercus alba",
        suggestion: "White Oak",
        box: { x: 0, y: 0, w: 10, h: 10 },
        reviewed: true,
        candidates: [],
        externalProfile: {
          id: "quercus-alba",
          commonName: "White Oak",
          scientificName: "Quercus alba",
          status: "keystone",
          type: "Tree",
        } as any,
      },
      {
        id: "p2",
        scientificName: "Prunus serotina",
        suggestion: "Black Cherry",
        box: { x: 10, y: 0, w: 10, h: 10 },
        reviewed: true,
        candidates: [],
        externalProfile: {
          id: "prunus-serotina",
          commonName: "Black Cherry",
          scientificName: "Prunus serotina",
          status: "keystone",
          type: "Tree",
        } as any,
      },
      {
        id: "p3",
        scientificName: "Asclepias tuberosa",
        suggestion: "Butterfly Weed",
        box: { x: 20, y: 0, w: 10, h: 10 },
        reviewed: true,
        candidates: [],
        externalProfile: {
          id: "asclepias-tuberosa",
          commonName: "Butterfly Weed",
          scientificName: "Asclepias tuberosa",
          status: "native",
          type: "Perennial",
        } as any,
      },
      {
        id: "p4",
        scientificName: "Monarda fistulosa",
        suggestion: "Wild Bergamot",
        box: { x: 30, y: 0, w: 10, h: 10 },
        reviewed: true,
        candidates: [],
        externalProfile: {
          id: "monarda-fistulosa",
          commonName: "Wild Bergamot",
          scientificName: "Monarda fistulosa",
          status: "native",
          type: "Perennial",
        } as any,
      },
    ],
  };

  const metrics = computeYardMetrics([mockSurvey], [{ id: "front", name: "Front Garden" }]);

  assert.equal(metrics.nativeSpeciesCount, 4);
  assert.equal(metrics.keystoneCount, 2);
  assert.equal(metrics.invasiveCount, 0);
  assert.equal(metrics.coverPhotoUrl, "https://example.com/photo.jpg");

  // Badges verification
  const badgeIds = metrics.badges.map((b) => b.id);
  assert.ok(badgeIds.includes("keystone-champion"), "Should award Keystone Champion for >= 2 keystones");
  assert.ok(badgeIds.includes("bee-haven"), "Should award Bee Haven for >= 4 native species");
  assert.ok(badgeIds.includes("canopy-restorer"), "Should award Canopy Restorer for native oak/cherry trees");
  assert.ok(badgeIds.includes("invasive-free"), "Should award Invasive Free for 0 invasives and >= 3 natives");
});

test("getLeaderboardYards sorts correctly by score, species, and keystone", async () => {
  const byScore = await getLeaderboardYards({ sortBy: "score" });
  assert.ok(byScore.length >= 3);
  for (let i = 0; i < byScore.length - 1; i++) {
    assert.ok(byScore[i].score >= byScore[i + 1].score);
  }

  const bySpecies = await getLeaderboardYards({ sortBy: "species" });
  for (let i = 0; i < bySpecies.length - 1; i++) {
    assert.ok(bySpecies[i].nativeSpeciesCount >= bySpecies[i + 1].nativeSpeciesCount);
  }

  const byKeystone = await getLeaderboardYards({ sortBy: "keystone" });
  for (let i = 0; i < byKeystone.length - 1; i++) {
    assert.ok(byKeystone[i].keystoneCount >= byKeystone[i + 1].keystoneCount);
  }
});

test("getLeaderboardYards filters by county accurately", async () => {
  const unionYards = await getLeaderboardYards({ county: "Union" });
  assert.ok(unionYards.length >= 1);
  for (const yard of unionYards) {
    assert.ok(
      yard.county?.toLowerCase().includes("union") ||
        yard.townOrCounty.toLowerCase().includes("union")
    );
  }
});
