import { enrichRegions } from "@/lib/species-enrichment";
import {
  analyzePhotoWithMetadata,
  prepareImage,
  validateFile,
  ImageInputError,
  YardDetectionError,
} from "@/lib/recognition/pipeline";
import { exampleSurvey } from "@/lib/survey";
import { sampleYardById } from "@/lib/sample-yards";
import { isNjZip } from "@/lib/nj-data";
export const maxDuration = 90;
export async function POST(request: Request) {
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      let parsed: unknown;
      try {
        parsed = await request.json();
      } catch {
        return Response.json(
          {
            error: "The request body must contain valid JSON.",
            code: "invalid_json",
          },
          { status: 400 },
        );
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return Response.json(
          {
            error: "The JSON request body must be an object.",
            code: "invalid_request",
          },
          { status: 400 },
        );
      const body = parsed as Record<string, unknown>;
      if (body.sample === true) {
        if (
          (body.sampleId !== undefined && typeof body.sampleId !== "string") ||
          (body.zip !== undefined && typeof body.zip !== "string")
        )
          return Response.json(
            {
              error: "Sample ID and ZIP must be text values.",
              code: "invalid_request",
            },
            { status: 400 },
          );
        if (body.sampleId && !sampleYardById(body.sampleId))
          return Response.json(
            { error: "That sample yard was not found." },
            { status: 404 },
          );
        return Response.json(
          exampleSurvey(
            body.zip as string | undefined,
            body.sampleId as string | undefined,
          ),
        );
      }
      return Response.json(
        { error: "Upload a photo using the photo selector." },
        { status: 400 },
      );
    }
    const form = await request.formData(),
      file = form.get("file"),
      zip = String(form.get("zip") || "");
    if (!isNjZip(zip))
      return Response.json(
        { error: "Enter a valid New Jersey ZIP code." },
        { status: 400 },
      );
    if (!(file instanceof File))
      return Response.json(
        { error: "Choose a plant or yard photo." },
        { status: 400 },
      );
    validateFile(file);
    const geminiKey = request.headers.get("x-gemini-api-key")?.trim();
    if (
      !geminiKey &&
      !process.env.GEMINI_API_KEY &&
      !process.env.PLANTNET_API_KEY
    )
      return Response.json(
        {
          error:
            "Live photo identification needs a Gemini or PlantNet API key in .env.local. Explore the sample yard while setup is completed.",
        },
        { status: 503 },
      );
    const image = await prepareImage(file);
    const { plants, capture } = await analyzePhotoWithMetadata(
      image.data,
      image.width,
      image.height,
      {
        geminiKey,
        mode: form.get("mode") === "plant" ? "plant" : "yard",
      },
    );
    if (!plants.length)
      return Response.json(
        {
          error:
            "No distinct plant regions found. Try a brighter photo or a closer view.",
        },
        { status: 422 },
      );
    const uploadedAt = new Date().toISOString();
    return Response.json({
      id: crypto.randomUUID(),
      createdAt: uploadedAt,
      uploadedAt,
      capture: { ...capture, ...image.captureMetadata, ...(image.exifCaptureTime ? { exifCaptureTime: image.exifCaptureTime } : {}) },
      source: "upload",
      zip,
      photo: image.photo,
      photoMimeType: image.mimeType,
      photoFileName: image.fileName,
      plants: await enrichRegions(plants),
    });
  } catch (error) {
    if (error instanceof YardDetectionError)
      return Response.json(
        { error: error.message, code: "yard_detection_unavailable" },
        { status: 503 },
      );
    if (error instanceof ImageInputError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error(
      "Photo analysis failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return Response.json(
      {
        error:
          "We could not analyze this photo. Check provider configuration and try a JPEG or a clearer photo. HEIC support depends on the server image decoder.",
      },
      { status: 502 },
    );
  }
}
