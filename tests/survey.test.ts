import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import activeSamples from "../data/reference-samples.v6.json";
import archivedCanopySamples from "../data/reference-samples.v3.json";
import { legacySurvey } from "./fixtures/reference-survey";
import {
  scanComparison,
  withScoreSnapshot,
  catalog,
  exampleSurvey,
  normalizeBox,
  summary,
  scoreContributions,
  type Survey,
} from "../lib/survey";
import {
  analyzePhoto,
  refinePhoto,
  prepareImage,
} from "../lib/recognition/pipeline";
import sharp from "sharp";
import {
  enrichNjPlant,
  nativePlantingOption,
  NJ_EVIDENCE_VERSION,
  profileStatus,
} from "../lib/nj-evidence";
import njEvidence from "../data/nj-evidence.v2.json";

test("category score contributions reconcile penalties, bonuses and limits independently of region share", () => {
  const sample = legacySurvey();
  const parts = scoreContributions(sample);
  const key = parts.entries.find((e) => e.status === "keystone")!;
  assert.ok(Math.abs(key.points - 200 / summary(sample).speciesCount) < 0.0001);
  assert.equal(Math.round(key.regionShare), 33);
  assert.ok(Math.abs(parts.entries.find((e) => e.status === "invasive")!.points + 100 / 6) < 0.0001);
  assert.ok(
    Math.abs(
      parts.entries.reduce((sum, e) => sum + e.points, 0) +
        parts.bonuses +
        parts.adjustment -
        summary(sample).score!,
    ) < 0.0001,
  );
  const duplicated = scoreContributions({
    ...sample,
    plants: [...sample.plants, { ...sample.plants[5], id: "duplicate" }],
  });
  assert.equal(
    duplicated.entries.find((e) => e.status === "keystone")!.points,
    key.points,
  );
  assert.notEqual(
    duplicated.entries.find((e) => e.status === "keystone")!.regionShare,
    key.regionShare,
  );
  const allInvasive = { ...sample, plants: sample.plants.slice(0, 2) };
  assert.equal(summary(allInvasive).score, 0);
  assert.ok(
    scoreContributions(allInvasive).entries.every((e) =>
      Number.isFinite(e.points),
    ),
  );
  const unknown = {
    ...sample,
    plants: sample.plants.map((p) => ({
      ...p,
      plantId: undefined,
      scientificName: "Unknown plant",
    })),
  };
  assert.ok(scoreContributions(unknown).entries.every((e) => e.points === 0));
});

test("NJ evidence preserves source scope, ecological status and conservation exclusions", () => {
  assert.equal(
    withScoreSnapshot(exampleSurvey()).assessmentHistory?.[0].catalogVersion,
    NJ_EVIDENCE_VERSION,
  );
  assert.equal(
    summary({
      ...exampleSurvey(),
      plants: exampleSurvey(undefined, "back-yard").plants.map((p) => ({ ...p, reviewed: true })),
    }).provisional,
    false,
  );
  assert.equal(njEvidence.native.length, 1519);
  assert.equal(njEvidence.legal.length, 30);
  assert.equal(new Set(catalog.map((p) => p.id)).size, catalog.length);
  const maple = catalog.find((p) => p.scientificName === "Acer palmatum")!;
  assert.equal(maple.status, "invasive");
  assert.equal(maple.njEvidence?.invasiveStatus, "Emerging");
  assert.equal(maple.njEvidence?.legalListed, false);
  const barberry = catalog.find(
    (p) => p.scientificName === "Berberis thunbergii",
  )!;
  assert.equal(barberry.njEvidence?.legalListed, true);
  assert.match(barberry.njEvidence!.note, /phased in/);
  const oak = catalog.find((p) => p.scientificName === "Quercus alba")!;
  assert.ok(nativePlantingOption(oak));
  assert.ok(oak.njEvidence!.ecoregions.length);
  const redbud = catalog.find((p) => p.scientificName === "Cercis canadensis")!;
  assert.equal(redbud.njEvidence?.native, true);
  assert.equal(nativePlantingOption(redbud), false);
  const ornamental = catalog.find((p) => p.scientificName === "Hosta spp.")!;
  assert.equal(ornamental.njEvidence?.native, null);
  assert.equal(profileStatus(ornamental), "unverified");
  assert.match(ornamental.njEvidence!.note, /earns no ecological score points/);
  const conflict = enrichNjPlant({
    ...oak,
    scientificName: "Phalaris arundinacea",
  });
  assert.equal(conflict.njEvidence?.native, null);
  assert.equal(nativePlantingOption(conflict), false);
  assert.ok(catalog.find((p) => p.scientificName === "Myriophyllum spicatum"));
});

