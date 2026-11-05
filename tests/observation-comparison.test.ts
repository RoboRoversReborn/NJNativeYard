import test from "node:test";
import assert from "node:assert/strict";
import { catalog, withScoreSnapshot, type SurveyPlant } from "../lib/survey";
import {
  compareObservations,
  comparisonFingerprint,
  type ComparisonEvidence,
  type ComparisonObservation,
} from "../lib/observation-comparison";

const id = (name: string) => catalog.find((p) => p.scientificName === name)!.id;
function observation(
  name: "before" | "after",
  species = ["Quercus alba"],
): ComparisonObservation {
  const capturedAt =
    name === "before" ? "2025-06-01T10:00:00Z" : "2025-06-01T11:00:00Z";
  const survey: ComparisonObservation = {
    id: name,
    areaId: "front",
    source: "upload",
    zip: "07645",
    photo: `/${name}.jpg`,
    photoPath: `owner/${name}.jpg`,
    createdAt: "2025-07-01T00:00:00Z",
    plants: species.map((scientificName, i): SurveyPlant => ({
      id: `${name}-${i}`,
      plantId: id(scientificName),
      scientificName,
      suggestion: scientificName,
      reviewed: true,
      yardScope: "yard",
      box: { x: i * 10, y: 0, w: 10, h: 10 },
      candidates: [],
    })),
    capture: {
      capturedAt,
      capturedAtSource: "user-confirmed",
      capturedAtConfirmed: true,
      photoPointId: "front-gate",
      photoPointConfirmed: true,
      imageSha256: (name === "before" ? "1" : "2").repeat(64),
      method: {
        provider: "Gemini",
        modelVersion: "gemini-flash-002",
        promptVersion: "yard-v4",
        pipelineVersion: "multi-region-v2",
      },
    },
  };
  return withScoreSnapshot(survey);
}
function evidence(
  a: ComparisonObservation,
  b: ComparisonObservation,
): ComparisonEvidence {
  return {
    beforeSurveyId: a.id,
    afterSurveyId: b.id,
    beforeFingerprint: comparisonFingerprint(a),
    afterFingerprint: comparisonFingerprint(b),
    sameView: "comparable",
    season: "comparable",
    visibility: "comparable",
    reviewerId: "owner",
    reviewedAt: "2025-07-02T00:00:00Z",
  };
}
const codes = (
  a: ComparisonObservation,
  b: ComparisonObservation,
  e?: ComparisonEvidence,
) => compareObservations(a, b, e).reasons.map((r) => r.code);

test("confirmed same-day pair uses saved numbers and species-level evidence, not region identity", () => {
  const a = observation("before", [
    "Quercus alba",
    "Berberis thunbergii",
    "Quercus alba",
  ]);
  const b = observation("after", ["Quercus alba", "Asclepias incarnata"]);
  a.assessmentHistory!.at(-1)!.score = 21;
  b.assessmentHistory!.at(-1)!.score = 48;
  const result = compareObservations(a, b, evidence(a, b));
  assert.equal(result.eligible, true);
  assert.equal(result.numericDelta, 27);
  assert.equal(result.numericDeltaUnit, "index points");
  assert.equal(result.ledger.length, 3);
  assert.equal(
    result.ledger.find((r) => r.scientificName === "Quercus alba")!.status,
    "SeenBoth",
  );
  assert.equal(
    result.ledger.find((r) => r.scientificName === "Quercus alba")!.before!
      .regionIds.length,
    2,
  );
  assert.equal(
    result.ledger.find((r) => r.scientificName === "Berberis thunbergii")!
      .status,
    "NotObserved",
  );
  assert.equal(
    result.ledger.find((r) => r.scientificName === "Asclepias incarnata")!
      .status,
    "NewlyObserved",
  );
  assert.equal(a.assessmentHistory!.at(-1)!.score, 21);
});

test("legacy records without capture/provenance/declarations never gain a numeric delta", () => {
  const a = observation("before"),
    b = observation("after");
  delete a.capture;
  delete b.capture;
  delete a.assessmentHistory;
  const result = compareObservations(a, b);
  assert.equal(result.numericDelta, null);
  assert.ok(result.reasons.some((r) => r.code === "snapshot_missing"));
  assert.ok(result.reasons.some((r) => r.code === "capture_time_unconfirmed"));
  assert.ok(result.reasons.some((r) => r.code === "evidence_missing"));
});

test("pair declarations expire after review, photo-point, capture-time or method changes", () => {
  for (const mutate of [
    (s: ComparisonObservation) => {
      s.plants[0].reviewed = false;
    },
    (s: ComparisonObservation) => {
      s.capture!.photoPointId = "another-point";
    },
    (s: ComparisonObservation) => {
      s.capture!.capturedAt = "2025-06-01T12:00:00Z";
    },
    (s: ComparisonObservation) => {
      s.capture!.method!.promptVersion = "yard-v5";
    },
  ]) {
    const a = observation("before"),
      b = observation("after"),
      e = evidence(a, b);
    mutate(b);
    assert.ok(codes(a, b, e).includes("evidence_stale"));
    assert.equal(compareObservations(a, b, e).numericDelta, null);
  }
});

