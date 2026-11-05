import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { analyzePhotoWithMetadata, analyzePhoto, ANALYSIS_PIPELINE_VERSION } from "../lib/recognition/pipeline";
import { detectPlants } from "../lib/recognition/gemini";

const region = { box_2d: [0, 0, 900, 900], kind: "tree", common_name_guess: "White oak", scientific_name_guess: "Quercus alba", organ: "leaf" };
const response = (modelVersion?: string) => Response.json({
  ...(modelVersion ? { modelVersion } : {}),
  candidates: [{ content: { parts: [{ text: JSON.stringify({ plants: [region] }) }] } }],
});
const pnResponse = (version?: string) => Response.json({
  ...(version ? { version } : {}),
  results: [{ score: 0.8, species: { scientificNameWithoutAuthor: "Quercus alba", commonNames: ["White oak"] } }],
});
async function isolated(run: () => Promise<void>) {
  const fetch = globalThis.fetch;
  const keys = ["GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_FALLBACK_MODEL", "PLANTNET_API_KEY", "PLANTNET_PROJECT"];
  const prior = keys.map(key => process.env[key]);
  process.env.GEMINI_API_KEY = "test-provider-key";
  process.env.GEMINI_MODEL = "primary-alias";
  process.env.GEMINI_FALLBACK_MODEL = "fallback-alias";
  delete process.env.PLANTNET_API_KEY;
  process.env.PLANTNET_PROJECT = "k-world-flora";
  try { await run(); } finally {
    globalThis.fetch = fetch;
    keys.forEach((key, i) => prior[i] === undefined ? delete process.env[key] : process.env[key] = prior[i]);
  }
}

test("new upload records successful fallback and returned model version, never capture date or a secret", () => isolated(async () => {
  const requests: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input); requests.push(url);
    return url.includes("primary-alias") ? new Response("unavailable", { status: 503 }) : response("provider-model-2026-01");
  };
  const data = Buffer.from("normalized upload bytes");
  const result = await analyzePhotoWithMetadata(data, 100, 100);
  assert.equal(requests.length, 2);
  assert.equal(result.providers[0].requestedModel, "fallback-alias");
  assert.equal(result.capture.method!.modelVersion, "provider-model-2026-01");
  assert.match(result.providers[0].promptVersion, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.capture.method!.pipelineVersion, `${ANALYSIS_PIPELINE_VERSION}:yard`);
  assert.equal(result.capture.imageSha256, createHash("sha256").update(data).digest("hex"));
  assert.equal(result.capture.capturedAt, undefined);
  assert.equal(result.capture.photoPointConfirmed, undefined);
  assert.equal(result.plants[0].yardScope, "yard");
  assert.equal(result.plants[0].reviewed, false);
  assert.ok(!JSON.stringify(result).includes("test-provider-key"));
}));

test("missing or moving provider model version remains unknown rather than using the requested alias", () => isolated(async () => {
  for (const reported of [undefined, "gemini-flash-latest"]) {
    globalThis.fetch = async () => response(reported);
    const result = await analyzePhotoWithMetadata(Buffer.alloc(0), 100, 100);
    assert.equal(result.capture.method!.modelVersion, undefined);
    assert.equal(result.providers[0].requestedModel, "primary-alias");
    assert.equal(result.providers[0].modelVersion, reported);
  }
}));

test("a secondary classifier with no reported version makes the combined method unknown", () => isolated(async () => {
  process.env.PLANTNET_API_KEY = "secondary-test-key";
  globalThis.fetch = async input => String(input).includes("plantnet.org") ? pnResponse() : response("gemini-fixed-002");
  const image = await sharp({ create: { width: 100, height: 100, channels: 3, background: "green" } }).jpeg().toBuffer();
  const result = await analyzePhotoWithMetadata(image, 100, 100);
  assert.equal(result.providers.length, 2);
  assert.equal(result.capture.method!.provider, "Google Gemini + Pl@ntNet");
  assert.equal(result.capture.method!.modelVersion, undefined);
  assert.match(result.providers.find(p => p.provider === "Pl@ntNet")!.promptVersion, /project=k-world-flora/);
}));

test("returned secondary versions are retained and mixed method serialization is deterministic", () => isolated(async () => {
  process.env.PLANTNET_API_KEY = "secondary-test-key";
  globalThis.fetch = async input => String(input).includes("plantnet.org") ? pnResponse("plantnet-2025-01") : response("gemini-fixed-002");
  const image = await sharp({ create: { width: 100, height: 100, channels: 3, background: "green" } }).jpeg().toBuffer();
  const a = await analyzePhotoWithMetadata(image, 100, 100);
  const b = await analyzePhotoWithMetadata(image, 100, 100);
  assert.equal(a.capture.method!.modelVersion, b.capture.method!.modelVersion);
  assert.deepEqual(JSON.parse(a.capture.method!.modelVersion!), [["Google Gemini", "gemini-fixed-002"], ["Pl@ntNet", "plantnet-2025-01"]]);
}));

test("single-plant fallback records only the successful source and retains compatibility array APIs", () => isolated(async () => {
  process.env.PLANTNET_API_KEY = "secondary-test-key";
  globalThis.fetch = async input => String(input).includes("plantnet.org") ? pnResponse("plantnet-fixed") : new Response("unavailable", { status: 503 });
  const result = await analyzePhotoWithMetadata(Buffer.alloc(0), 100, 100, { mode: "plant" });
  assert.equal(result.capture.method!.provider, "Pl@ntNet");
  assert.equal(result.capture.method!.modelVersion, "plantnet-fixed");
  assert.equal(result.capture.method!.pipelineVersion, `${ANALYSIS_PIPELINE_VERSION}:plant`);
  assert.equal(result.providers.length, 1);
  delete process.env.PLANTNET_API_KEY;
  globalThis.fetch = async () => response("fixed-model");
  assert.ok(Array.isArray(await analyzePhoto(Buffer.alloc(0), 100, 100)));
  const detections = await detectPlants(Buffer.alloc(0), "image/jpeg", "test-provider-key");
  assert.ok(Array.isArray(detections));
  assert.equal(Object.hasOwn(detections, "modelVersion"), false);
}));