function observed(
  areaId: string,
  year: number,
  source: "sample" | "upload" = "upload",
): Survey {
  const s = exampleSurvey();
  return {
    ...s,
    areaId,
    createdAt: `${year}-06-01T12:00:00Z`,
    source,
    plants: s.plants.map((p) => ({
      ...p,
      plantId: p.plantId || "acer-palmatum",
      reviewed: true,
    })),
  };
}
test("four ecological categories are retained; uncertainty is separate", () => {
  assert.deepEqual([...new Set(catalog.map((p) => p.status))].sort(), [
    "invasive",
    "keystone",
    "native",
    "non-native",
  ]);
  const s = exampleSurvey();
  const result = summary(s);
  assert.equal(
    Object.values(result.counts).reduce((a, b) => a + b, 0),
    s.plants.length,
  );
  assert.equal(result.assessed + result.counts.unverified, result.total);
});
test("unidentified plants never receive a poor ecosystem score", () => {
  const s = exampleSurvey();
  s.plants = s.plants.map((p) => ({
    ...p,
    plantId: undefined,
    scientificName: "",
    reviewed: false,
  }));
  assert.equal(summary(s).score, null);
  assert.equal(summary(s).nativeShare, null);
  assert.equal(summary(s).counts.unverified, s.plants.length);
});
test("adding uncertain detections does not lower the reviewed score", () => {
  const s = observed("a", 2025);
  const before = summary(s);
  const unknown = {
    ...s.plants[0],
    id: "unknown",
    scientificName: "",
    reviewed: false,
    plantId: undefined,
  };
  const after = summary({ ...s, plants: [...s.plants, unknown] });
  assert.equal(before.score, after.score);
  assert.equal(before.nativeShare, after.nativeShare);
  assert.equal(after.total, before.total + 1);
});
test("repeat-scan comparisons include provisional same-year scans and exclude other areas and samples", () => {
  const first = observed("a", 2026),
    next = {
      ...observed("a", 2026),
      createdAt: "2026-07-01T12:00:00Z",
      plants: exampleSurvey().plants,
    };
  const rows = scanComparison(
    [next, first, observed("b", 2026), observed("a", 2027, "sample")],
    "a",
  );
  assert.deepEqual(
    rows.map((row) => row.survey.id),
    [first.id, next.id],
  );
  assert.equal(rows[1].reviewed, 0);
  assert.ok(rows[1].score !== null);
});
test("separate dated scans within one day remain in the timeline", () => {
  const first = { ...observed("a", 2026), createdAt: "2026-06-01T08:00:00Z" },
    next = { ...observed("a", 2026), createdAt: "2026-06-01T16:00:00Z" };
  assert.deepEqual(
    scanComparison([next, first], "a").map((r) => r.survey.id),
    [first.id, next.id],
  );
});
test("detector coordinates remain finite and within image bounds", () => {
  assert.deepEqual(normalizeBox([-20, 50, 1100, 1050]), {
    x: 5,
    y: 0,
    w: 95,
    h: 100,
  });
  assert.equal(normalizeBox([10, 100, 20, 50]), null);
  assert.equal(normalizeBox([0, 0, NaN, 100]), null);
});
test("recognition retains unknown species and marks all initial identities provisional", async () => {
  const fetchBefore = globalThis.fetch,
    gemini = process.env.GEMINI_API_KEY,
    plantnet = process.env.PLANTNET_API_KEY;
  process.env.GEMINI_API_KEY = "test-only-not-a-real-key";
  delete process.env.PLANTNET_API_KEY;
  globalThis.fetch = async () =>
    Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  plants: [
                    {
                      box_2d: [100, 100, 700, 700],
                      kind: "shrub",
                      common_name_guess: "Mystery shrub",
                      scientific_name_guess: "Unknownus testus",
                    },
                    {
                      box_2d: [0, 0, 900, 900],
                      kind: "lawn",
                      common_name_guess: "lawn",
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });
  try {
    const plants = await analyzePhoto(Buffer.alloc(0), 1000, 1000);
    assert.equal(plants.length, 1);
    assert.equal(plants[0].plantId, undefined);
    assert.equal(plants[0].suggestion, "Mystery shrub");
    assert.equal(plants[0].reviewed, false);
    assert.equal(plants[0].confidence, undefined);
  } finally {
    globalThis.fetch = fetchBefore;
    restore("GEMINI_API_KEY", gemini);
    restore("PLANTNET_API_KEY", plantnet);
  }
});
test("missing providers produce an error instead of fabricated leaf traits", async () => {
  const g = process.env.GEMINI_API_KEY,
    p = process.env.PLANTNET_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.PLANTNET_API_KEY;
  try {
    await assert.rejects(
      refinePhoto(Buffer.alloc(0), "leaf"),
      /needs a configured/,
    );
  } finally {
    restore("GEMINI_API_KEY", g);
    restore("PLANTNET_API_KEY", p);
  }
});
test("image preprocessing returns a correctly sized JPEG and rejects unreadable images", async () => {
  const png = await sharp({
    create: { width: 200, height: 120, channels: 3, background: "#56854a" },
  })
    .png()
    .toBuffer();
  const out = await prepareImage(
    new File([png], "yard.png", { type: "image/png" }),
  );
  assert.equal(out.width, 200);
  assert.equal(out.height, 120);
  assert.ok(out.photo.startsWith("data:image/jpeg;base64,"));
  await assert.rejects(prepareImage(new File(["not an image"], "bad.jpg")));
});
test("sample regions are provisional and stay within the photograph", () => {
  assert.ok(
    exampleSurvey().plants.every(
      (p) =>
        !p.reviewed &&
        p.box.x >= 0 &&
        p.box.y >= 0 &&
        p.box.x + p.box.w <= 100 &&
        p.box.y + p.box.h <= 100,
    ),
  );
});
function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
test("saved survey cannot be silently reassigned to a different yard area", async () => {
  const { saveSurvey } = await import("../lib/account/repository");
  await assert.rejects(
    saveSurvey(observed("front-yard", 2025), "back-yard"),
    /another yard area/,
  );
});
test("whole-photo API accepts a session key and produces a real upload survey with unknown regions", async () => {
  const { POST } = await import("../app/api/analyze/route");
  const before = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(
      (options?.headers as Record<string, string>)["x-goog-api-key"],
      "test-tab-key",
    );
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  plants: [
                    {
                      box_2d: [50, 100, 900, 850],
                      kind: "shrub",
                      common_name_guess: "Unknown shrub",
                      scientific_name_guess: "Unknownus shrubbus",
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });
  };
  const g = process.env.GEMINI_API_KEY,
    p = process.env.PLANTNET_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.PLANTNET_API_KEY;
  try {
    const bytes = await sharp({
      create: { width: 200, height: 150, channels: 3, background: "#648b51" },
    })
      .jpeg()
      .toBuffer();
    const form = new FormData();
    form.set("zip", "07645");
    form.set("file", new File([bytes], "yard.jpg", { type: "image/jpeg" }));
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "x-gemini-api-key": "test-tab-key" },
        body: form,
      }),
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.source, "upload");
    assert.equal(result.plants.length, 1);
    assert.equal(result.plants[0].reviewed, false);
    assert.equal(result.plants[0].plantId, undefined);
    assert.ok(result.photo.startsWith("data:image/jpeg;"));
    assert.equal(JSON.stringify(result).includes("test-tab-key"), false);
  } finally {
    globalThis.fetch = before;
    restore("GEMINI_API_KEY", g);
    restore("PLANTNET_API_KEY", p);
  }
});
test("API rejects non-image uploads and malformed bodies without calling a provider", async () => {
  const { POST } = await import("../app/api/analyze/route");
  const form = new FormData();
  form.set("zip", "07645");
  form.set(
    "file",
    new File(["pdf"], "document.pdf", { type: "application/pdf" }),
  );
  const response = await POST(
    new Request("http://localhost/api/analyze", { method: "POST", body: form }),
  );
  assert.equal(response.status, 415);
  assert.match((await response.json()).error, /JPEG/);
  const bad = await POST(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "bad" }),
    }),
  );
  assert.equal(bad.status, 400);
});
test("unreadable images and oversized images receive specific actionable input errors", async () => {
  const { ImageInputError, validateFile } =
    await import("../lib/recognition/pipeline");
  await assert.rejects(
    prepareImage(new File(["wrong bytes"], "yard.jpg", { type: "image/jpeg" })),
    (error: unknown) =>
      error instanceof ImageInputError && error.status === 415,
  );
  assert.throws(
    () =>
      validateFile(
        new File([new Uint8Array(12 * 1024 * 1024 + 1)], "large.jpg", {
          type: "image/jpeg",
        }),
      ),
    (error: unknown) =>
      error instanceof ImageInputError && error.status === 413,
  );
});
test("HTML timeout and size-limit responses get useful errors rather than JSON syntax failures", async () => {
  const { photoResponse } = await import("../lib/photo-upload");
  await assert.rejects(
    photoResponse(
      new Response("<html>Too large</html>", {
        status: 413,
        headers: { "content-type": "text/html" },
      }),
    ),
    /upload limit/,
  );
  await assert.rejects(
    photoResponse(
      new Response("<html>Timeout</html>", {
        status: 504,
        headers: { "content-type": "text/html" },
      }),
    ),
    /timed out/,
  );
  await assert.rejects(
    photoResponse(
      Response.json({ error: "Provider key rejected" }, { status: 502 }),
    ),
    /Provider key rejected/,
  );
});

