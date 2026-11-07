import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
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

export interface CuratorRecord {
  email: string;
  role: "admin" | "curator";
  displayName?: string;
  addedBy?: string;
  addedAt: string;
  updatedAt?: string;
}

let memoryCache: CuratedPlant[] | null = null;
const CACHE_STORAGE_KEY = "nativeyard_curated_plants_v4";
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const curatorRoleCache = new Map<string, { role: "admin" | "curator"; timestamp: number }>();

export function isAdmin(user?: AppUser | null): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase().trim();
  if (email === "niravgadhia@gmail.com") return true;
  if (user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin") return true;
  if (email && curatorRoleCache.get(email)?.role === "admin") return true;
  return false;
}

export function isCurator(user?: AppUser | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const email = user.email?.toLowerCase().trim();
  if (user.app_metadata?.role === "curator" || user.user_metadata?.role === "curator") return true;
  if (email && curatorRoleCache.has(email)) return true;
  return false;
}

export async function checkUserPermissions(
  user?: AppUser | null
): Promise<{ isCurator: boolean; isAdmin: boolean; role?: "admin" | "curator" | null }> {
  if (!user || !user.email) return { isCurator: false, isAdmin: false, role: null };
  const email = user.email.toLowerCase().trim();
  if (email === "niravgadhia@gmail.com") {
    curatorRoleCache.set(email, { role: "admin", timestamp: Date.now() });
    return { isCurator: true, isAdmin: true, role: "admin" };
  }

  if (process.env.NODE_ENV === "test" || !isFirebaseConfigured()) {
    const admin = isAdmin(user);
    const curator = isCurator(user);
    return { isCurator: curator, isAdmin: admin, role: admin ? "admin" : curator ? "curator" : null };
  }

  try {
    const firestore = getFirebaseDb();
    if (!firestore) return { isCurator: isCurator(user), isAdmin: isAdmin(user), role: null };

    const curatorDoc = await getDoc(doc(firestore, "curators", email));
    if (curatorDoc.exists()) {
      const data = curatorDoc.data();
      const role = data.role === "admin" ? "admin" : "curator";
      curatorRoleCache.set(email, { role, timestamp: Date.now() });
      return { isCurator: true, isAdmin: role === "admin", role };
    }
  } catch (err) {
    console.warn("Failed to check curator permissions:", err);
  }

  return { isCurator: isCurator(user), isAdmin: isAdmin(user), role: null };
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
      // Clean up legacy keys
      window.localStorage.removeItem("nativeyard_curated_plants_v1");
      window.localStorage.removeItem("nativeyard_curated_plants_v2");
      window.localStorage.removeItem("nativeyard_curated_plants_v3");

      const stored = window.localStorage.getItem(CACHE_STORAGE_KEY);
      if (stored) {
        const payload = JSON.parse(stored);
        if (
          payload &&
          Array.isArray(payload.items) &&
          payload.items.length > 0 &&
          Date.now() - (payload.timestamp || 0) < CACHE_TTL_MS
        ) {
          const items = payload.items as CuratedPlant[];
          memoryCache = items;
          return items;
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
          window.localStorage.setItem(
            CACHE_STORAGE_KEY,
            JSON.stringify({ timestamp: Date.now(), items })
          );
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

function cleanFirestorePayload(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanFirestorePayload).filter((v) => v !== undefined);
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const res: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        res[key] = cleanFirestorePayload(val);
      }
    }
    return res;
  }
  return obj;
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

  const cleanedPayload = cleanFirestorePayload(updatedPlant);
  await setDoc(doc(firestore, "curated_plants", plant.id), cleanedPayload, { merge: true });

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
        window.localStorage.setItem(
          CACHE_STORAGE_KEY,
          JSON.stringify({ timestamp: Date.now(), items: memoryCache })
        );
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

