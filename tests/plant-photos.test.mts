import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";
import React from "react";
import { JSDOM } from "jsdom";
import manifest from "../data/reference-photos.downloaded.v1.json";
import { storedReferencePhotos } from "../lib/plant-reference-store";
import { catalog } from "../lib/survey";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3100/",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const { render, screen, cleanup, fireEvent } =
  await import("@testing-library/react");
const { ReferenceImage } = await import("../components/plant-photos");

test("downloaded references have intact local assets, whole-taxon evidence, dimensions and reusable credits", async () => {
  const audit = JSON.parse(
    fs.readFileSync(
      new URL(
        "../research/plant-images/optimized-audit.v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(audit.records.length, catalog.length);
  assert.equal(
    new Set(
      audit.records.map(
        (row: { scientificName: string }) => row.scientificName,
      ),
    ).size,
    catalog.length,
  );
  assert.equal(manifest.status, "acquisition-complete");
  let count = 0;
  for (const plant of catalog) {
    const photos = storedReferencePhotos(plant.scientificName);
    for (const photo of photos) {
      count++;
      assert.equal(photo.requestedTaxon, plant.scientificName);
      assert.ok(photo.sourceTaxon && /^Q\d+$/.test(photo.wikidataId));
      assert.match(photo.url, /^\/references\/[a-f0-9]{64}\.webp$/);
      const file = new URL(`../public${photo.url}`, import.meta.url);
      const bytes = fs.readFileSync(file);
      assert.equal(
        crypto.createHash("sha256").update(bytes).digest("hex"),
        photo.sha256,
      );
      const info = await sharp(bytes).metadata();
      assert.equal(info.format, "webp");
      assert.equal(info.width, photo.width);
      assert.equal(info.height, photo.height);
      assert.ok(Math.max(info.width!, info.height!) <= 1024);
      assert.ok(
        photo.author &&
          photo.license &&
          photo.licenseUrl?.startsWith("https://"),
      );
      assert.ok(
        photo.attributionUrl?.startsWith(
          "https://commons.wikimedia.org/wiki/File:",
        ),
      );
      const thumbnailBytes = fs.readFileSync(
        new URL(`../public${photo.thumbnailUrl}`, import.meta.url),
      );
      assert.equal(
        crypto.createHash("sha256").update(thumbnailBytes).digest("hex"),
        photo.thumbnailSha256,
      );
      const thumb = await sharp(thumbnailBytes).metadata();
      assert.equal(thumb.width, photo.thumbnailWidth);
      assert.equal(thumb.height, photo.thumbnailHeight);
      assert.ok(Math.max(thumb.width!, thumb.height!) <= 480);
      assert.equal(new URL(photo.originalUrl).protocol, "https:");
      assert.equal(new URL(photo.originalUrl).hostname, "upload.wikimedia.org");
      assert.match(photo.modified, /Resized.*WebP/);
      assert.doesNotMatch(photo.license, /\b(?:NC|ND)\b/);
    }
  }
  assert.ok(count > 0);
  assert.equal(count, Object.keys(manifest.records).length);
  assert.deepEqual(storedReferencePhotos("Quercus"), []);
  assert.deepEqual(
    storedReferencePhotos("Unmatched species subsp. unknown"),
    [],
  );
});

test("detail preserves the full specimen while card cropping is explicit, with original and credits retained", () => {
  const taxon = Object.keys(manifest.records)[0];
  const photo = storedReferencePhotos(taxon)[0];
  assert.ok(photo);
  try {
    render(
      React.createElement(ReferenceImage, {
        name: "Reference plant",
        scientificName: taxon,
      }),
    );
    let image = screen.getByAltText(
      "Reference specimen: Reference plant",
    ) as HTMLImageElement;
    assert.equal(image.getAttribute("src"), photo.url);
    assert.equal(image.style.objectFit, "contain");
    assert.equal(image.getAttribute("width"), String(photo.width));
    assert.equal(
      (
        screen.getByRole("link", {
          name: "Open full image ↗",
        }) as HTMLAnchorElement
      ).href,
      `http://localhost:3100${photo.url}`,
    );
    const visibleLicense = screen
      .getAllByRole("link", { name: photo.license })
      .filter((link) => !link.closest("details"));
    assert.equal(visibleLicense.length, 1);
    assert.equal(visibleLicense[0].getAttribute("href"), photo.licenseUrl);
    cleanup();
    render(
      React.createElement(ReferenceImage, {
        name: "Reference plant",
        scientificName: taxon,
        variant: "card",
      }),
    );
    image = screen.getByAltText(
      "Reference specimen: Reference plant",
    ) as HTMLImageElement;
    assert.equal(image.style.objectFit, "cover");
    assert.equal(image.getAttribute("src"), photo.thumbnailUrl);
    fireEvent.error(image);
    assert.ok(screen.getByText("No verified reference photo available"));
  } finally {
    cleanup();
  }
});

test("missing exact references and restricted provider images show an honest fallback", () => {
  try {
    render(
      React.createElement(ReferenceImage, {
        name: "Unknown plant",
        scientificName: "Unknown exact taxon",
        photos: [
          {
            url: "https://example.test/restricted.jpg",
            author: "Example",
            license: "CC BY-NC 4.0",
            source: "Wikimedia Commons",
          },
        ],
      }),
    );
    assert.equal(screen.queryByRole("img"), null);
    assert.ok(screen.getByText("No verified reference photo available"));
  } finally {
    cleanup();
  }
});


test("profile uses one primary reference with context switch and falls back to the observation", async () => {
  const { ProfileImages } = await import("../components/plant-photos");
  const region = { id: "context-region", suggestion: "White Oak", scientificName: "Quercus alba", box: { x: 10, y: 10, w: 30, h: 40 }, reviewed: false, candidates: [] };
  const props = { photo: "/yard.jpg", plant: region, sample: false, name: "White Oak", scientificName: "Quercus alba" };
  try {
    render(React.createElement(ProfileImages, props));
    assert.ok(screen.getByAltText("Reference specimen: White Oak"));
    assert.ok(document.querySelector(".rw-profile-context"));
    fireEvent.click(screen.getByRole("button", { name: "View your plant photo" }));
    assert.equal(screen.queryByAltText("Reference specimen: White Oak"), null);
    assert.ok(screen.getByText("Your plant photo · selected region"));
    fireEvent.click(screen.getByRole("button", { name: "View reference photo" }));
    fireEvent.error(screen.getByAltText("Reference specimen: White Oak"));
    assert.ok(screen.getByText(/reference photo could not load/));
    assert.ok(screen.getByText("Your plant photo · selected region"));
    cleanup();
    render(React.createElement(ProfileImages, { ...props, sample: true, scientificName: "Unmatched plant" }));
    assert.ok(screen.getByText(/No verified reference photo is available/));
    assert.ok(screen.getByText("Sample yard photo · selected region"));
    assert.equal(screen.queryByRole("button", { name: "View your plant photo" }), null);
  } finally { cleanup(); }
});
