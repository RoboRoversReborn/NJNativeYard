import test from "node:test";
import assert from "node:assert/strict";
import { catalog, summary, scoreContributions, scoreSnapshot, savedAssessment, withScoreSnapshot, SCORE_VERSION, type Survey } from "../lib/survey";
import { profileStatus } from "../lib/nj-evidence";
import type { Plant } from "../lib/types";

const group = (status: string) => catalog.filter(p => profileStatus(p) === status);
const key = group("keystone")[0], natives = group("native").slice(0, 3);
const introduced = group("non-native").slice(0, 3), invasive = group("invasive").slice(0, 2);
function survey(plants: Plant[]): Survey {
  return { id: "score-fixture", source: "upload", createdAt: "2026-06-01T00:00:00Z", areaId: "front", zip: "07645", photo: "/fixture.jpg",
    plants: plants.map((p, i) => ({ id: `region-${i}`, plantId: p.id, scientificName: p.scientificName,
      suggestion: p.commonName, reviewed: true, yardScope: "yard", candidates: [], box: { x: 0, y: 0, w: 10, h: 10 } })) };
}

test("v3 separates stronger invasive signed pressure from non-native pressure at the display floor", () => {
  const non = summary(survey([introduced[0]])), inv = summary(survey([invasive[0]]));
  assert.equal(non.rawScore, -5); assert.equal(inv.rawScore, -50);
  assert.equal(non.score, 0); assert.equal(inv.score, 0);
  assert.equal(inv.breakdown.invasivePenalty, 0);
  assert.equal(summary(survey([natives[0]])).rawScore, 85);
  assert.equal(summary(survey([key])).rawScore, 105);
  assert.equal(summary(survey([key])).score, 100);
});

test("adding a distinct non-native cannot raise a positive index across mixed species and bonus thresholds", () => {
  const pool = [key, ...natives, ...introduced.slice(0, 2), ...invasive];
  for (let mask = 1; mask < 2 ** pool.length; mask++) {
    const selected = pool.filter((_p, i) => mask & (1 << i));
    const before = summary(survey(selected));
    const after = summary(survey([...selected, introduced[2]]));
    if (before.score! > 0) {
      assert.ok(after.rawScore! <= before.rawScore!, `signed score increased for subset ${mask}`);
      assert.ok(after.score! <= before.score!, `display score increased for subset ${mask}`);
    }
  }
});

test("duplicate regions do not alter the distinct-species index or bonuses", () => {
  const base = summary(survey([key, natives[0], invasive[0], introduced[0]]));
  const repeated = summary(survey([key, natives[0], invasive[0], introduced[0], key, invasive[0], introduced[0]]));
  assert.equal(repeated.rawScore, base.rawScore);
  assert.equal(repeated.score, base.score);
  assert.equal(repeated.speciesCount, base.speciesCount);
  assert.deepEqual(repeated.breakdown, base.breakdown);
  assert.equal(summary(survey(natives)).rawScore, 90);
});

test("unknown ecological roles and background plants earn no positive or negative score contribution", () => {
  const s = survey([natives[0], invasive[0]]);
  s.plants[1].yardScope = "background";
  s.plants.push({ id: "unresolved", scientificName: "Unknown", suggestion: "Unknown", reviewed: false,
    yardScope: "yard", candidates: [], box: { x: 0, y: 0, w: 10, h: 10 } });
  const stats = summary(s), contributions = scoreContributions(s);
  assert.equal(stats.rawScore, 85);
  assert.equal(stats.counts.invasive, 0);
  assert.equal(contributions.entries.find(e => e.status === "invasive")!.points, 0);
  assert.equal(contributions.entries.find(e => e.status === "unverified")!.points, 0);
  s.plants = [s.plants.at(-1)!];
  assert.equal(summary(s).rawScore, null);
  assert.equal(summary(s).score, null);
});

test("signed category contributions reconcile to the clamped display without a second invasive penalty", () => {
  for (const selected of [[introduced[0]], [invasive[0]], [key, introduced[0]], [key, natives[0], invasive[0]], [...natives, key]]) {
    const s = survey(selected), c = scoreContributions(s);
    assert.ok(Math.abs(c.entries.reduce((sum, entry) => sum + entry.points, 0) + c.bonuses + c.adjustment - summary(s).score!) < 1e-9);
  }
});

test("legacy saved numbers are retained; a v3 reassessment appends rather than rewrites history", () => {
  const s = survey([introduced[0]]);
  const legacy = { ...scoreSnapshot(s), version: "species-mix-v1" as const, score: 73, rawScore: undefined };
  s.assessmentHistory = [legacy];
  assert.equal(savedAssessment(s).score, 73);
  const next = withScoreSnapshot(s);
  assert.equal(next.assessmentHistory!.length, 2);
  assert.equal(next.assessmentHistory![0].score, 73);
  assert.equal(next.assessmentHistory![1].version, SCORE_VERSION);
  assert.equal(next.assessmentHistory![1].rawScore, -5);
  assert.equal(s.assessmentHistory.length, 1);
});
