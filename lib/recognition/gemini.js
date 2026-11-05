/**
 * Plant detector adapter: Google Gemini (free tier).
 * detect(imageBuffer) → [{ box: [ymin, xmin, ymax, xmax] (0–1000), kind, label, guessCommon, guessScientific, organ }]
 */

import { createHash } from "node:crypto";

const PROMPT = `You are a horticulture expert analyzing a photo of a residential yard in New Jersey, USA.

Detect every distinct, individually identifiable plant (or a single-species clump) in the image:
trees, shrubs, perennials, groundcovers, vines, ornamental grasses and ferns.

Rules:
- One box per plant or single-species clump. Do NOT box mixed areas.
- Ignore plants that are tiny, blurry or far in the background (e.g., distant woods or neighbors' trees).
- Return lawn as kind "lawn" (one box covering the main lawn area). Do not return mulch, soil, or hardscape.
- Return at most 24 plants. In dense mixed planting, include distinct foreground mounds, grasses, low groundcovers and shrubs as well as trees. Do not merge clearly different foliage textures or colors into one region. An uncertain species name must not prevent returning a visible plant region; use an empty scientific name when uncertain.
- box_2d is [ymin, xmin, ymax, xmax], integers normalized to 0–1000.
- Give your best guess of the common and scientific (genus species) name.
- organ is the most visible identifying part: "flower", "leaf", "fruit", "bark", or "habit".`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    plants: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          box_2d: { type: "ARRAY", items: { type: "INTEGER" } },
          kind: {
            type: "STRING",
            enum: [
              "tree",
              "shrub",
              "perennial",
              "groundcover",
              "vine",
              "grass",
              "fern",
              "lawn",
            ],
          },
          common_name_guess: { type: "STRING" },
          scientific_name_guess: { type: "STRING" },
          organ: {
            type: "STRING",
            enum: ["flower", "leaf", "fruit", "bark", "habit"],
          },
        },
        required: [
          "box_2d",
          "kind",
          "common_name_guess",
          "scientific_name_guess",
        ],
      },
    },
  },
  required: ["plants"],
};

const DETECTION_CONFIG = {
  responseMimeType: "application/json",
  responseSchema: SCHEMA,
  maxOutputTokens: 6000,
  temperature: 0.2,
};
export const DETECTION_PROMPT_VERSION = `sha256:${createHash("sha256")
  .update(JSON.stringify({ prompt: PROMPT, generationConfig: DETECTION_CONFIG }))
  .digest("hex")}`;

/**
 * Array-only compatibility API. New uploads use the metadata-returning adapter.
 * @param {Buffer} imageBuffer @param {string} mimeType @param {string|null} customApiKey
 */
export async function detectPlants(imageBuffer, mimeType = "image/jpeg", customApiKey = null) {
  return (await detectPlantsWithMetadata(imageBuffer, mimeType, customApiKey)).plants;
}

