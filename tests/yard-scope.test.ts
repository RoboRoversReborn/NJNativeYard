import test from "node:test";
import assert from "node:assert/strict";
import {
  exampleSurvey,
  exactPlant,
  summary,
  scoreContributions,
  withScoreSnapshot,
  savedAssessment,
} from "../lib/survey";

test("photo estimates do not assign ownership and explicit yard scope excludes neighbors and unresolved regions", () => {
  const s = exampleSurvey();
  s.source = "upload";
  const oak = exactPlant("Quercus alba")!,
    invasive = exactPlant("Acer platanoides")!;
  s.plants = s.plants.slice(0, 3).map((r, i) => ({
    ...r,
    plantId: i === 0 ? oak.id : invasive.id,
    scientificName: i === 0 ? oak.scientificName : invasive.scientificName,
    reviewed: true,
  }));
  assert.equal(summary(s).assessmentScope, "photo");
  assert.equal(summary(s).scope.unconfirmed, 3);
  assert.equal(summary(s).provisional, true);
  const initial = withScoreSnapshot(s);
  s.plants[0].yardScope = "yard";
  s.plants[1].yardScope = "background";
  const a = summary(s);
  assert.equal(a.assessmentScope, "yard");
  assert.equal(a.total, 1);
  assert.equal(a.counts.invasive, 0);
  assert.equal(a.scope.background, 1);
  assert.equal(a.scope.unconfirmed, 1);
  assert.equal(a.provisional, true);
  assert.equal(a.grade, "An incomplete yard view");
  assert.equal(
    scoreContributions(s).entries.find((e) => e.status === "invasive")!.points,
    0,
  );
  const revised = withScoreSnapshot({
    ...s,
    assessmentHistory: initial.assessmentHistory,
  });
  assert.equal(revised.assessmentHistory!.length, 2);
  assert.equal(revised.assessmentHistory![0].assessmentScope, "photo");
  assert.equal(revised.assessmentHistory![1].scope!.background, 1);
  s.plants.forEach((p) => (p.yardScope = "background"));
  assert.equal(summary(s).score, null);
  assert.equal(summary(s).total, 0);
});

test("legacy scores retain their number without inheriting newly confirmed ownership", () => {
  const s = exampleSurvey();
  s.source = "upload";
  s.plants.forEach((p) => (p.yardScope = "yard"));
  s.assessmentHistory = [
    {
      version: "species-mix-v1",
      recordedAt: "2024-01-01T00:00:00Z",
      score: 44,
      nativeShare: 20,
      assessed: 4,
      total: 5,
      reviewed: 5,
      coverage: 80,
      provisional: false,
      fingerprint: "historic",
    },
  ];
  const a = savedAssessment(s);
  assert.equal(a.score, 44);
  assert.equal(a.assessmentScope, "photo");
  assert.equal(a.provisional, true);
  assert.equal(a.scope.yard, 0);
  assert.equal(a.scope.unconfirmed, 5);
  assert.equal(s.assessmentHistory[0].provisional, false);
});
