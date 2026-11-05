import sharp from "sharp";
import { regionForZip } from "./plants";
import type { VisionDetection } from "./types";

const DEFAULT_GEMINI_VISION_MODEL = "gemini-2.5-flash";

function geminiVisionModel() {
  return process.env.GEMINI_VISION_MODEL || DEFAULT_GEMINI_VISION_MODEL;
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function identifyPlantsWithGemini(
  dataUrl: string,
  rawZip: string,
): Promise<VisionDetection[]> {
  if (!process.env.GEMINI_API_KEY) {
    return identifyPlantsWithPlantNet(dataUrl);
  }

  let discovered: VisionDetection[];
  try {
    discovered = await discoverPlantsWithGemini(dataUrl, rawZip);
    console.info("NativeYard Gemini discovery:", {
      model: geminiVisionModel(),
      sentFullImage: true,
      plants: discovered.length,
    });
  } catch (error) {
    if (!process.env.PLANTNET_API_KEY) throw error;
    return identifyPlantsWithPlantNet(dataUrl);
  }

  if (!discovered.length) {
    return process.env.PLANTNET_API_KEY ? identifyPlantsWithPlantNet(dataUrl) : [];
  }

  const verified = await Promise.all(
    discovered.map(async (plant) => {
      try {
        const crop = await cropImage(dataUrl, plant);
        const identified = await identifyCropWithGemini(crop, rawZip);
        if (identified?.scientificName) {
          return {
            ...plant,
            scientificName: identified.scientificName,
            commonName: identified.commonName,
            confidence: Math.max(plant.confidence, identified.confidence),
            note: identified.note ?? plant.note,
            plantPart: identified.plantPart ?? plant.plantPart,
            topMatches: identified.topMatches ?? plant.topMatches,
          };
        }
      } catch (error) {
        console.error("NativeYard crop identification failed:", error instanceof Error ? error.message : error);
      }

      if (process.env.PLANTNET_API_KEY) {
        try {
          const crop = await cropImage(dataUrl, plant);
          const fallback = await identifyImageWithPlantNet(crop);
          if (fallback) return { ...plant, ...fallback };
        } catch (error) {
          console.error("NativeYard PlantNet crop fallback failed:", error instanceof Error ? error.message : error);
        }
      }

      return plant;
    }),
  );

  return verified.filter((plant) => plant.isPlant !== false).slice(0, 10);
}

async function discoverPlantsWithGemini(
  dataUrl: string,
  rawZip: string,
): Promise<VisionDetection[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("The image must be a base64 data URL.");
  }

  const [, mimeType, base64] = match;
  const region = regionForZip(rawZip);
  const model = geminiVisionModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are a careful field botanist and ecological landscape auditor working in New Jersey.

Analyze this residential yard photo for a homeowner in ${region.city}, ${region.state || "New Jersey"}${region.county ? `, ${region.county} County` : ""} (USDA zone ${region.zone}; ${region.province ?? region.ecoregion}; ${region.ecoregionCode}).

Locate and identify up to 10 distinct plant instances that are visibly present. A plant instance means one separately rooted individual or one visually isolated ornamental clump. If several stems belong to the same rooted shrub, hedge, or perennial clump, return one box for that whole instance instead of multiple boxes. Do not merge two distinct neighboring plants, trunks, clumps, or separated crown portions into one box. Trees count as one instance even when their foliage touches neighboring plants. Flowering perennials, vines, groundcovers, ornamental grasses, shrubs, and trees are valid.

Treat this as both instance detection and botanical identification. First locate each individual visually, then identify it. Prefer a separate accurate box over including unrelated objects, lawn, mulch, fence, furniture, sky, or people. Do not identify lawn grass unless it is a distinct ornamental clump. Never place one box around a mixed group.

For each plant, return:
- isPlant: true only if you can see an actual plant
- scientificName: the most likely binomial, or genus + "spp." if uncertain
- commonName: a plain-English name
- confidence: a number from 0 to 1
- x, y, width, height: normalized bounding-box coordinates from 0 to 1, relative to the FULL original image, origin top-left. Return x as the left edge and y as the top edge, with width and height extending right and down. Each box must tightly enclose that plant instance's visible foliage, with x + width <= 1 and y + height <= 1. Include stems only when they help define the instance. Return no box if the instance cannot be isolated visually.
- plantPart: "canopy", "shrub", "perennial", "groundcover", "vine", or "grass"
- note: one short visual clue (leaf shape, flower color, growth habit)
- topMatches: if confidence is below 0.75, list up to 2 alternative local plants with scientificName, commonName, and confidence

Be conservative. If a plant is too blurry or generic to identify, omit it rather than guessing. Do not invent species. If the image is not an outdoor yard or plant photo, return an empty plants array. Return ONLY valid JSON in this exact shape:
{"plants":[{"isPlant":true,"scientificName":"Genus species","commonName":"Common name","confidence":0.85,"x":0.1,"y":0.2,"width":0.2,"height":0.3,"plantPart":"shrub","note":"visual clue","topMatches":[{"scientificName":"Genus altus","commonName":"Alternative","confidence":0.4}]}]}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message || "Gemini vision request failed.");
  }

  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) throw new Error("Gemini returned an empty response.");

  const parsed = JSON.parse(stripCodeFence(text)) as
    | { plants?: unknown }
    | unknown[];

  const rawPlants = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.plants)
      ? parsed.plants
      : [];

  return rawPlants
    .map((item) => toVisionDetection(item))
    .filter((item): item is VisionDetection => Boolean(item))
    .slice(0, 10);
}

