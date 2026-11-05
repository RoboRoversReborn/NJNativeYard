/** Adapted from NativeYard-1 camera.js: compatible browser decoding → bounded JPEG. */
export async function compressPhoto(
  file: File,
  maxDimension = 1600,
  quality = 0.85,
): Promise<File> {
  // Keep camera metadata and delegate HEIC to the shipped local server decoder.
  if (
    /\.hei[cf]$/i.test(file.name) ||
    /^image\/hei[cf](?:-sequence)?$/i.test(file.type)
  )
    return file;
  try {
    // A small bounded preflight keeps EXIF capture time available to the server.
    // JPEGs without EXIF still use the existing browser resize path.
    const header = new Uint8Array(
      await file.slice(0, 256 * 1024).arrayBuffer(),
    );
    if (
      header.length >= 12 &&
      String.fromCharCode(...header.subarray(4, 8)) === "ftyp"
    )
      return file;
    if (header[0] === 0xff && header[1] === 0xd8) {
      for (let offset = 2; offset + 4 <= header.length;) {
        if (header[offset] !== 0xff) break;
        const marker = header[offset + 1];
        if (marker === 0xda || marker === 0xd9) break;
        const length = (header[offset + 2] << 8) | header[offset + 3];
        if (length < 2) break;
        if (
          marker === 0xe1 &&
          length >= 8 &&
          header[offset + 4] === 69 &&
          header[offset + 5] === 120 &&
          header[offset + 6] === 105 &&
          header[offset + 7] === 102 &&
          header[offset + 8] === 0 &&
          header[offset + 9] === 0
        )
          return file;
        offset += 2 + length;
      }
    }
  } catch {
    // Older browsers may lack Blob.arrayBuffer; retain the normal decode fallback.
  }
  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function")
    return file;
  return new Promise((resolve) => {
    const image = new Image(),
      url = URL.createObjectURL(file);
    let finished = false;
    const finish = (result: File) => {
      if (finished) return;
      finished = true;
      URL.revokeObjectURL(url);
      resolve(result);
    };
    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width,
          height = image.naturalHeight || image.height;
        if (!width || !height) {
          finish(file);
          return;
        }
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          finish(file);
          return;
        }
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) =>
            finish(
              blob
                ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  })
                : file,
            ),
          "image/jpeg",
          quality,
        );
      } catch {
        finish(file);
      }
    };
    image.onerror = () => finish(file);
    image.src = url;
  });
}
export async function photoResponse<T>(response: Response): Promise<T> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    if (response.status === 413)
      throw new Error(
        "This photo exceeds the server upload limit. Try a smaller JPEG.",
      );
    if (response.status === 502 || response.status === 504)
      throw new Error(
        "Photo analysis timed out or the provider was unavailable. Try again with a clearer, smaller photo.",
      );
    throw new Error(
      `The photo service returned an unexpected response (${response.status}). Please try again.`,
    );
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || `Photo service error (${response.status}).`);
  return data as T;
}
