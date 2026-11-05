import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { prepareImage, ImageInputError } from "../lib/recognition/pipeline";
import { photoFormat, MAX_PHOTO_BYTES } from "../lib/heic-photo";
import { compressPhoto } from "../lib/photo-upload";

const fixture = readFileSync(
  new URL("./fixtures/example.heic", import.meta.url),
);
test("real public HEIC decodes locally to genuine JPEG for provider and storage handoff", async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("conversion must not use a remote service");
  };
  try {
    assert.equal(photoFormat(fixture), "heif");
    const result = await prepareImage(
      new File([fixture], "garden.heic", { type: "image/heic" }),
    );
    assert.equal(result.fileName, "garden.jpg");
    assert.equal(result.mimeType, "image/jpeg");
    assert.equal(result.data.subarray(0, 3).toString("hex"), "ffd8ff");
    assert.deepEqual(
      Buffer.from(result.photo.split(",")[1], "base64"),
      result.data,
    );
    assert.match(result.photo, /^data:image\/jpeg;base64,/);
    const metadata = await sharp(result.data).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, 1280);
    assert.equal(metadata.height, 854);
    assert.equal(metadata.exif, undefined);
    assert.equal(result.captureMetadata.capturedAt, undefined);
    assert.equal(result.data.length > 1000, true);
    // This is the actual survey.photo string handed to private draft/save storage.
    const saved = JSON.parse(JSON.stringify({ photo: result.photo }));
    assert.deepEqual(
      Buffer.from(saved.photo.split(",")[1], "base64"),
      result.data,
    );
  } finally {
    globalThis.fetch = fetch;
  }
});
test("HEIF content detection handles absent/wrong image MIME and names", async () => {
  for (const [name, type] of [
    ["camera.heif", "application/octet-stream"],
    ["camera", ""],
    ["wrong.jpg", "image/jpeg"],
  ]) {
    const result = await prepareImage(new File([fixture], name, { type }));
    assert.equal(result.mimeType, "image/jpeg");
  }
});
test("corrupt, disguised and excessive input fails before provider/storage", async () => {
  await assert.rejects(
    prepareImage(
      new File(["not an image"], "fake.heic", { type: "image/heic" }),
    ),
    (e: unknown) => e instanceof ImageInputError && e.status === 415,
  );
  await assert.rejects(
    prepareImage(
      new File([fixture.subarray(0, 150)], "broken.heic", {
        type: "image/heic",
      }),
    ),
    ImageInputError,
  );
  await assert.rejects(
    prepareImage(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "large.heic")),
    (e: unknown) => e instanceof ImageInputError && e.status === 413,
  );
});
test("HEIC keeps original bytes and metadata until local server normalization", async () => {
  const original = new File([fixture], "garden.HEIC", {
    type: "application/octet-stream",
    lastModified: 1234,
  });
  assert.equal(await compressPhoto(original), original);
});
test("ordinary JPEG orientation, dimensions and EXIF capture-time extraction survive normalization", async () => {
  const input = await sharp({
    create: { width: 180, height: 100, channels: 3, background: "green" },
  })
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD2: {
        DateTimeOriginal: "2025:07:14 09:30:00",
        OffsetTimeOriginal: "-04:00",
      },
    })
    .jpeg()
    .toBuffer();
  const image = await prepareImage(
    new File([input], "garden.jpg", { type: "image/jpeg" }),
  );
  assert.deepEqual([image.width, image.height], [100, 180]);
  assert.equal(image.captureMetadata.capturedAt, "2025-07-14T13:30:00.000Z");
  assert.equal(image.captureMetadata.capturedAtConfirmed, false);
  assert.equal(image.captureMetadata.capturedAtSource, "exif");
  assert.equal((await sharp(image.data).metadata()).exif, undefined);
});
test("timezone-less EXIF stays raw metadata without inventing an instant", async () => {
  const input = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "green" },
  })
    .withExifMerge({ IFD2: { DateTimeOriginal: "2025:07:14 09:30:00" } })
    .jpeg()
    .toBuffer();
  const image = await prepareImage(new File([input], "garden.jpg"));
  assert.equal(image.exifCaptureTime?.dateTimeOriginal, "2025:07:14 09:30:00");
  assert.equal(image.captureMetadata.capturedAt, undefined);
});

/** Add a standard counterclockwise irot property to the public fixture's primary item. */
function rotatedFixture() {
  const original = Buffer.from(fixture);
  // libheif's public example has 6 properties; new property 7 is associated with primary item 0x4e24.
  original.writeUInt32BE(original.readUInt32BE(28) + 10, 28); // meta
  original.writeUInt32BE(original.readUInt32BE(355) + 10, 355); // iprp
  original.writeUInt32BE(original.readUInt32BE(363) + 9, 363); // ipco
  original.writeUInt32BE(original.readUInt32BE(913) + 1, 913); // ipma
  original[931] = 3;
  for (const offset of [107, 125, 143, 161])
    original.writeUInt32BE(original.readUInt32BE(offset) + 10, offset);
  const irot = Buffer.from([0, 0, 0, 9, 105, 114, 111, 116, 1]);
  return Buffer.concat([
    original.subarray(0, 913),
    irot,
    original.subarray(913, 934),
    Buffer.from([0x87]),
    original.subarray(934),
  ]);
}
test("HEIF container rotation is applied once by the local decoder", async () => {
  const image = await prepareImage(
    new File([rotatedFixture()], "rotated.heic", { type: "image/heic" }),
  );
  assert.deepEqual([image.width, image.height], [854, 1280]);
  assert.equal((await sharp(image.data).metadata()).orientation, undefined);
});
test("HEIF declared oversized dimensions reject before allocating decoded pixels", async () => {
  const huge = Buffer.from(fixture);
  huge.writeUInt32BE(10000, 509);
  huge.writeUInt32BE(10000, 513);
  await assert.rejects(
    prepareImage(new File([huge], "huge.heic")),
    ImageInputError,
  );
});
test("browser JPEG EXIF preflight preserves original capture metadata for the server", async () => {
  const bytes = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "green" },
  })
    .withExifMerge({ IFD2: { DateTimeOriginal: "2025:07:14 09:30:00" } })
    .jpeg()
    .toBuffer();
  const original = new File([bytes], "camera.jpg", { type: "image/jpeg" });
  const previousImage = globalThis.Image;
  const previousCreate = URL.createObjectURL;
  globalThis.Image = class {
    constructor() {
      throw new Error("EXIF JPEG must bypass canvas");
    }
  } as unknown as typeof Image;
  URL.createObjectURL = () => "blob:test";
  try {
    assert.equal(await compressPhoto(original), original);
  } finally {
    globalThis.Image = previousImage;
    URL.createObjectURL = previousCreate;
  }
});
