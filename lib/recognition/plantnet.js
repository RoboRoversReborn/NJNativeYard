/**
 * Plant ID adapter: Pl@ntNet API (free, non-commercial tier).
 * identify(cropBuffer, organ) → { candidates: [{ sci, common, genus, family, score }], remaining }
 */

const ORGAN_MAP = {
  flower: "flower",
  leaf: "leaf",
  fruit: "fruit",
  bark: "bark",
  habit: "auto",
};

/** @param {Buffer} imageBuffer @param {string} organ @param {string|null} customApiKey @param {number} timeoutMs */
export async function identifyPlant(
  imageBuffer,
  organ = "auto",
  customApiKey = null,
  timeoutMs = 20000,
) {
  const apiKey = customApiKey || process.env.PLANTNET_API_KEY;
  if (!apiKey) throw new Error("PLANTNET_API_KEY is not set");
  const project = process.env.PLANTNET_PROJECT || "all";

  const form = new FormData();
  form.append(
    "images",
    new Blob([imageBuffer], { type: "image/jpeg" }),
    "plant.jpg",
  );
  form.append("organs", ORGAN_MAP[organ] || "auto");

  const url =
    `https://my-api.plantnet.org/v2/identify/${project}` +
    `?api-key=${encodeURIComponent(apiKey)}&nb-results=3&lang=en&include-related-images=true`;

  const res = await fetch(url, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 404) return { candidates: [], remaining: null }; // "Species not found"
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pl@ntNet error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    provider: "Pl@ntNet",
    project,
    // Missing provider version stays unknown; project is not a model version.
    modelVersion: typeof data.version === "string" ? data.version : undefined,
    remaining: data.remainingIdentificationRequests ?? null,
    candidates: (data.results || []).slice(0, 3).map((r) => ({
      sci: r.species?.scientificNameWithoutAuthor,
      common: r.species?.commonNames?.[0] || null,
      genus: r.species?.genus?.scientificNameWithoutAuthor,
      family: r.species?.family?.scientificNameWithoutAuthor,
      score: r.score,
      images: (r.images || [])
        .slice(0, 3)
        .map((image) => ({
          url: image.url?.m || image.url?.o || image.url?.s,
          author: image.author || "",
          license: image.license || "",
          citation: image.citation || "",
          source: "PlantNet",
        }))
        .filter((image) => {
          try {
            return Boolean(
              image.author &&
              image.license &&
              new URL(image.url).protocol === "https:",
            );
          } catch {
            return false;
          }
        }),
    })),
  };
}