test("Yard failure is explicit; only One plant mode permits whole-photo PlantNet fallback", async () => {
  const before = globalThis.fetch;
  const g = process.env.GEMINI_API_KEY,
    p = process.env.PLANTNET_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.PLANTNET_API_KEY = "test-fallback";
  globalThis.fetch = async (url) =>
    String(url).includes("plantnet.org")
      ? Response.json({
          results: [
            {
              score: 0.9,
              species: {
                scientificNameWithoutAuthor: "Berberis thunbergii",
                commonNames: ["Japanese barberry"],
              },
            },
          ],
        })
      : Response.json({ error: { status: "NOT_FOUND" } }, { status: 404 });
  try {
    await assert.rejects(
      analyzePhoto(Buffer.alloc(0), 100, 100),
      /multi-plant scan did not finish/,
    );
    const result = await analyzePhoto(Buffer.alloc(0), 100, 100, {
      mode: "plant",
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].reviewed, false);
    assert.match(result[0].note || "", /Whole-photo fallback/);
    assert.deepEqual(result[0].box, { x: 0, y: 0, w: 100, h: 100 });
    assert.equal(result[0].scientificName, "Berberis thunbergii");
  } finally {
    globalThis.fetch = before;
    restore("GEMINI_API_KEY", g);
    restore("PLANTNET_API_KEY", p);
  }
});
test("dense-yard detection retains up to 24 regions rather than truncating at twelve", async () => {
  const before = globalThis.fetch,
    g = process.env.GEMINI_API_KEY,
    p = process.env.PLANTNET_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.PLANTNET_API_KEY;
  globalThis.fetch = async () =>
    Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  plants: Array.from({ length: 26 }, (_, i) => ({
                    box_2d: [i * 10, i * 10, i * 10 + 100, i * 10 + 100],
                    kind: "shrub",
                    common_name_guess: `Plant ${i}`,
                    scientific_name_guess: "",
                  })),
                }),
              },
            ],
          },
        },
      ],
    });
  try {
    const result = await analyzePhoto(Buffer.alloc(0), 100, 100);
    assert.equal(result.length, 24);
    assert.ok(result.every((p) => !p.reviewed));
    assert.ok(result.every((p) => p.plantId === undefined));
  } finally {
    globalThis.fetch = before;
    restore("GEMINI_API_KEY", g);
    restore("PLANTNET_API_KEY", p);
  }
});
test("an overloaded detector uses one bounded alternative instead of falling straight to one whole-photo match", async () => {
  const { detectPlants } = await import("../lib/recognition/gemini");
  const before = globalThis.fetch;
  const model = process.env.GEMINI_MODEL;
  process.env.GEMINI_MODEL = "primary-test";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? Response.json({ error: { status: "UNAVAILABLE" } }, { status: 503 })
      : Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      plants: [
                        {
                          box_2d: [0, 0, 400, 400],
                          kind: "shrub",
                          common_name_guess: "Shrub",
                          scientific_name_guess: "",
                        },
                        {
                          box_2d: [500, 500, 900, 900],
                          kind: "grass",
                          common_name_guess: "Grass",
                          scientific_name_guess: "",
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        });
  };
  try {
    const result = await detectPlants(
      Buffer.alloc(0),
      "image/jpeg",
      "test-only-key",
    );
    assert.equal(result.length, 2);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = before;
    restore("GEMINI_MODEL", model);
  }
});
test("old sample drafts are upgraded without rewriting real uploaded surveys", async () => {
  const { refreshSampleSurvey } = await import("../lib/survey");
  const old = exampleSurvey();
  delete old.sampleVersion;
  old.plants[0].box = { x: 47, y: 73, w: 19, h: 17 };
  old.plants[0].reviewed = true;
  const upgraded = refreshSampleSurvey(old);
  assert.equal(upgraded.id, old.id);
  assert.equal(upgraded.sampleVersion, 6);
  assert.ok(upgraded.plants.every((p) => !p.reviewed));
  assert.equal(upgraded.photo, exampleSurvey().photo);
  assert.equal(upgraded.sampleId, "front-yard");
  const real = { ...old, source: "upload" as const };
  assert.equal(refreshSampleSurvey(real), real);
});
test("PlantNet references retain source, author and license instead of discarding API image data", async () => {
  const { identifyPlant } = await import("../lib/recognition/plantnet");
  const before = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).includes("include-related-images=true"));
    return Response.json({
      results: [
        {
          score: 0.9,
          species: {
            scientificNameWithoutAuthor: "Cotinus coggygria",
            commonNames: ["Smoketree"],
          },
          images: [
            {
              url: { m: "https://bs.plantnet.org/image/m/test" },
              author: "Botanical contributor",
              license: "cc-by-sa",
              citation: "Botanical contributor / Pl@ntNet, cc-by-sa",
            },
          ],
        },
      ],
    });
  };
  try {
    const result = await identifyPlant(Buffer.alloc(0), "leaf", "test-key");
    assert.equal(
      result.candidates[0].images[0].author,
      "Botanical contributor",
    );
    assert.equal(result.candidates[0].images[0].license, "cc-by-sa");
  } finally {
    globalThis.fetch = before;
  }
});

