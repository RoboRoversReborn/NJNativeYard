import { createRequire } from "node:module";

export const MAX_PHOTO_PIXELS = 40_000_000;
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

/** Detect bytes, never trust a filename or browser-provided MIME. */
export function photoFormat(
  input: Buffer,
): "heif" | "jpeg" | "png" | "webp" | "gif" | undefined {
  if (
    input.length >= 3 &&
    input[0] === 0xff &&
    input[1] === 0xd8 &&
    input[2] === 0xff
  )
    return "jpeg";
  if (
    input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (
    input.length >= 12 &&
    input.toString("ascii", 0, 4) === "RIFF" &&
    input.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  if (["GIF87a", "GIF89a"].includes(input.toString("ascii", 0, 6)))
    return "gif";
  if (input.length < 16 || input.toString("ascii", 4, 8) !== "ftyp") return;
  const boxLength = input.readUInt32BE(0);
  if (boxLength < 16 || boxLength > input.length || boxLength > 4096) return;
  const brands = [input.toString("ascii", 8, 12)];
  for (let offset = 16; offset + 4 <= boxLength; offset += 4)
    brands.push(input.toString("ascii", offset, offset + 4));
  if (
    brands.some((brand) =>
      [
        "heic",
        "heix",
        "hevc",
        "hevx",
        "heim",
        "heis",
        "hevm",
        "hevs",
        "mif1",
        "msf1",
        "avif",
        "avis",
      ].includes(brand),
    )
  )
    return "heif";
}

type HeifImage = {
  get_width(): number;
  get_height(): number;
  is_primary(): boolean;
  display(
    image: { data: Uint8ClampedArray; width: number; height: number },
    callback: (result: { data: Uint8ClampedArray } | null) => void,
  ): void;
  free(): void;
};
type HeifModule = {
  HeifDecoder: new () => {
    decoder: number;
    decode(input: Uint8Array): HeifImage[];
  };
  heif_context_free(context: number): void;
};
// The package contains its WASM binary: no CDN, system codec, or conversion service.
const requireLocal = createRequire(import.meta.url);
let codec: Promise<HeifModule> | undefined;
function localCodec(): Promise<HeifModule> {
  return (codec ??= Promise.resolve(requireLocal("libheif-js/wasm-bundle")));
}

/** libheif applies HEIF irot/imir transforms during decoding. Do not rotate raw output again. */
export async function decodeHeif(input: Buffer) {
  const libheif = await localCodec();
  const decoder = new libheif.HeifDecoder();
  let images: HeifImage[] = [];
  try {
    images = decoder.decode(input);
    const image = images.find((image) => image.is_primary()) || images[0];
    if (!image) throw new Error("Invalid HEIF image");
    const width = image.get_width(),
      height = image.get_height();
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 1 ||
      height < 1 ||
      width * height > MAX_PHOTO_PIXELS
    )
      throw new Error("Photo exceeds the 40 megapixel decode limit");
    const pixels = await new Promise<{ data: Uint8ClampedArray }>(
      (resolve, reject) => {
        image.display(
          { data: new Uint8ClampedArray(width * height * 4), width, height },
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("HEIF pixel decode failed")),
        );
      },
    );
    return {
      data: Buffer.from(
        pixels.data.buffer,
        pixels.data.byteOffset,
        pixels.data.byteLength,
      ),
      width,
      height,
    };
  } finally {
    images.forEach((image) => image.free());
    if (decoder.decoder) libheif.heif_context_free(decoder.decoder);
  }
}
