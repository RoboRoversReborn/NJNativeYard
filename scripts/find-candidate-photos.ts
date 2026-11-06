import fs from "fs";
import path from "path";
import os from "os";
import type { CuratedPhoto } from "../lib/curated-plant-types";

function getFirebaseToken(): string {
  if (process.env.FIREBASE_TOKEN) return process.env.FIREBASE_TOKEN;
  const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const token = config.tokens?.access_token;
    if (token) return token;
  }
  throw new Error("Could not find Firebase CLI access token in ~/.config/configstore/firebase-tools.json");
}

function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

interface WikiPhotoResult {
  url: string;
  thumbnailUrl: string;
  author: string;
  license: string;
  description?: string;
}

async function fetchWikiPhoto(scientificName: string): Promise<WikiPhotoResult | null> {
  // 1. Try English Wikipedia REST API
  try {
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(scientificName)}`;
    const res = await fetch(summaryUrl, {
      headers: { "User-Agent": "NativeYardBot/1.0 (botanical-research@nativeyard.org)" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.originalimage?.source) {
        const src = data.originalimage.source;
        if (!src.endsWith(".svg") && !src.includes("distribution_map") && !src.includes("range_map")) {
          return {
            url: data.originalimage.source,
            thumbnailUrl: data.thumbnail?.source || data.originalimage.source,
            author: "Wikimedia Commons Contributor",
            license: "CC-BY-SA / Public Domain",
            description: data.description || `${scientificName} specimen`,
          };
        }
      }
    }
  } catch {
    /* fallback to commons */
  }

  // 2. Try Wikimedia Commons Search API
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      scientificName
    )}&gsrnamespace=6&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`;
    const res = await fetch(commonsUrl, {
      headers: { "User-Agent": "NativeYardBot/1.0 (botanical-research@nativeyard.org)" },
    });
    if (res.ok) {
      const data = await res.json();
      const pages = Object.values(data?.query?.pages || {});
      for (const page of pages as any[]) {
        const info = page.imageinfo?.[0];
        if (info && info.url) {
          const url: string = info.url;
          if (
            (url.endsWith(".jpg") || url.endsWith(".jpeg") || url.endsWith(".png") || url.endsWith(".webp")) &&
            !url.toLowerCase().includes("map") &&
            !url.toLowerCase().includes("icon")
          ) {
            const meta = info.extmetadata || {};
            const artist = meta.Artist?.value?.replace(/<[^>]*>/g, "") || "Wikimedia Commons Contributor";
            const license = meta.LicenseShortName?.value || "CC-BY-SA / Public Domain";
            return {
              url,
              thumbnailUrl: info.thumburl || url,
              author: artist.trim().slice(0, 100),
              license: license.trim().slice(0, 50),
              description: meta.ObjectName?.value || `${scientificName} specimen`,
            };
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

async function runFindPhotos() {
  console.log("=== Finding Candidate Botanical Photos for Missing Species ===");
  const token = getFirebaseToken();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "nativeyard-nj";

  // 1. Fetch all documents from curated_plants
  console.log("Querying Cloud Firestore curated_plants documents...");
  const plantsNeedingPhotos: Array<{ id: string; scientificName: string; commonName: string }> = [];

  let pageToken = "";
  do {
    const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/curated_plants?pageSize=300${
      pageToken ? `&pageToken=${pageToken}` : ""
    }`;
    const res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      for (const doc of data.documents || []) {
        const id = doc.name.split("/").pop();
        const sciName = doc.fields?.scientificName?.stringValue;
        const comName = doc.fields?.commonName?.stringValue;
        const photos = doc.fields?.photos?.arrayValue?.values || [];

        if (id && sciName && photos.length === 0) {
          plantsNeedingPhotos.push({
            id,
            scientificName: sciName,
            commonName: comName || sciName,
          });
        }
      }
      pageToken = data.nextPageToken || "";
    } else {
      console.warn("Could not list documents:", await res.text());
      break;
    }
  } while (pageToken);

  console.log(`Found ${plantsNeedingPhotos.length} species lacking field photos.`);
  if (plantsNeedingPhotos.length === 0) {
    console.log("All plants in the database already have photos.");
    return;
  }

  // 2. Fetch candidate photos concurrently in controlled batches
  let updatedCount = 0;
  let notFoundCount = 0;
  const CONCURRENCY = 6;

  for (let i = 0; i < plantsNeedingPhotos.length; i += CONCURRENCY) {
    const batch = plantsNeedingPhotos.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (plant) => {
        const result = await fetchWikiPhoto(plant.scientificName);
        if (!result) {
          notFoundCount++;
          return;
        }

        const candidatePhoto: CuratedPhoto = {
          id: `wiki-candidate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: result.url,
          thumbnailUrl: result.thumbnailUrl,
          organ: "habit",
          author: result.author,
          license: result.license,
          source: "Wikimedia Commons (Unverified Candidate)",
          verificationStatus: "unverified",
          isPrimary: true,
          uploadedAt: new Date().toISOString(),
        };

        const updateUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/curated_plants/${plant.id}?updateMask.fieldPaths=photos&updateMask.fieldPaths=updatedAt`;

        const res = await fetch(updateUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              photos: toFirestoreValue([candidatePhoto]),
              updatedAt: { stringValue: new Date().toISOString() },
            },
          }),
        });

        if (res.ok) {
          updatedCount++;
        } else {
          console.warn(`Failed to update ${plant.id}:`, await res.text());
        }
      })
    );

    // Brief delay to be polite to Wikimedia APIs
    await new Promise((resolve) => setTimeout(resolve, 350));

    if ((i + CONCURRENCY) % 30 === 0 || i + CONCURRENCY >= plantsNeedingPhotos.length) {
      console.log(
        `Progress: Checked ${Math.min(i + CONCURRENCY, plantsNeedingPhotos.length)} / ${
          plantsNeedingPhotos.length
        } species (Photos Attached: ${updatedCount}, Not found: ${notFoundCount})`
      );
    }
  }

  console.log(
    `=== Finished! Attached candidate photos (marked status: unverified) to ${updatedCount} species. (${notFoundCount} without suitable public domain photos) ===`
  );
}

runFindPhotos().catch((err) => {
  console.error("Image search script error:", err);
  process.exit(1);
});
