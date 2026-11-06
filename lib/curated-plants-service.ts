import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  isFirebaseConfigured,
  getFirebaseDb,
  getFirebaseStorage,
} from "./firebase/client";
import type { AppUser } from "./firebase/auth-user";
import type { CuratedPlant, CuratedPhoto } from "./curated-plant-types";
import staticFlora from "@/data/nj-flora.v1.json";
import staticPhotos from "@/data/reference-photos.downloaded.v1.json";

let memoryCache: CuratedPlant[] | null = null;
const CACHE_STORAGE_KEY = "nativeyard_curated_plants_v1";

export function isCurator(user?: AppUser | null): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase().trim();
  if (email === "niravgadhia@gmail.com") return true;
  if (user.app_metadata?.role === "curator" || user.app_metadata?.role === "admin") return true;
  if (user.user_metadata?.role === "curator" || user.user_metadata?.role === "admin") return true;
  return false;
}

/** Fallback to static bundled files if Firestore is offline or in test environments */
export function getStaticFallbackPlants(): CuratedPlant[] {
  const photoRecords = (staticPhotos as any).records as Record<string, any[]>;
  const photosByTaxon = new Map<string, any[]>();
  for (const [taxon, list] of Object.entries(photoRecords)) {
    photosByTaxon.set(taxon.trim().toLowerCase(), list);
  }

  const removalProtocols = new Map<string, any>();
  for (const p of (staticFlora as any).removalProtocols || []) {
    removalProtocols.set(p.id, p);
  }

  const replacementsByTarget = new Map<string, any[]>();
  for (const r of (staticFlora as any).replacements || []) {
    const list = replacementsByTarget.get(r.targetPlantId) || [];
    list.push(r);
    replacementsByTarget.set(r.targetPlantId, list);
  }

  return (staticFlora as any).plants.map((p: any) => {
    const normName = p.scientificName.trim().toLowerCase();
    const existingPhotos = photosByTaxon.get(normName) || [];
    const photos: CuratedPhoto[] = existingPhotos.map((photo, idx) => ({
      id: photo.sha256 || `photo-${idx}`,
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl || photo.url,
      organ: photo.organ || (p.type === "Tree" ? "habit" : "flower"),
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

    const removal = p.removalProtocolId ? removalProtocols.get(p.removalProtocolId) : undefined;
    const replacements = (replacementsByTarget.get(p.id) || []).map((r) => {
      const rep = (staticFlora as any).plants.find((item: any) => item.id === r.replacementPlantId);
      return {
        targetPlantId: r.replacementPlantId,
        scientificName: rep?.scientificName || r.replacementPlantId,
        commonName: rep?.commonName || r.replacementPlantId,
        reason: r.reason || "High ecological replacement value",
        priority: r.priority || "high",
        isPrimary: r.isPrimary || false,
      };
    });

    return {
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
      photos,
      sources: [
        {
          id: "npsnj",
          title: "Native Plant Society of New Jersey",
          url: "https://npsnj.org",
        },
        {
          id: "jersey-friendly-yards",
          title: "Jersey-Friendly Yards",
          url: "https://www.jerseyyards.org",
        },
      ],
      suggestedReplacements: replacements.length ? replacements : undefined,
      removalProtocol: removal,
    } as CuratedPlant;
  });
}

/** Get all curated plants from Firestore with fallback */
export async function getCuratedPlants(forceRefresh = false): Promise<CuratedPlant[]> {
  if (process.env.NODE_ENV === "test") {
    return getStaticFallbackPlants();
  }

  if (!forceRefresh && memoryCache && memoryCache.length > 0) {
    return memoryCache;
  }

  if (typeof window !== "undefined" && !forceRefresh) {
    try {
      const stored = window.localStorage.getItem(CACHE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryCache = parsed;
          // Invalidate asynchronously to ensure freshness
          void getCuratedPlants(true);
          return memoryCache;
        }
      }
    } catch {
      /* ignore storage read error */
    }
  }

  if (!isFirebaseConfigured()) {
    const fallback = getStaticFallbackPlants();
    memoryCache = fallback;
    return fallback;
  }

  const firestore = getFirebaseDb();
  if (!firestore) {
    const fallback = getStaticFallbackPlants();
    memoryCache = fallback;
    return fallback;
  }

  try {
    const snap = await getDocs(collection(firestore, "curated_plants"));
    if (!snap.empty) {
      const items = snap.docs.map((docSnap) => docSnap.data() as CuratedPlant);
      items.sort((a, b) => a.commonName.localeCompare(b.commonName));
      memoryCache = items;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(items));
        } catch {
          /* storage quota ignore */
        }
      }
      return items;
    }
  } catch (err) {
    console.warn("Could not load curated plants from Firestore, falling back to static data.", err);
  }

  const fallback = getStaticFallbackPlants();
  memoryCache = fallback;
  return fallback;
}