test("missing/different provenance, scope, reviewer and capture order cannot be user-overridden", () => {
  const cases: Array<
    [(a: ComparisonObservation, b: ComparisonObservation) => void, string]
  > = [
    [
      (_a, b) => {
        b.areaId = "back";
      },
      "area_mismatch",
    ],
    [
      (_a, b) => {
        b.capture!.photoPointId = "different";
      },
      "photo_point_mismatch",
    ],
    [
      (_a, b) => {
        b.capture!.capturedAtSource = "upload-fallback";
      },
      "capture_time_unconfirmed",
    ],
    [
      (_a, b) => {
        b.capture!.capturedAt = "2025-05-01T00:00:00Z";
      },
      "capture_order_unconfirmed",
    ],
    [
      (_a, b) => {
        b.capture!.method!.modelVersion = "gemini-flash-latest";
      },
      "method_missing",
    ],
    [
      (_a, b) => {
        b.capture!.method!.pipelineVersion = "v99";
      },
      "method_mismatch",
    ],
    [
      (_a, b) => {
        delete b.assessmentHistory!.at(-1)!.catalogVersion;
      },
      "catalog_missing",
    ],
    [
      (_a, b) => {
        b.assessmentHistory!.at(-1)!.catalogVersion = "another-catalog";
      },
      "catalog_mismatch",
    ],
    [
      (a) => {
        a.assessmentHistory!.at(-1)!.version = "species-mix-v1";
      },
      "formula_mismatch",
    ],
    [
      (_a, b) => {
        delete b.plants[0].yardScope;
      },
      "scope_unconfirmed",
    ],
    [
      (_a, b) => {
        b.revision = "unsaved";
      },
      "review_unsaved",
    ],
  ];
  for (const [mutate, reason] of cases) {
    const a = observation("before"),
      b = observation("after");
    mutate(a, b);
    const result = compareObservations(a, b, evidence(a, b));
    assert.equal(result.eligible, false, reason);
    assert.ok(
      result.reasons.some((r) => r.code === reason),
      reason,
    );
  }
});

test("framing, season and visibility declarations are individually required", () => {
  for (const [field, reason] of [
    ["sameView", "framing"],
    ["season", "season"],
    ["visibility", "visibility"],
  ] as const) {
    const a = observation("before"),
      b = observation("after"),
      e = evidence(a, b);
    e[field] = "unknown";
    assert.ok(codes(a, b, e).includes(`${reason}_unconfirmed`));
    e[field] = "different";
    assert.equal(compareObservations(a, b, e).state, "DifferentViewOrMethod");
  }
  const a = observation("before"),
    b = observation("after"),
    e = evidence(a, b);
  delete e.reviewerId;
  assert.ok(codes(a, b, e).includes("reviewer_unconfirmed"));
});

test("same photo reviewed again is RecordCorrected, never a new garden change", () => {
  const a = observation("before"),
    b = observation("after", ["Berberis thunbergii"]);
  b.capture!.imageSha256 = a.capture!.imageSha256;
  const result = compareObservations(a, b, evidence(a, b));
  assert.equal(result.state, "RecordCorrected");
  assert.equal(result.numericDelta, null);
  assert.ok(result.ledger.every((r) => r.status === "RecordCorrected"));
  assert.equal(result.savedScores.before, a.assessmentHistory!.at(-1)!.score);
});

test("background identities need not be reviewed and never enter the species ledger", () => {
  const a = observation("before"),
    b = observation("after");
  b.plants.push({
    ...b.plants[0],
    id: "background",
    yardScope: "background",
    reviewed: false,
    plantId: undefined,
    scientificName: "Unknown",
    suggestion: "Unknown",
  });
  b.assessmentHistory = undefined;
  const saved = withScoreSnapshot(b);
  const result = compareObservations(a, saved, evidence(a, saved));
  assert.equal(result.eligible, true);
  assert.equal(result.ledger.length, 1);
  assert.ok(!result.ledger[0].after!.regionIds.includes("background"));
});

test("unresolved scoped identity and stale saved review do not receive a delta", () => {
  const a = observation("before"),
    b = observation("after");
  b.plants[0].plantId = undefined;
  b.plants[0].scientificName = "Unknown";
  const result = compareObservations(a, b, evidence(a, b));
  assert.ok(result.reasons.some((r) => r.code === "identity_unresolved"));
  assert.ok(result.reasons.some((r) => r.code === "snapshot_review_mismatch"));
  assert.equal(result.numericDelta, null);
  assert.deepEqual(result.unresolvedRegionIds.after, ["after-0"]);
});

test("samples and cross-area observations do not generate a cross-scope species ledger", () => {
  const a = observation("before"),
    b = observation("after");
  b.source = "sample";
  assert.deepEqual(compareObservations(a, b).ledger, []);
  b.source = "upload";
  b.areaId = "back";
  assert.deepEqual(compareObservations(a, b).ledger, []);
});

test("connected observation series requires three adjacent eligible saved observations and preserves gaps", async () => {
  const { comparableObservationSeries } =
    await import("../lib/observation-series");
  const a = observation("before"),
    b = observation("after");
  const c = {
    ...observation("after"),
    id: "third",
    photoPath: "owner/third.jpg",
    capture: {
      ...b.capture,
      capturedAt: "2025-06-01T12:00:00Z",
      imageSha256: "3".repeat(64),
    },
  };
  b.comparisonEvidenceHistory = [evidence(a, b)];
  c.comparisonEvidenceHistory = [evidence(b, c)];
  assert.equal(comparableObservationSeries([a, b]).length, 0);
  assert.deepEqual(
    comparableObservationSeries([c, a, b]).map((rows) => rows.map((s) => s.id)),
    [["before", "after", "third"]],
  );
  c.capture = { ...c.capture, photoPointConfirmed: false };
  assert.equal(comparableObservationSeries([a, b, c]).length, 0);
  assert.equal(a.assessmentHistory!.at(-1)!.score, 100);
});
