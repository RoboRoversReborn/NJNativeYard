import sharp from "sharp";
import { parse as parseExif } from "exifr";
import {
  decodeHeif,
  photoFormat,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_PIXELS,
} from "../heic-photo";
import { createHash } from "node:crypto";
import { detectPlantsWithMetadata, identifyMacroLeaf } from "./gemini";
import { identifyPlant } from "./plantnet";
import type { ComparisonCaptureContext } from "../observation-comparison";
import {
  exactPlant,
  normalizeBox,
  type Candidate,
  type ReferencePhoto,
  type SurveyPlant,
} from "../survey";

type RawDetection = {
  box: number[];
  kind: string;
  guessScientific: string;
  guessCommon: string;
  organ: string;
};
type PN = {
  provider?: string;
  modelVersion?: string;
  project?: string;
  candidates: Array<{
    sci: string;
    common: string | null;
    score: number;
    images?: ReferencePhoto[];
  }>;
};
type Macro = {
  observedTraits: Record<string, unknown> | null;
  candidates: Array<{
    sci: string;
    common: string;
    confidence: number;
    visualDistinction: string;
  }>;
};
export class ImageInputError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
export function validateFile(file: File) {
  if (file.size > MAX_PHOTO_BYTES)
    throw new ImageInputError("Photo must be smaller than 12 MB.", 413);
  if (
    file.type &&
    !file.type.startsWith("image/") &&
    file.type !== "application/octet-stream" &&
    !/\.hei[cf]$/i.test(file.name)
  )
    throw new ImageInputError(
      "Choose a JPEG, PNG, WebP, or compatible camera photo.",
      415,
    );
}
type ProviderOptions = {
  geminiKey?: string;
  plantnetKey?: string;
  mode?: "yard" | "plant";
};
export class YardDetectionError extends Error {}
export const ANALYSIS_PIPELINE_VERSION = "nativeyard-regions-v1-provenance";
export type AnalysisProvider = {
  provider: string;
  modelVersion?: string;
  promptVersion: string;
  requestedModel?: string;
};
export type PhotoAnalysis = {
  plants: SurveyPlant[];
  capture: ComparisonCaptureContext;
  providers: AnalysisProvider[];
};