test("the exact three reference samples have immediate provisional estimates and isolated review state", async () => {
  const { sampleYards } = await import("../lib/sample-yards");
  assert.deepEqual(
    sampleYards.map((s) => s.id),
    ["front-yard", "back-yard", "side-yard"],
  );
  assert.deepEqual(
    sampleYards.map((s) => s.title),
    ["Mixed foundation garden", "Pollinator Backyard", "Native-rich mixed garden"],
  );
  assert.deepEqual(sampleYards.map((sample) => sample.plants.length), [6, 9, 6]);
  assert.deepEqual(sampleYards.map((sample) => summary(exampleSurvey(undefined, sample.id)).score), [25, 60, 85]);
  for (const sample of sampleYards) {
    const s = exampleSurvey("07645", sample.id);
    assert.equal(s.photo, sample.photo);
    assert.ok(s.plants.every((p) => !p.reviewed));
    assert.ok(summary(s).score !== null);
    assert.equal(summary(s).provisional, true);
    s.plants[0].reviewed = true;
    assert.equal(exampleSurvey(undefined, sample.id).plants[0].reviewed, false);
  }
});
test("reference sample regions leave visible paving and lawn points unboxed", () => {
  for (const [id, x, y] of [
    ["front-yard", 45, 95],
    ["front-yard", 60, 97],
    ["back-yard", 10, 80],
    ["side-yard", 50, 99],
  ] as const) {
    assert.ok(
      exampleSurvey(undefined, id).plants.every(
        ({ box: b }) =>
          !(b.x <= x && x <= b.x + b.w && b.y <= y && y <= b.y + b.h),
      ),
      id,
    );
  }
});
test("sample API serves the chosen NJ snapshot and rejects unknown sample IDs", async () => {
  const { POST } = await import("../app/api/analyze/route");
  const request = (sampleId: string) =>
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sample: true, sampleId }),
    });
  const response = await POST(request("side-yard"));
  assert.equal(response.status, 200);
  const survey = await response.json();
  assert.equal(survey.sampleId, "side-yard");
  assert.equal(survey.source, "sample");
  assert.equal(survey.zip, "08902");
  assert.equal((await POST(request("not-a-real-yard"))).status, 404);
});