async function identifyCropWithGemini(dataUrl: string, rawZip: string): Promise<VisionDetection | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const match = /^data:(image\/[^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;

  const [, mimeType, base64] = match;
  const region = regionForZip(rawZip);
  const model = geminiVisionModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = `Identify the single plant in this cropped yard photo. Region: ${region.city}, New Jersey. Return only JSON: {"scientificName":"Genus species","commonName":"Common name","confidence":0.85,"plantPart":"shrub","note":"one visual clue"}. If no plant is visible, return {"scientificName":""}.`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  });
  const payload = (await response.json()) as GeminiResponse;
  if (!response.ok) throw new Error(payload.error?.message || "Gemini crop identification failed.");

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
  if (!text) throw new Error("Gemini returned an empty crop response.");

  const parsed = JSON.parse(stripCodeFence(text)) as Record<string, unknown>;
  if (!String(parsed.scientificName ?? "").trim()) return null;
  return {
    ...toVisionDetection({ ...parsed, x: 0, y: 0, width: 1, height: 1 }),
  } as VisionDetection;
}

async function cropImage(dataUrl: string, plant: VisionDetection): Promise<string> {
  const match = /^data:image\/[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("The image must be a base64 image URL.");

  const image = sharp(Buffer.from(match[1], "base64")).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) throw new Error("Could not read uploaded image dimensions.");

  const paddedX = clamp(plant.x - plant.width * 0.08, 0, 1);
  const paddedY = clamp(plant.y - plant.height * 0.08, 0, 1);
  const paddedRight = clamp(plant.x + plant.width * 1.08, 0, 1);
  const paddedBottom = clamp(plant.y + plant.height * 1.08, 0, 1);
  const left = Math.floor(paddedX * width);
  const top = Math.floor(paddedY * height);
  const cropWidth = Math.max(1, Math.ceil((paddedRight - paddedX) * width));
  const cropHeight = Math.max(1, Math.ceil((paddedBottom - paddedY) * height));
  const cropped = await image.extract({
    left,
    top,
    width: Math.min(cropWidth, width - left),
    height: Math.min(cropHeight, height - top),
  }).jpeg({ quality: 90 }).toBuffer();

  return `data:image/jpeg;base64,${cropped.toString("base64")}`;
}

async function identifyPlantsWithPlantNet(dataUrl: string): Promise<VisionDetection[]> {
  const match = await identifyImageWithPlantNet(dataUrl);
  return match ? [{ ...match, x: 0, y: 0, width: 1, height: 1 }] : [];
}

async function identifyImageWithPlantNet(dataUrl: string): Promise<Pick<VisionDetection, "scientificName" | "commonName" | "confidence"> | null> {
  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) return null;
  const match = /^data:image\/([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("PlantNet requires a base64 image.");

  const bytes = Buffer.from(match[2], "base64");
  const form = new FormData();
  form.append("images", new Blob([bytes], { type: `image/${match[1]}` }), "plant.jpg");

  const response = await fetch(`https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    body: form,
  });
  const payload = await response.json() as {
    results?: Array<{ score?: number; species?: { scientificNameWithoutAuthor?: string; scientificName?: string; commonNames?: string[] } }>;
    message?: string;
  };
  if (!response.ok) throw new Error(payload.message || "PlantNet identification failed.");

  const top = payload.results?.[0];
  const scientificName = String(top?.species?.scientificNameWithoutAuthor ?? top?.species?.scientificName ?? "").trim();
  if (!scientificName) return null;
  return {
    scientificName,
    commonName: top?.species?.commonNames?.[0] || undefined,
    confidence: clamp(Number(top?.score ?? 0), 0, 1),
  };
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function toVisionDetection(value: unknown): VisionDetection | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const scientificName = String(record.scientificName ?? "").trim();
  if (!scientificName) return null;

  const x = normalizeCoordinate(record.x);
  const y = normalizeCoordinate(record.y);
  return {
    scientificName,
    commonName: record.commonName ? String(record.commonName) : undefined,
    confidence: clamp(Number(record.confidence ?? 0.7), 0, 1),
    x,
    y,
    width: Math.min(normalizeCoordinate(record.width), 1 - x),
    height: Math.min(normalizeCoordinate(record.height), 1 - y),
    note: record.note ? String(record.note).slice(0, 180) : undefined,
    isPlant: record.isPlant === false ? false : undefined,
    plantPart: record.plantPart ? String(record.plantPart).slice(0, 40) : undefined,
    topMatches: parseTopMatches(record.topMatches),
    polygon: parsePolygon(record.polygon),
  };
}

function parseTopMatches(value: unknown): VisionDetection["topMatches"] {
  if (!Array.isArray(value)) return undefined;
  const matches = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const scientificName = String(record.scientificName ?? "").trim();
      if (!scientificName) return null;
      return {
        scientificName,
        commonName: record.commonName ? String(record.commonName) : undefined,
        confidence: clamp(Number(record.confidence ?? 0.4), 0, 1),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 2);
  return matches.length ? matches : undefined;
}

function parsePolygon(value: unknown): VisionDetection["polygon"] {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const points = value
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      return [normalizeCoordinate(point[0]), normalizeCoordinate(point[1])] as [
        number,
        number,
      ];
    })
    .filter((point): point is [number, number] => Boolean(point));
  return points.length >= 3 ? points : undefined;
}

function normalizeCoordinate(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return number > 1.5 ? clamp(number / 100, 0, 1) : clamp(number, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