/** A source-reported version is required; a moving model alias remains unknown. */
function fixedVersion(value?: string) {
  return value?.trim() &&
    !/latest|^(unknown|unavailable|unspecified)$/i.test(value)
    ? value.trim()
    : undefined;
}
function photoAnalysis(
  data: Buffer,
  plants: SurveyPlant[],
  used: AnalysisProvider[],
  mode = "yard",
): PhotoAnalysis {
  const providers = [
    ...new Map(used.map((p) => [JSON.stringify(p), p])).values(),
  ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const completeVersions =
    providers.length > 0 &&
    providers.every((p) => fixedVersion(p.modelVersion));
  const modelVersion = completeVersions
    ? providers.length === 1
      ? fixedVersion(providers[0].modelVersion)
      : JSON.stringify(
          providers.map((p) => [p.provider, fixedVersion(p.modelVersion)]),
        )
    : undefined;
  return {
    plants: plants.map((plant) => ({
      ...plant,
      yardScope: plant.yardScope ?? "yard",
    })),
    providers,
    capture: {
      // Identity of the normalized JPEG analyzed and returned as survey.photo, not a camera date.
      imageSha256: createHash("sha256").update(data).digest("hex"),
      method: {
        provider: providers.length
          ? [...new Set(providers.map((p) => p.provider))].join(" + ")
          : undefined,
        modelVersion,
        promptVersion: providers.length
          ? JSON.stringify(providers.map((p) => [p.provider, p.promptVersion]))
          : undefined,
        pipelineVersion: `${ANALYSIS_PIPELINE_VERSION}:${mode}`,
      },
    },
  };
}
const plantNetMethod = (result: PN): AnalysisProvider => ({
  provider: "Pl@ntNet",
  modelVersion: result.modelVersion,
  // PlantNet has no textual prompt. Record its real request protocol and flora selection instead.
  promptVersion: `no-text-prompt;identify-v2;nb-results=3;lang=en;project=${result.project || "unknown"}`,
});
export async function prepareImage(file: File) {
  validateFile(file);
  const input = Buffer.from(await file.arrayBuffer());
  const format = photoFormat(input);
  if (!format)
    throw new ImageInputError(
      "This file is not a supported photo. Choose a JPEG, PNG, WebP, or HEIC photo.",
      415,
    );
  const tags = await parseExif(input, {
    pick: ["DateTimeOriginal", "OffsetTimeOriginal"],
    reviveValues: false,
    gps: false,
    xmp: false,
    icc: false,
    iptc: false,
  }).catch(() => undefined);
  const dateTimeOriginal =
    typeof tags?.DateTimeOriginal === "string"
      ? tags.DateTimeOriginal
      : undefined;
  const offsetTimeOriginal =
    typeof tags?.OffsetTimeOriginal === "string"
      ? tags.OffsetTimeOriginal
      : undefined;
  const exifCaptureTime = dateTimeOriginal
    ? {
        dateTimeOriginal,
        ...(offsetTimeOriginal ? { offsetTimeOriginal } : {}),
      }
    : undefined;
  const captureMetadata: Partial<ComparisonCaptureContext> = {};
  // EXIF's clock digits alone have no timezone. Never invent a server-local instant.
  if (
    dateTimeOriginal &&
    /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(dateTimeOriginal) &&
    offsetTimeOriginal &&
    /^[+-]\d{2}:\d{2}$/.test(offsetTimeOriginal)
  ) {
    const instant = new Date(
      dateTimeOriginal.replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T") +
        offsetTimeOriginal,
    );
    if (Number.isFinite(instant.getTime()))
      Object.assign(captureMetadata, {
        capturedAt: instant.toISOString(),
        capturedAtSource: "exif",
        capturedAtConfirmed: false,
      });
  }
  try {
    const decoded = format === "heif" ? await decodeHeif(input) : undefined;
    const image = decoded
      ? sharp(decoded.data, {
          raw: { width: decoded.width, height: decoded.height, channels: 4 },
          limitInputPixels: MAX_PHOTO_PIXELS,
        })
      : sharp(input, { limitInputPixels: MAX_PHOTO_PIXELS }).rotate();
    const { data, info } = await image
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
    if (info.width < 80 || info.height < 80)
      throw new ImageInputError(
        "Choose a photo at least 80 pixels wide and tall.",
      );
    return {
      data,
      width: info.width,
      height: info.height,
      mimeType: "image/jpeg" as const,
      fileName: (file.name.replace(/\.[^.]+$/, "") || "photo") + ".jpg",
      photo: `data:image/jpeg;base64,${data.toString("base64")}`,
      captureMetadata,
      exifCaptureTime,
    };
  } catch (error) {
    if (error instanceof ImageInputError) throw error;
    throw new ImageInputError(
      "We could not read this photo. It may be damaged, unsupported, or larger than 40 megapixels. Try another HEIC, JPEG, or PNG photo.",
    );
  }
}

export function candidate(
  sci: string,
  common: string,
  confidence?: number,
  clue?: string,
  referencePhotos?: ReferencePhoto[],
): Candidate {
  return {
    plantId: exactPlant(sci)?.id,
    scientificName: sci,
    commonName: common || sci,
    confidence,
    clue,
    referencePhotos,
  };
}
export async function analyzePhoto(
  data: Buffer,
  width: number,
  height: number,
  options: ProviderOptions = {},
): Promise<SurveyPlant[]> {
  return (await analyzePhotoWithMetadata(data, width, height, options)).plants;
}
export async function analyzePhotoWithMetadata(
  data: Buffer,
  width: number,
  height: number,
  options: ProviderOptions = {},
): Promise<PhotoAnalysis> {
  const geminiKey = options.geminiKey || process.env.GEMINI_API_KEY,
    plantnetKey = options.plantnetKey || process.env.PLANTNET_API_KEY;
  if (!geminiKey && !plantnetKey)
    throw new Error(
      "Live identification is not configured. Add a Gemini API key to .env.local, or explore the sample yard.",
    );
  let raw: RawDetection[] = [];
  const used: AnalysisProvider[] = [];
  if (geminiKey) {
    try {
      const result = await detectPlantsWithMetadata(
        data,
        "image/jpeg",
        geminiKey,
      );
      raw = result.plants as RawDetection[];
      if (raw.length)
        used.push({
          provider: result.provider,
          modelVersion: result.modelVersion,
          requestedModel: result.requestedModel,
          promptVersion: result.promptVersion,
        });
    } catch (error) {
      console.warn("Yard detector failed", {
        type: error instanceof Error ? error.name : "UnknownError",
      });
      if (options.mode !== "plant" || !plantnetKey)
        throw new YardDetectionError(
          "The multi-plant scan did not finish. Your photo was not reduced to a single-plant guess. Please retry, or choose One plant for a close-up.",
        );
    }
  }
  if (!raw.length && plantnetKey && options.mode === "plant") {
    const result = (await identifyPlant(
      data,
      "auto",
      plantnetKey || null,
    )) as PN;
    const first = result.candidates[0];
    if (first)
      return photoAnalysis(
        data,
        [
          {
            id: crypto.randomUUID(),
            plantId: exactPlant(first.sci)?.id,
            suggestion: first.common || first.sci,
            scientificName: first.sci,
            box: { x: 0, y: 0, w: 100, h: 100 },
            confidence: first.score,
            reviewed: false,
            candidates: result.candidates.map((c) =>
              candidate(c.sci, c.common || c.sci, c.score, undefined, c.images),
            ),
            note: "Whole-photo fallback: one possible plant identity. A multi-plant region survey could not be produced.",
          },
        ],
        [plantNetMethod(result)],
        options.mode || "yard",
      );
  }
  if (!raw.length && options.mode !== "plant")
    throw new YardDetectionError(
      "No plant regions were returned by the multi-plant detector. Please retry with this photo or a closer view.",
    );
  const detections = raw.filter((p) => p.kind !== "lawn").slice(0, 24);
  const plants = (
    await Promise.all(
      detections.map(async (d) => {
        const box = normalizeBox(d.box);
        if (!box) return null;
        let candidates: Candidate[] = [
          candidate(
            d.guessScientific || "",
            d.guessCommon || "Unidentified plant",
          ),
        ];
        if (plantnetKey) {
          try {
            const left = Math.min(width - 1, Math.floor((box.x / 100) * width)),
              top = Math.min(height - 1, Math.floor((box.y / 100) * height));
            const crop = await sharp(data)
              .extract({
                left,
                top,
                width: Math.max(
                  1,
                  Math.min(width - left, Math.floor((box.w / 100) * width)),
                ),
                height: Math.max(
                  1,
                  Math.min(height - top, Math.floor((box.h / 100) * height)),
                ),
              })
              .jpeg()
              .toBuffer();
            const result = (await identifyPlant(
              crop,
              d.organ,
              plantnetKey || null,
              8000,
            )) as PN;
            candidates = [
              ...result.candidates.map((c) =>
                candidate(
                  c.sci,
                  c.common || c.sci,
                  c.score,
                  undefined,
                  c.images,
                ),
              ),
              ...candidates,
            ];
            if (result.candidates.length) used.push(plantNetMethod(result));
          } catch {
            /* Retain Gemini's provisional region when secondary identification fails. */
          }
        }
        const first = candidates[0];
        return {
          id: crypto.randomUUID(),
          plantId: first.plantId,
          suggestion: first.commonName,
          scientificName: first.scientificName,
          box,
          confidence: first.confidence,
          reviewed: false,
          candidates,
          note: "Initial AI suggestion. Review the species before acting.",
        } as SurveyPlant;
      }),
    )
  ).filter((p): p is SurveyPlant => p !== null);
  return photoAnalysis(data, plants, used, options.mode || "yard");
}
export async function refinePhoto(
  data: Buffer,
  hint: string,
  options: ProviderOptions = {},
) {
  const geminiKey = options.geminiKey || process.env.GEMINI_API_KEY,
    plantnetKey = options.plantnetKey || process.env.PLANTNET_API_KEY;
  if (!geminiKey && !plantnetKey)
    throw new Error(
      "Leaf identification needs a configured Gemini or PlantNet API key. You can still choose a match from the NJ database.",
    );
  try {
    if (geminiKey) {
      const result = (await identifyMacroLeaf(
        data,
        "image/jpeg",
        geminiKey || null,
        hint,
      )) as Macro;
      if (result.candidates.length)
        return {
          traits: result.observedTraits,
          candidates: result.candidates.map((c) =>
            candidate(c.sci, c.common, c.confidence, c.visualDistinction),
          ),
          method: "gemini",
        };
    }
  } catch {
    /* Try configured secondary provider. */
  }
  if (plantnetKey) {
    const result = (await identifyPlant(
      data,
      "leaf",
      plantnetKey || null,
    )) as PN;
    if (result.candidates.length)
      return {
        traits: null,
        candidates: result.candidates.map((c) =>
          candidate(c.sci, c.common || c.sci, c.score, undefined, c.images),
        ),
        method: "plantnet",
      };
  }
  throw new Error(
    "The identification provider could not identify this leaf. Try another close-up or choose a match from the NJ database.",
  );
}