export async function getCuratorList(): Promise<CuratorRecord[]> {
  if (process.env.NODE_ENV === "test" || !isFirebaseConfigured()) {
    return [
      {
        email: "niravgadhia@gmail.com",
        role: "admin",
        displayName: "Nirav Gadhia",
        addedAt: "2026-11-06T00:00:00.000Z",
        addedBy: "system_bootstrap",
      },
    ];
  }

  const firestore = getFirebaseDb();
  if (!firestore) return [];

  const snapshot = await getDocs(collection(firestore, "curators"));
  const list: CuratorRecord[] = [];
  snapshot.forEach((d) => {
    const data = d.data();
    list.push({
      email: data.email || d.id,
      role: data.role === "curator" ? "curator" : "admin",
      displayName: data.displayName,
      addedBy: data.addedBy,
      addedAt: data.addedAt || new Date().toISOString(),
      updatedAt: data.updatedAt,
    });
  });

  // Ensure primary owner is always present
  if (!list.some((c) => c.email.toLowerCase() === "niravgadhia@gmail.com")) {
    list.unshift({
      email: "niravgadhia@gmail.com",
      role: "admin",
      displayName: "Nirav Gadhia",
      addedAt: new Date().toISOString(),
      addedBy: "system_bootstrap",
    });
  }

  return list;
}

export async function setCuratorRole(
  targetEmail: string,
  role: "admin" | "curator",
  currentUser: AppUser,
  displayName?: string
): Promise<void> {
  const normEmail = targetEmail.toLowerCase().trim();
  if (!normEmail || !normEmail.includes("@")) {
    throw new Error("A valid email address is required.");
  }

  if (!isAdmin(currentUser)) {
    throw new Error("Only an administrator can assign or modify access roles.");
  }

  const firestore = getFirebaseDb();
  if (!firestore) throw new Error("Database not connected.");

  const now = new Date().toISOString();
  const curatorDocRef = doc(firestore, "curators", normEmail);
  const existing = await getDoc(curatorDocRef);

  const payload: CuratorRecord = {
    email: normEmail,
    role,
    displayName: displayName?.trim() || normEmail.split("@")[0],
    addedBy: currentUser.email || currentUser.id,
    addedAt: existing.exists() ? existing.data()?.addedAt || now : now,
    updatedAt: now,
  };

  await setDoc(curatorDocRef, payload, { merge: true });
  curatorRoleCache.set(normEmail, { role, timestamp: Date.now() });
}

export async function removeCurator(
  targetEmail: string,
  currentUser: AppUser
): Promise<void> {
  const normEmail = targetEmail.toLowerCase().trim();
  if (normEmail === "niravgadhia@gmail.com") {
    throw new Error("Primary owner permissions cannot be revoked.");
  }

  if (currentUser.email?.toLowerCase().trim() === normEmail) {
    throw new Error("You cannot revoke your own administrator access.");
  }

  if (!isAdmin(currentUser)) {
    throw new Error("Only an administrator can revoke access.");
  }

  const firestore = getFirebaseDb();
  if (!firestore) throw new Error("Database not connected.");

  await deleteDoc(doc(firestore, "curators", normEmail));
  curatorRoleCache.delete(normEmail);
}

export async function updatePlantPhotoVerification(
  plantId: string,
  photoId: string,
  verificationStatus: "verified" | "unverified",
  user: AppUser
): Promise<CuratedPlant> {
  if (!isCurator(user)) {
    throw new Error("Only an authorized curator can verify plant photos.");
  }

  const plant = await getCuratedPlant(plantId);
  if (!plant) throw new Error(`Plant ${plantId} not found.`);

  const updatedPhotos = plant.photos.map((p) => {
    if (p.id === photoId) {
      return { ...p, verificationStatus };
    }
    return p;
  });

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

  const firestore = getFirebaseDb();
  if (firestore) {
    await updateDoc(doc(firestore, "curated_plants", plantId), {
      photos: updatedPhotos,
      updatedAt: updatedPlant.updatedAt,
      lastEditedBy: updatedPlant.lastEditedBy,
    });
  }

  if (memoryCache) {
    const idx = memoryCache.findIndex((p) => p.id === plantId);
    if (idx >= 0) memoryCache[idx] = updatedPlant;
  }

  return updatedPlant;
}


