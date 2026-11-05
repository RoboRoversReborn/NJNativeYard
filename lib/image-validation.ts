import sharp from "sharp";

export type ImageValidationResult =
  | {
      ok: true;
      width: number;
      height: number;
      greenRatio: number;
    }
  | {
      ok: false;
      code:
        | "invalid_data_url"
        | "too_large"
        | "unreadable"
        | "too_small"
        | "no_vegetation"
        | "flat_image";
      message: string;
      width?: number;
      height?: number;
      greenRatio?: number;
    };

const MAX_BYTES = 12 * 1024 * 1024;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const MIN_GREEN_RATIO = 0.05;
const MIN_LUMA_STDDEV = 7;

/**
 * Server-side sanity check for uploaded yard photos.
 *
 * The vision model is expensive and can hallucinate plants in a screenshot,
 * a product photo, or a blank wall. This cheap crop/colour pass rejects images
 * that clearly cannot be a yard bed before we spend a model call. It is a gate,
 * not a plant identifier: passing only means "this looks like a photo with
 * vegetation in it".
 */
export async function validateYardImage(dataUrl: string): Promise<ImageValidationResult> {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return {
      ok: false,
      code: "invalid_data_url",
      message: "The photo must be sent as a base64 image.",
    };
  }

  const base64 = match[2];
  const estimatedBytes = Math.floor((base64.length * 3) / 4);
  if (estimatedBytes > MAX_BYTES) {
    return {
      ok: false,
      code: "too_large",
      message: "That photo is larger than 12 MB. Try a smaller image.",
    };
  }

  try {
    const buffer = Buffer.from(base64, "base64");
    const pipeline = sharp(buffer, { failOn: "error" });
    const metadata = await pipeline.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      return {
        ok: false,
        code: "too_small",
        message: `That photo is only ${width}×${height}px. Use a photo at least ${MIN_WIDTH}px wide so plants are visible.`,
        width,
        height,
      };
    }

    const { data, info } = await pipeline
      .clone()
      .rotate()
      .resize(96, 96, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = info.width * info.height;
    let green = 0;
    let lumaSum = 0;
    let lumaSqSum = 0;

    for (let index = 0; index < pixels; index += 1) {
      const offset = index * 3;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const excessGreen = 2 * g - r - b;

      if (excessGreen > 18 && g > 38) green += 1;

      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumaSum += luma;
      lumaSqSum += luma * luma;
    }

    const greenRatio = pixels ? green / pixels : 0;
    const meanLuma = lumaSum / pixels;
    const variance = Math.max(0, lumaSqSum / pixels - meanLuma * meanLuma);
    const lumaStddev = Math.sqrt(variance);

    if (lumaStddev < MIN_LUMA_STDDEV) {
      return {
        ok: false,
        code: "flat_image",
        message:
          "That image looks blank or nearly uniform. Upload a real photo of a yard bed, hedge, or garden.",
        width,
        height,
        greenRatio,
      };
    }

    if (greenRatio < MIN_GREEN_RATIO) {
      return {
        ok: false,
        code: "no_vegetation",
        message:
          "We couldn't find enough vegetation in that photo. Use a wide outdoor shot that includes leaves, shrubs, or groundcover—not a screenshot or a close-up of a wall.",
        width,
        height,
        greenRatio,
      };
    }

    return { ok: true, width, height, greenRatio };
  } catch {
    return {
      ok: false,
      code: "unreadable",
      message:
        "We couldn't read that image. Try exporting it as a JPEG or PNG and uploading again.",
    };
  }
}
