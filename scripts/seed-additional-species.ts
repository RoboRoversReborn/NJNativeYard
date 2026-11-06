import fs from "fs";
import path from "path";
import os from "os";
import type { CuratedPlant, CuratedSource } from "../lib/curated-plant-types";

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

async function runAdditionalSeed() {
  console.log("=== Seeding Additional NPSNJ & USDA New Jersey Species ===");
  const token = getFirebaseToken();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "nativeyard-nj";

  // 1. Fetch currently stored species in Firestore to prevent duplicate uploads
  console.log("Fetching existing species from Cloud Firestore...");
  const existingTaxa = new Set<string>();
  const existingIds = new Set<string>();

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
        if (id) existingIds.add(id);
        const sciName = doc.fields?.scientificName?.stringValue;
        if (sciName) existingTaxa.add(normalize(sciName));
      }
      pageToken = data.nextPageToken || "";
    } else {
      console.warn("Could not list existing documents, proceeding with caution.");
      break;
    }
  } while (pageToken);

  console.log(`Found ${existingTaxa.size} species currently stored in Cloud Firestore.`);

  // 2. Read approved additions (NPSNJ cohort)
  const additionsPath = path.join(process.cwd(), "data", "catalog-expansion", "approved-additions.v1.json");
  const additionsData = JSON.parse(fs.readFileSync(additionsPath, "utf8"));
  const records: any[] = additionsData.records || [];

  // 3. Read NJ classification inventory for families
  const invPath = path.join(process.cwd(), "data", "nj-classification-inventory.v1.json");
  let inventoryRecords: Record<string, any> = {};
  if (fs.existsSync(invPath)) {
    try {
      const invData = JSON.parse(fs.readFileSync(invPath, "utf8"));
      inventoryRecords = invData.records || {};
    } catch {
      /* ignore */
    }
  }

  // Lookup map by scientific name
  const inventoryByName = new Map<string, any>();
  for (const inv of Object.values(inventoryRecords)) {
    if (inv.sourceName) inventoryByName.set(normalize(inv.sourceName), inv);
    if (inv.lookupKey) inventoryByName.set(normalize(inv.lookupKey), inv);
  }

  // 4. Read keystone genera
  const evidencePath = path.join(process.cwd(), "data", "nj-evidence.v2.json");
  const keystoneGenera = new Set<string>();
  if (fs.existsSync(evidencePath)) {
    try {
      const evData = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
      for (const k of evData.keystoneGenera || []) {
        if (k.genus) keystoneGenera.add(k.genus.toLowerCase().trim());
      }
    } catch {
      /* ignore */
    }
  }

  // 5. Build candidate CuratedPlant records
  const candidates: CuratedPlant[] = [];

  for (const r of records) {
    const normName = normalize(r.scientificName);
    if (existingTaxa.has(normName)) {
      continue; // Skip species already present
    }

    const genus = r.scientificName.split(" ")[0].toLowerCase().trim();
    const isKeystone = keystoneGenera.has(genus) && r.status === "native";
    const status: "keystone" | "native" | "non-native" | "invasive" = isKeystone
      ? "keystone"
      : r.status === "invasive"
      ? "invasive"
      : r.status === "non-native"
      ? "non-native"
      : "native";

    const inv = inventoryByName.get(normName);
    const family = inv?.sourceFloraRecord?.family;

    let cleanId = (r.id || "")
      .replace(/^garden-/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (!cleanId) {
      cleanId = normName.replace(/[^a-z0-9]+/g, "-");
    }

    if (existingIds.has(cleanId)) {
      cleanId = `${cleanId}-npsnj`;
    }
    existingIds.add(cleanId);
    existingTaxa.add(normName);

    // Build authorities and citations
    const sources: CuratedSource[] = [];
    if (r.admission?.gardenEvidence?.url) {
      sources.push({
        id: "source-npsnj",
        title: "Native Plant Society of NJ · Going Native Guide",
        url: r.admission.gardenEvidence.url,
        notes: "Documented in New Jersey regional native landscaping guide.",
        verifiedAt: r.admission.checkedOn || "2026-11-04",
      });
    }
    if (r.admission?.horticulture?.source?.url) {
      sources.push({
        id: "source-ncsu",
        title: "NC State Extension Plant Toolbox",
        url: r.admission.horticulture.source.url,
        notes: "Botanical traits and cultivation requirements.",
        verifiedAt: r.admission.checkedOn || "2026-11-04",
      });
    }
    if (r.admission?.regionalEvidence?.url) {
      sources.push({
        id: "source-njdep",
        title: "NJDEP Native Regional Plant List",
        url: r.admission.regionalEvidence.url,
        notes: "Official New Jersey Department of Environmental Protection native inventory.",
        verifiedAt: "2026-11-04",
      });
    }

    const now = new Date().toISOString();
    const plant: CuratedPlant = {
      id: cleanId,
      scientificName: r.scientificName.trim(),
      commonName: r.commonName.trim(),
      status,
      curationStatus: "staged",
      family: family || undefined,
      type: r.type || "Perennial",
      growthHabit: r.type || "Perennial",
      sun: r.sun || undefined,
      moisture: r.moisture || undefined,
      bloom: r.bloom || undefined,
      height: r.height || undefined,
      description:
        r.description ||
        `A New Jersey native species documented by the Native Plant Society of New Jersey (NPSNJ) for regional gardening and habitat restoration.`,
      photos: [],
      sources,
      createdAt: now,
      updatedAt: now,
      lastEditedBy: {
        uid: "system-expansion",
        email: "niravgadhia@gmail.com",
        displayName: "NPSNJ & USDA Expansion",
      },
    };

    candidates.push(plant);
  }

  console.log(`Identified ${candidates.length} new unique species ready for Firestore upload.`);
  if (candidates.length === 0) {
    console.log("All candidates already exist in Cloud Firestore. Nothing to upload.");
    return;
  }

  // 6. Concurrently upload candidates in chunks
  let uploaded = 0;
  const CHUNK_SIZE = 12;

  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (plant) => {
        const fields: Record<string, any> = {};
        for (const [k, v] of Object.entries(plant)) {
          if (v !== undefined) fields[k] = toFirestoreValue(v);
        }

        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/curated_plants/${plant.id}`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fields }),
        });

        if (!res.ok) {
          const err = await res.text();
          console.error(`Error uploading ${plant.id}:`, err);
        } else {
          uploaded++;
        }
      })
    );

    console.log(`Uploaded ${uploaded} / ${candidates.length} new species...`);
  }

  console.log(`=== Complete! Added ${uploaded} new New Jersey species to Cloud Firestore. ===`);
}

runAdditionalSeed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
