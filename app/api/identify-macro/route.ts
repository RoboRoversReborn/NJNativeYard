import { referencePlant } from "@/lib/survey";
import { enrichSpecies } from "@/lib/species-enrichment";
import {
  prepareImage,
  refinePhoto,
  validateFile,
  ImageInputError,
} from "@/lib/recognition/pipeline";
export const maxDuration = 90;
export async function POST(request: Request) {
  const geminiKey = request.headers.get("x-gemini-api-key")?.trim();
  if (
    !geminiKey &&
    !process.env.GEMINI_API_KEY &&
    !process.env.PLANTNET_API_KEY
  )
    return Response.json(
      {
        error:
          "Leaf identification needs a Gemini or PlantNet API key. Manual NJ database matching is available.",
      },
      { status: 503 },
    );
  try {
    const form = await request.formData(),
      file = form.get("file");
    if (!(file instanceof File))
      return Response.json({ error: "Choose a leaf photo." }, { status: 400 });
    validateFile(file);
    const image = await prepareImage(file);
    const result = await refinePhoto(
        image.data,
        String(form.get("hint") || "").slice(0, 200),
        { geminiKey },
      );
    return Response.json({ ...result, candidates: await Promise.all(result.candidates.map(async candidate => ({ ...candidate, externalProfile: await enrichSpecies(candidate.scientificName) || referencePlant(candidate.scientificName, candidate.commonName) }))) });
  } catch (error) {
    if (error instanceof ImageInputError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json(
      {
        error:
          "Leaf identification did not succeed. Try another close-up or choose a match from the NJ database.",
      },
      { status: 502 },
    );
  }
}