test("analysis JSON input errors return 400 without blaming a provider or photo", async () => {
  const { POST } = await import("../app/api/analyze/route");
  for (const body of [
    "{",
    "null",
    "[]",
    "123",
    JSON.stringify({ sample: true, sampleId: [] }),
    JSON.stringify({ sample: true, zip: 42 }),
  ]) {
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );
    assert.equal(response.status, 400, body);
    const data = await response.json();
    assert.match(data.code, /invalid_json|invalid_request/);
    assert.doesNotMatch(data.error, /provider|JPEG|HEIC/i);
  }
});

test("provisional scores use mapped suggestions immediately and duplicate species add no bonus", () => {
  const s = exampleSurvey(undefined, "front-yard"),
    before = summary(s);
  assert.equal(before.score, 25);
  assert.equal(before.reviewed, 0);
  assert.equal(before.coverage, 100);
  assert.equal(before.provisional, true);
  const repeated = { ...s.plants.find((plant) => plant.plantId === "berberis-thunbergii")!, id: "duplicate-barberry" };
  assert.equal(
    summary({ ...s, plants: [...s.plants, repeated] }).score,
    before.score,
  );
  assert.equal(
    summary({ ...s, plants: s.plants.map((p) => ({ ...p, reviewed: true })) })
      .score,
    before.score,
  );
  const corrected = {
    ...s,
    plants: s.plants.map((p) =>
      p.plantId === "berberis-thunbergii"
        ? {
            ...p,
            plantId: "quercus-rubra",
            scientificName: "Quercus rubra",
            reviewed: true,
          }
        : p,
    ),
  };
  assert.ok(summary(corrected).score! > before.score!);
});
test("unknown regions change coverage without receiving native points", () => {
  const s = exampleSurvey(),
    before = summary(s),
    unknown = {
      ...s.plants[0],
      id: "unknown-region",
      plantId: undefined,
      scientificName: "Unidentified species",
      reviewed: false,
    };
  const after = summary({ ...s, plants: [...s.plants, unknown] });
  assert.equal(after.score, before.score);
  assert.equal(after.nativeShare, before.nativeShare);
  assert.equal(after.unknown, before.unknown + 1);
  assert.equal(
    after.coverage,
    Math.round((before.assessed / (before.total + 1)) * 100),
  );
  assert.equal(after.provisional, true);
  const partial = summary({
    ...s,
    plants: [s.plants.find((plant) => plant.plantId === "berberis-thunbergii")!, unknown, { ...unknown, id: "unknown-2" }],
  });
  assert.equal(partial.assessed, 1);
  assert.equal(partial.grade, "A first glimpse");
});
test("saved score snapshots retain prior values and only append when the assessment changes", () => {
  const s = withScoreSnapshot({
    ...exampleSurvey(),
    source: "upload",
    areaId: "a1",
  });
  assert.equal(s.assessmentHistory?.length, 1);
  assert.equal(s.assessmentHistory?.[0].provisional, true);
  assert.equal(withScoreSnapshot(s), s);
  const original = structuredClone(s.assessmentHistory![0]);
  const changed = withScoreSnapshot({
    ...s,
    plants: s.plants.map((p) =>
      p.plantId === "berberis-thunbergii"
        ? {
            ...p,
            plantId: "quercus-rubra",
            scientificName: "Quercus rubra",
            reviewed: true,
          }
        : p,
    ),
  });
  assert.equal(changed.assessmentHistory?.length, 2);
  assert.deepEqual(changed.assessmentHistory?.[0], original);
  assert.ok(changed.assessmentHistory![1].score! > original.score!);
  assert.equal(
    scanComparison([changed, { ...changed, id: "other", areaId: "a2" }], "a1")
      .length,
    1,
  );
  assert.equal(
    scanComparison([changed], "a1")[0].score,
    changed.assessmentHistory![1].score,
  );
});