/** Get a single curated plant by ID */
export async function getCuratedPlant(id: string): Promise<CuratedPlant | undefined> {
  const plants = await getCuratedPlants();
  const found = plants.find((p) => p.id === id);
  if (found) return found;

  if (isFirebaseConfigured()) {
    const firestore = getFirebaseDb();
    if (firestore) {
      try {
        const docSnap = await getDoc(doc(firestore, "curated_plants", id));
        if (docSnap.exists()) {
          return docSnap.data() as CuratedPlant;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return undefined;
}

/** Save or update a plant document in Firestore */
export async function saveCuratedPlant(
  plant: CuratedPlant,
  user: AppUser,
): Promise<CuratedPlant> {
  if (!isCurator(user)) {
    throw new Error("Only curators and administrators can modify curated plant records.");
  }

  const firestore = getFirebaseDb();
  if (!firestore) {
    throw new Error("Firebase database is not configured.");
  }

  const now = new Date().toISOString();
  const updatedPlant: CuratedPlant = {
    ...plant,
    updatedAt: now,
    createdAt: plant.createdAt || now,
    lastEditedBy: {
      uid: user.id,
      email: user.email,
      displayName: user.user_metadata?.full_name || user.email || "Curator",
    },
  };

  await setDoc(doc(firestore, "curated_plants", plant.id), updatedPlant, { merge: true });

  // Update in-memory and local cache
  if (memoryCache) {
    const idx = memoryCache.findIndex((p) => p.id === plant.id);
    if (idx >= 0) {
      memoryCache[idx] = updatedPlant;
    } else {
      memoryCache.push(updatedPlant);
      memoryCache.sort((a, b) => a.commonName.localeCompare(b.commonName));
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(memoryCache));
      } catch {
        /* storage quota ignore */
      }
    }
  }

  return updatedPlant;
}

/** Upload a new reference photo directly to Firebase Storage and attach to plant document */
export async function uploadPlantPhoto(
  plantId: string,
  file: File,
  meta: Partial<CuratedPhoto>,
  user: AppUser,
): Promise<{ plant: CuratedPlant; photo: CuratedPhoto }> {
  if (!user) {
    throw new Error("Please sign in to upload photos.");
  }

  const storage = getFirebaseStorage();
  const firestore = getFirebaseDb();
  if (!storage || !firestore) {
    throw new Error("Firebase storage or database is not configured.");
  }

  const photoId = crypto.randomUUID();
  const ext = file.name.split(".").pop() || "jpg";
  const storagePath = `plants/${plantId}/${photoId}.${ext}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  const downloadUrl = await getDownloadURL(storageRef);

  const newPhoto: CuratedPhoto = {
    id: photoId,
    url: downloadUrl,
    thumbnailUrl: downloadUrl,
    organ: meta.organ || "habit",
    author: meta.author || user.user_metadata?.full_name || user.email || "Contributor",
    license: meta.license || "CC BY-SA 4.0",
    licenseUrl: meta.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/",
    citation: meta.citation || `${meta.author || user.user_metadata?.full_name || "Contributor"} / NativeYard Community`,
    attributionUrl: meta.attributionUrl,
    source: "NativeYard Contributor Upload",
    isPrimary: Boolean(meta.isPrimary),
    uploadedAt: new Date().toISOString(),
    storagePath,
  };

  const plant = await getCuratedPlant(plantId);
  if (!plant) {
    throw new Error(`Plant ${plantId} not found.`);
  }

  let updatedPhotos = [...plant.photos];
  if (newPhoto.isPrimary) {
    updatedPhotos = updatedPhotos.map((p) => ({ ...p, isPrimary: false }));
  }
  updatedPhotos.unshift(newPhoto);

  const updatedPlant: CuratedPlant = {
    ...plant,
    photos: updatedPhotos,
    updatedAt: new Date().toISOString(),
    lastEditedBy: {
      uid: user.id,
      email: user.email,
      displayName: user.user_metadata?.full_name || "Curator",
    },
  };

  await updateDoc(doc(firestore, "curated_plants", plantId), {
    photos: updatedPhotos,
    updatedAt: updatedPlant.updatedAt,
    lastEditedBy: updatedPlant.lastEditedBy,
  });

  if (memoryCache) {
    const idx = memoryCache.findIndex((p) => p.id === plantId);
    if (idx >= 0) memoryCache[idx] = updatedPlant;
  }

  return { plant: updatedPlant, photo: newPhoto };
}