/** @param {Buffer} imageBuffer @param {string} mimeType @param {string|null} customApiKey */
export async function detectPlantsWithMetadata(
  imageBuffer,
  mimeType = "image/jpeg",
  customApiKey = null,
) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new Error(
      "GEMINI_API_KEY is not set. Please provide it in the app settings or in .env.local",
    );

  const candidates = [
    ...new Set([
      process.env.GEMINI_MODEL || "gemini-3.5-flash",
      process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite",
    ]),
  ];
  const deadline = Date.now() + 55000;

  let lastError = null;

  for (const model of candidates) {
    const remaining = deadline - Date.now();
    if (remaining < 2000) break;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: imageBuffer.toString("base64"),
                    },
                  },
                  { text: PROMPT },
                ],
              },
            ],
            generationConfig: DETECTION_CONFIG,
          }),
          signal: AbortSignal.timeout(Math.min(35000, remaining)),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        // If 503 (overloaded) or 404 (model not found), try next candidate
        if (res.status === 503 || res.status === 404) {
          lastError = new Error(
            `Model ${model} returned ${res.status}: ${body.slice(0, 150)}`,
          );
          continue;
        }
        throw new Error(`Gemini error ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = await res.json();
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") || "{}";
      const parsed = JSON.parse(text);
      const plants = (parsed.plants || [])
        .filter((p) => Array.isArray(p.box_2d) && p.box_2d.length === 4)
        .map((p) => ({
          box: p.box_2d.map((v) => Math.max(0, Math.min(1000, Math.round(v)))),
          kind: p.kind,
          guessCommon: p.common_name_guess,
          guessScientific: p.scientific_name_guess,
          organ: p.organ || "habit",
        }));
      return {
        plants,
        provider: "Google Gemini",
        requestedModel: model,
        // The requested alias is not a substitute for the actual returned version.
        modelVersion: typeof data.modelVersion === "string" ? data.modelVersion : undefined,
        promptVersion: DETECTION_PROMPT_VERSION,
      };
    } catch (err) {
      lastError = err;
      // Try next candidate on network/timeout error
    }
  }

  throw lastError || new Error("All Gemini vision models failed to respond");
}

const MACRO_PROMPT = `You are an expert botanical taxonomist and dendrologist specializing in Mid-Atlantic and New Jersey (USA) flora.
You are inspecting a close-up/macro photo of a plant (leaf, flower, twig, or bark) provided by a homeowner.

Perform a thorough visual morphological diagnosis:
1. Identify the observed leaf traits:
   - leafType: (e.g., "Simple Broadleaf", "Pinnately Compound", "Bipinnately Compound", "Needle-like", "Scale-like")
   - margin: (e.g., "Entire / Smooth (no teeth)", "Serrated / Toothed", "Doubly Serrated", "Lobed (shallow/deep)", "Spiny")
   - arrangement: (e.g., "Alternate", "Opposite", "Whorled", "Basal rosette")
   - venation: (e.g., "Pinnate", "Palmate", "Parallel")
   - distinguishingFeatures: array of 2-4 observable traits in this photo (e.g., "Single sharp spine at node", "Prominent serrated margins with gland-tipped teeth", "Pale glaucous underside", "Red petiole")
2. Provide the top 3-4 most likely plant candidates found in New Jersey residential landscapes or woodlands.
   For each candidate:
   - scientificName: standard binomial (e.g., "Berberis thunbergii")
   - commonName: common English name (e.g., "Japanese Barberry")
   - confidence: 0.0 to 1.0
   - visualDistinction: a concise, clear visual clue highlighting why this plant matches the photo or how to distinguish it from similar lookalikes (e.g., "Small spatulate leaves in clusters with a sharp single spine at each node")
   - leafStyleMatch: a 2-4 word descriptor of the leaf shape/style (e.g., "Spatulate with thorns", "Lobed with pointed tips")`;

const MACRO_SCHEMA = {
  type: "OBJECT",
  properties: {
    observedTraits: {
      type: "OBJECT",
      properties: {
        leafType: { type: "STRING" },
        margin: { type: "STRING" },
        arrangement: { type: "STRING" },
        venation: { type: "STRING" },
        distinguishingFeatures: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
      },
      required: ["leafType", "margin", "arrangement", "distinguishingFeatures"],
    },
    candidates: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          scientificName: { type: "STRING" },
          commonName: { type: "STRING" },
          confidence: { type: "NUMBER" },
          visualDistinction: { type: "STRING" },
          leafStyleMatch: { type: "STRING" },
        },
        required: [
          "scientificName",
          "commonName",
          "confidence",
          "visualDistinction",
        ],
      },
    },
  },
  required: ["observedTraits", "candidates"],
};

/** @param {Buffer} imageBuffer @param {string} mimeType @param {string|null} customApiKey @param {string} hint */
export async function identifyMacroLeaf(
  imageBuffer,
  mimeType = "image/jpeg",
  customApiKey = null,
  hint = "",
) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new Error(
      "GEMINI_API_KEY is not set. Please provide it in app settings or .env.local",
    );

  const candidates = Array.from(
    new Set(
      [
        process.env.GEMINI_MODEL,
        "gemini-3.5-flash",
        "gemini-flash-latest",
      ].filter(Boolean),
    ),
  );

  let lastError = null;
  const promptText = hint
    ? `${MACRO_PROMPT}\n\nAdditional Context/Area Hint from Yard scan: ${hint}`
    : MACRO_PROMPT;

  for (const model of candidates) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: imageBuffer.toString("base64"),
                    },
                  },
                  { text: promptText },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: MACRO_SCHEMA,
              temperature: 0.2,
            },
          }),
          signal: AbortSignal.timeout(20000),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        if (res.status === 503 || res.status === 404) {
          lastError = new Error(
            `Model ${model} returned ${res.status}: ${body.slice(0, 150)}`,
          );
          continue;
        }
        throw new Error(
          `Gemini macro error ${res.status}: ${body.slice(0, 300)}`,
        );
      }

      const data = await res.json();
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") || "{}";
      const parsed = JSON.parse(text);
      return {
        observedTraits: parsed.observedTraits || null,
        candidates: (parsed.candidates || []).map((c) => ({
          sci: c.scientificName,
          common: c.commonName,
          confidence: c.confidence ?? 0,
          visualDistinction:
            c.visualDistinction || "Matches leaf shape and habit",
          leafStyleMatch: c.leafStyleMatch || "Leaf match",
        })),
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw (
    lastError ||
    new Error("All Gemini vision models failed for macro identification")
  );
}