test("archived licensed canopy fixture preserves source evidence independently of new illustrative samples", async () => {
  const sample = archivedCanopySamples.find((row) => row.id === "side-yard")!;
  const bytes = readFileSync(new URL("../public" + sample.photo, import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sample.evidence.imageSha256);
  const info = await sharp(bytes).metadata();
  assert.deepEqual([info.width, info.height], [1920, 1440]);
  assert.equal(sample.evidence.license, "CC BY-SA 4.0");
  assert.equal(sample.evidence.licenseUrl?.replace(/\/$/, ""), "https://creativecommons.org/licenses/by-sa/4.0");
  assert.equal(sample.evidence.author, "Famartin");
  assert.equal(sample.evidence.provisional, true);
  assert.equal(sample.evidence.photoEstimateOnly, true);
  assert.deepEqual(sample.evidence.regionCoverage, { assessed: 2, total: 3 });
  const oak = sample.plants.find((plant) => plant.scientificName === "Quercus")!;
  assert.ok(oak);
  assert.equal("plantId" in oak, false);
  assert.equal(summary({ source: "sample", plants: sample.plants }).counts.unverified, 1);
});

test("sample factory, summaries and sample API use cached fixtures without provider requests", async () => {
  const { POST } = await import("../app/api/analyze/route");
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("Samples must not call a provider"); };
  try {
    for (const sample of activeSamples) {
      assert.equal(summary(exampleSurvey(undefined, sample.id)).score, sample.evidence.computedScore);
      const response = await POST(new Request("http://localhost/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sample: true, sampleId: sample.id }) }));
      assert.equal(response.status, 200);
      const survey = await response.json();
      assert.equal(survey.sampleId, sample.id);
      assert.equal(survey.plants.length, sample.plants.length);
    }
    assert.equal(requests, 0);
  } finally { globalThis.fetch = previousFetch; }
});


test("planned mixed-garden illustrations have six explicit intended taxa and computed scores without botanical-model claims", async () => {
  for (const id of ["front-yard", "side-yard"]) {
    const sample = activeSamples.find((row) => row.id === id)!;
    const bytes = readFileSync(new URL("../public" + sample.photo, import.meta.url));
    const metadata = await sharp(bytes).metadata();
    assert.deepEqual([metadata.width, metadata.height], [1536, 1024]);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sample.evidence.imageSha256);
    assert.equal(sample.imageKind, "generated-illustration");
    assert.equal(sample.evidence.origin, "planned-illustration");
    assert.equal(sample.evidence.intendedSpeciesNotIdentifications, true);
    assert.equal(sample.evidence.providerCalls, 0);
    assert.equal(sample.evidence.successfulPhotographicAnalyses, 0);
    assert.equal(sample.evidence.illustrativePlanEstimateOnly, true);
    assert.ok(sample.plants.every((p) => p.reviewed === false && /intended species|intended planting/i.test(p.note)));
    assert.equal(new Set(sample.plants.map((p) => p.plantId)).size, 6);
    const actual = summary(exampleSurvey(undefined, id));
    assert.equal(actual.score, sample.evidence.computedScore);
    assert.equal(actual.provisional, true);
  }
  assert.deepEqual(summary(exampleSurvey(undefined, "front-yard")).counts, { keystone: 1, native: 1, "non-native": 3, invasive: 1, unverified: 0 });
  assert.deepEqual(summary(exampleSurvey(undefined, "side-yard")).counts, { keystone: 2, native: 3, "non-native": 1, invasive: 0, unverified: 0 });
});
