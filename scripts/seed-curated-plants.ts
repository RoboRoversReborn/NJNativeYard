import fs from "fs";
import path from "path";
import os from "os";
import type { CuratedPlant, CuratedPhoto, CuratedSource, CuratedReplacement } from "../lib/curated-plant-types";

// Helper to get OAuth token from Firebase CLI configuration
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

function normalize(str: string): string {
  return str.trim().replace(/\s+/g, " ").toLowerCase();
}

async function runSeed() {
  console.log("Starting Curated Plant Seeding into Cloud Firestore...");
  const token = getFirebaseToken();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "nativeyard-nj";

  // 1. Read static datasets
  const floraPath = path.join(process.cwd(), "data", "nj-flora.v1.json");
  const photosPath = path.join(process.cwd(), "data", "reference-photos.downloaded.v1.json");
  const storiesPath = path.join(process.cwd(), "data", "plant-stories.v1.json");

  const floraData = JSON.parse(fs.readFileSync(floraPath, "utf8"));
  const photoData = JSON.parse(fs.readFileSync(photosPath, "utf8"));
  let storiesData: Record<string, any> = {};
  if (fs.existsSync(storiesPath)) {
    try {
      storiesData = JSON.parse(fs.readFileSync(storiesPath, "utf8"));
    } catch {
      /* ignore */
    }
  }

  // Map photos by normalized scientific name
  const photoRecords = photoData.records as Record<string, any[]>;
  const photosByTaxon = new Map<string, any[]>();
  for (const [taxon, list] of Object.entries(photoRecords)) {
    photosByTaxon.set(normalize(taxon), list);
  }

  // Removal protocols map
  const removalProtocols = new Map<string, any>();
  for (const p of floraData.removalProtocols || []) {
    removalProtocols.set(p.id, p);
  }

  // Replacements map
  const replacementsByTarget = new Map<string, any[]>();
  for (const r of floraData.replacements || []) {
    const list = replacementsByTarget.get(r.targetPlantId) || [];
    list.push(r);
    replacementsByTarget.set(r.targetPlantId, list);
  }

  // Default authoritative sources
  const defaultSources: CuratedSource[] = [
    {
      id: "npsnj",
      title: "Native Plant Society of New Jersey (NPSNJ)",
      url: "https://npsnj.org",
      notes: "County flora checklists and native plant guides",
      verifiedAt: new Date().toISOString(),
    },
    {
      id: "jersey-friendly-yards",
      title: "Jersey-Friendly Yards / Barnegat Bay Partnership",
      url: "https://www.jerseyyards.org",
      notes: "Plant database for New Jersey landscapes",
      verifiedAt: new Date().toISOString(),
    },
    {
      id: "nwf-tallamy",
      title: "National Wildlife Federation / Doug Tallamy Keystone Research",
      url: "https://www.nwf.org/Garden-for-Wildlife/About/Native-Plants/keystone-plants-by-ecoregion",
      notes: "Lepidoptera caterpillar host counts and keystone designations",
      verifiedAt: new Date().toISOString(),
    },
  ];

  const curatedPlants: CuratedPlant[] = [];

  for (const p of floraData.plants) {
    const normName = normalize(p.scientificName);
    const existingPhotos = photosByTaxon.get(normName) || [];

    const curatedPhotos: CuratedPhoto[] = existingPhotos.map((photo, idx) => ({
      id: photo.sha256 || `photo-${idx}`,
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl || photo.url,
      organ: (photo.organ as any) || (p.type === "Tree" ? "habit" : "flower"),
      author: photo.author || photo.sourceAuthor || "Reference Contributor",
      license: photo.license || "Public Domain",
      licenseUrl: photo.licenseUrl,
      citation: photo.citation,
      attributionUrl: photo.attributionUrl,
      originalUrl: photo.originalUrl,
      source: photo.source || "Wikimedia Commons",
      isPrimary: idx === 0,
      uploadedAt: new Date().toISOString(),
    }));

    // If no existing photos, use a placeholder or empty list
    const plantReplacements: CuratedReplacement[] = (replacementsByTarget.get(p.id) || []).map((r) => {
      const repPlant = floraData.plants.find((item: any) => item.id === r.replacementPlantId);
      return {
        targetPlantId: r.replacementPlantId,
        scientificName: repPlant?.scientificName || r.replacementPlantId,
        commonName: repPlant?.commonName || r.replacementPlantId,
        reason: r.reason || "High ecological replacement value",
        priority: r.priority || "high",
        isPrimary: r.isPrimary || false,
      };
    });

    const removal = p.removalProtocolId ? removalProtocols.get(p.removalProtocolId) : undefined;

    const curated: CuratedPlant = {
      id: p.id,
      scientificName: p.scientificName,
      commonName: p.commonName,
      status: p.status,
      njStatus: p.njStatus,
      type: p.type,
      growthHabit: p.growthHabit,
      sun: p.sun,
      lightRange: p.lightRange || [],
      moisture: p.moisture,
      moistureRange: p.moistureRange || [],
      bloom: p.bloom,
      bloomMonths: p.bloomMonths || [],
      height: p.height,
      matureHeightFt: p.matureHeightFt || [],
      lepidoptera: p.lepidoptera ?? p.lepidopteraCount,
      lepidopteraCount: p.lepidopteraCount ?? p.lepidoptera,
      specialistBeeSupport: Boolean(p.specialistBeeSupport),
      deerResistance: p.deerResistance,
      ornamentalFeatures: p.ornamentalFeatures || [],
      description: p.description,
      photos: curatedPhotos,
      sources: defaultSources,
      suggestedReplacements: plantReplacements.length > 0 ? plantReplacements : undefined,
      removalProtocol: removal
        ? {
            id: removal.id,
            title: removal.title,
            steps: removal.steps,
            bestMonths: removal.bestMonths,
            chemicalFreeAlternative: removal.chemicalFreeAlternative,
          }
        : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastEditedBy: {
        uid: "system-seed",
        email: "niravgadhia@gmail.com",
        displayName: "Initial Seed",
      },
    };

    curatedPlants.push(curated);
  }

  console.log(`Compiled ${curatedPlants.length} curated plants. Uploading in batches to Firestore...`);

  // Helper to convert plain JS object to Firestore REST API field format
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

  let uploadedCount = 0;
  for (const plant of curatedPlants) {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(plant)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/curated_plants/${plant.id}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Failed to upload ${plant.id}:`, err);
    } else {
      uploadedCount++;
      if (uploadedCount % 10 === 0 || uploadedCount === curatedPlants.length) {
        console.log(`Uploaded ${uploadedCount} / ${curatedPlants.length} plants to Firestore...`);
      }
    }
  }

  // 2. Set up initial curator record in Firestore
  const curatorUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/curators/niravgadhia@gmail.com`;
  await fetch(curatorUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        email: { stringValue: "niravgadhia@gmail.com" },
        role: { stringValue: "admin" },
        isCurator: { booleanValue: true },
        updatedAt: { stringValue: new Date().toISOString() },
      },
    }),
  });

  console.log(`Initial seeding complete! Successfully uploaded ${uploadedCount} curated plants into Cloud Firestore.`);
}

runSeed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
