import {
  isFirebaseConfigured,
  getFirebaseDb,
} from "./firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import type { PublicYard, LeaderboardSortBy } from "./leaderboard-types";
import type { Property } from "./account/repository";
import type { Survey } from "./survey";
import { computeYardMetrics, formatTownOrCounty } from "./gamification";
import { sampleYards } from "./sample-yards";

// Built-in starter pilot yards so the leaderboard is immediately full & inspiring
const PILOT_SAMPLE_YARDS: PublicYard[] = [
  {
    id: "pilot-oak-haven",
    ownerId: "pilot-system-1",
    yardName: "Summit Oak & Pollinator Haven",
    gardenerAlias: "Sarah M.",
    townOrCounty: "Summit, Union County",
    county: "Union",
    zip: "07901",
    coverPhotoUrl: "/samples/mixed-garden-starting-v4.png",
    score: 94,
    rawScore: 94,
    tier: "High habitat value",
    nativeSpeciesCount: 16,
    keystoneCount: 4,
    invasiveCount: 0,
    totalPlantsSurveyed: 22,
    badges: [
      {
        id: "century-yard",
        label: "High Habitat Score",
        icon: "💯",
        description: "Achieved top 5% habitat value across New Jersey.",
      },
      {
        id: "keystone-champion",
        label: "Keystone Champion",
        icon: "🏆",
        description: "Hosts Quercus alba and Prunus serotina supporting hundreds of Lepidoptera species.",
      },
      {
        id: "invasive-free",
        label: "Invasive Free",
        icon: "🛡️",
        description: "Completely free of aggressive invasive plants.",
      },
      {
        id: "bee-haven",
        label: "Specialist Bee Haven",
        icon: "🐝",
        description: "Abundant native flowering perennials offering uninterrupted pollen and nectar.",
      },
    ],
    areas: [
      {
        id: "area-front",
        name: "Front Yard Pollinator Border",
        photoUrl: "/samples/mixed-garden-starting-v4.png",
        plants: [
          {
            id: "p1",
            commonName: "White Oak",
            scientificName: "Quercus alba",
            status: "keystone",
            type: "Tree",
          },
          {
            id: "p2",
            commonName: "Wild Bergamot",
            scientificName: "Monarda fistulosa",
            status: "native",
            type: "Perennial",
          },
          {
            id: "p3",
            commonName: "Butterfly Weed",
            scientificName: "Asclepias tuberosa",
            status: "native",
            type: "Perennial",
          },
          {
            id: "p4",
            commonName: "Black Cherry",
            scientificName: "Prunus serotina",
            status: "keystone",
            type: "Tree",
          },
          {
            id: "p5",
            commonName: "Eastern Redbud",
            scientificName: "Cercis canadensis",
            status: "native",
            type: "Tree",
          },
        ],
      },
    ],
    published: true,
    publishedAt: "2026-05-10T14:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "pilot-princeton-meadow",
    ownerId: "pilot-system-2",
    yardName: "Princeton Meadow & Woodland Edge",
    gardenerAlias: "David & Maya K.",
    townOrCounty: "Princeton, Mercer County",
    county: "Mercer",
    zip: "08540",
    coverPhotoUrl: "/samples/mixed-garden-starting-v4.png",
    score: 87,
    rawScore: 87,
    tier: "High habitat value",
    nativeSpeciesCount: 14,
    keystoneCount: 3,
    invasiveCount: 0,
    totalPlantsSurveyed: 18,
    badges: [
      {
        id: "keystone-champion",
        label: "Keystone Champion",
        icon: "🏆",
        description: "Established native oak and goldenrod clusters.",
      },
      {
        id: "canopy-restorer",
        label: "Canopy Restorer",
        icon: "🌳",
        description: "Preserved mature native tree canopy.",
      },
      {
        id: "bee-haven",
        label: "Specialist Bee Haven",
        icon: "🐝",
        description: "Diverse asters and native legumes for solitary bees.",
      },
    ],
    areas: [
      {
        id: "area-meadow",
        name: "Pocket Meadow",
        photoUrl: "/samples/mixed-garden-starting-v4.png",
        plants: [
          {
            id: "pm1",
            commonName: "Wrinkle-leaf Goldenrod",
            scientificName: "Solidago rugosa",
            status: "keystone",
            type: "Perennial",
          },
          {
            id: "pm2",
            commonName: "New England Aster",
            scientificName: "Symphyotrichum novae-angliae",
            status: "keystone",
            type: "Perennial",
          },
          {
            id: "pm3",
            commonName: "Little Bluestem",
            scientificName: "Schizachyrium scoparium",
            status: "native",
            type: "Graminoid",
          },
        ],
      },
    ],
    published: true,
    publishedAt: "2026-05-18T16:30:00.000Z",
    updatedAt: "2026-06-05T12:00:00.000Z",
  },
  {
    id: "pilot-montclair-songbird",
    ownerId: "pilot-system-3",
    yardName: "Montclair Songbird Haven",
    gardenerAlias: "Elena R.",
    townOrCounty: "Montclair, Essex County",
    county: "Essex",
    zip: "07042",
    coverPhotoUrl: "/samples/mixed-garden-starting-v4.png",
    score: 82,
    rawScore: 82,
    tier: "High habitat value",
    nativeSpeciesCount: 11,
    keystoneCount: 2,
    invasiveCount: 0,
    totalPlantsSurveyed: 15,
    badges: [
      {
        id: "canopy-restorer",
        label: "Canopy Restorer",
        icon: "🌳",
        description: "Native dogwood and serviceberry berry canopy.",
      },
      {
        id: "bee-haven",
        label: "Specialist Bee Haven",
        icon: "🐝",
        description: "Early spring ephemerals and summersweet shrubs.",
      },
    ],
    areas: [
      {
        id: "area-back",
        name: "Backyard Shrub Sanctuary",
        photoUrl: "/samples/mixed-garden-starting-v4.png",
        plants: [
          {
            id: "ms1",
            commonName: "Downy Serviceberry",
            scientificName: "Amelanchier arborea",
            status: "native",
            type: "Tree",
          },
          {
            id: "ms2",
            commonName: "Summersweet",
            scientificName: "Clethra alnifolia",
            status: "native",
            type: "Shrub",
          },
          {
            id: "ms3",
            commonName: "Flowering Dogwood",
            scientificName: "Cornus florida",
            status: "native",
            type: "Tree",
          },
        ],
      },
    ],
    published: true,
    publishedAt: "2026-06-01T09:00:00.000Z",
    updatedAt: "2026-06-15T15:00:00.000Z",
  },
  {
    id: "pilot-ridgewood-pocket",
    ownerId: "pilot-system-4",
    yardName: "Ridgewood Suburban Rewilding",
    gardenerAlias: "Marcus T.",
    townOrCounty: "Ridgewood, Bergen County",
    county: "Bergen",
    zip: "07450",
    coverPhotoUrl: "/samples/mixed-garden-starting-v4.png",
    score: 76,
    rawScore: 76,
    tier: "Medium habitat value",
    nativeSpeciesCount: 9,
    keystoneCount: 2,
    invasiveCount: 0,
    totalPlantsSurveyed: 14,
    badges: [
      {
        id: "native-pioneer",
        label: "Native Pioneer",
        icon: "🌿",
        description: "Replaced 50% of turf lawn with native border planting.",
      },
      {
        id: "keystone-champion",
        label: "Keystone Champion",
        icon: "🏆",
        description: "Planted swamp white oak and buttonbush.",
      },
    ],
    areas: [
      {
        id: "area-lawn-swap",
        name: "South Lawn Native Swap",
        photoUrl: "/samples/mixed-garden-starting-v4.png",
        plants: [
          {
            id: "rw1",
            commonName: "Swamp Milkweed",
            scientificName: "Asclepias incarnata",
            status: "native",
            type: "Perennial",
          },
          {
            id: "rw2",
            commonName: "Buttonbush",
            scientificName: "Cephalanthus occidentalis",
            status: "native",
            type: "Shrub",
          },
        ],
      },
    ],
    published: true,
    publishedAt: "2026-06-08T11:00:00.000Z",
    updatedAt: "2026-06-20T18:00:00.000Z",
  },
  {
    id: "pilot-cape-may-dune",
    ownerId: "pilot-system-5",
    yardName: "Cape May Coastal Habitat",
    gardenerAlias: "Coastal Garden Club",
    townOrCounty: "Cape May, Cape May County",
    county: "Cape May",
    zip: "08204",
    coverPhotoUrl: "/samples/mixed-garden-starting-v4.png",
    score: 72,
    rawScore: 72,
    tier: "Medium habitat value",
    nativeSpeciesCount: 8,
    keystoneCount: 1,
    invasiveCount: 0,
    totalPlantsSurveyed: 12,
    badges: [
      {
        id: "native-pioneer",
        label: "Native Pioneer",
        icon: "🌿",
        description: "Salt-tolerant native coastal plantings.",
      },
      {
        id: "bee-haven",
        label: "Specialist Bee Haven",
        icon: "🐝",
        description: "Late season coastal goldenrods.",
      },
    ],
    areas: [
      {
        id: "area-coastal",
        name: "Dune Border",
        photoUrl: "/samples/mixed-garden-starting-v4.png",
        plants: [
          {
            id: "cm1",
            commonName: "Seaside Goldenrod",
            scientificName: "Solidago sempervirens",
            status: "keystone",
            type: "Perennial",
          },
          {
            id: "cm2",
            commonName: "Northern Bayberry",
            scientificName: "Morella pensylvanica",
            status: "native",
            type: "Shrub",
          },
        ],
      },
    ],
    published: true,
    publishedAt: "2026-06-12T14:15:00.000Z",
    updatedAt: "2026-06-22T19:00:00.000Z",
  },
];

/**
 * Fetch all published yards from Firestore (plus starter pilot yards)
 */
export async function getLeaderboardYards(options?: {
  county?: string;
  sortBy?: LeaderboardSortBy;
  search?: string;
}): Promise<PublicYard[]> {
  let yards: PublicYard[] = [];

  if (isFirebaseConfigured()) {
    const firestore = getFirebaseDb();
    if (firestore) {
      try {
        const q = query(
          collection(firestore, "public_yards"),
          where("published", "==", true)
        );
        const snap = await getDocs(q);
        yards = snap.docs.map((d) => d.data() as PublicYard);
      } catch (err) {
        console.warn("Could not query Firestore public_yards:", err);
      }
    }
  }

  // Deduplicate and merge with pilot sample yards so there is always a rich community view
  const map = new Map<string, PublicYard>();
  for (const py of PILOT_SAMPLE_YARDS) {
    map.set(py.id, py);
  }
  for (const y of yards) {
    if (y.published) {
      map.set(y.id, y);
    } else {
      map.delete(y.id);
    }
  }

  let results = Array.from(map.values());

  // Filter by County if selected
  if (options?.county && options.county !== "all") {
    const targetCounty = options.county.toLowerCase().trim();
    results = results.filter(
      (y) =>
        y.county?.toLowerCase().includes(targetCounty) ||
        y.townOrCounty.toLowerCase().includes(targetCounty)
    );
  }

  // Filter by Search term if provided
  if (options?.search) {
    const term = options.search.toLowerCase().trim();
    results = results.filter(
      (y) =>
        y.yardName.toLowerCase().includes(term) ||
        y.gardenerAlias.toLowerCase().includes(term) ||
        y.townOrCounty.toLowerCase().includes(term) ||
        y.areas.some((a) =>
          a.plants.some(
            (p) =>
              p.commonName.toLowerCase().includes(term) ||
              p.scientificName.toLowerCase().includes(term)
          )
        )
    );
  }

  // Sort by chosen metric
  const sortBy = options?.sortBy || "score";
  if (sortBy === "species") {
    results.sort((a, b) => b.nativeSpeciesCount - a.nativeSpeciesCount || b.score - a.score);
  } else if (sortBy === "keystone") {
    results.sort((a, b) => b.keystoneCount - a.keystoneCount || b.score - a.score);
  } else {
    // default score
    results.sort((a, b) => b.score - a.score || b.nativeSpeciesCount - a.nativeSpeciesCount);
  }

  return results;
}

/**
 * Fetch a single public yard for read-only showcase
 */
export async function getPublicYard(id: string): Promise<PublicYard | null> {
  if (isFirebaseConfigured()) {
    const firestore = getFirebaseDb();
    if (firestore) {
      try {
        const snap = await getDoc(doc(firestore, "public_yards", id));
        if (snap.exists()) {
          const data = snap.data() as PublicYard;
          if (data.published) return data;
        }
      } catch (err) {
        console.warn("Could not fetch public yard:", err);
      }
    }
  }

  // Check pilot sample yards fallback
  const foundPilot = PILOT_SAMPLE_YARDS.find((p) => p.id === id);
  if (foundPilot && foundPilot.published) return foundPilot;

  return null;
}

/**
 * Publish or update a user's yard to the leaderboard
 */
export async function publishYardToLeaderboard(
  property: Property,
  surveys: Survey[],
  user: { id?: string; uid?: string; displayName?: string | null; email?: string | null; [key: string]: any },
  gardenerAlias?: string
): Promise<PublicYard> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured.");
  }
  const firestore = getFirebaseDb();
  if (!firestore) throw new Error("Firestore is not available.");

  const { townOrCounty, county } = formatTownOrCounty(property.zip, property.address);
  const metrics = computeYardMetrics(surveys, property.yard_areas);

  const userId = user.id || user.uid || "";
  const nameFromMetadata = user.user_metadata?.full_name || user.user_metadata?.name || user.displayName;

  const finalAlias =
    gardenerAlias?.trim() ||
    nameFromMetadata ||
    (user.email ? user.email.split("@")[0] : "") ||
    "NJ Native Gardener";

  const publicYard: PublicYard = {
    id: property.id,
    ownerId: userId,
    yardName: property.name || "My Native Yard",
    gardenerAlias: finalAlias,
    townOrCounty,
    zip: property.zip || "07000",
    county,
    coverPhotoUrl: metrics.coverPhotoUrl,
    score: metrics.score,
    rawScore: metrics.rawScore,
    tier: metrics.tier,
    nativeSpeciesCount: metrics.nativeSpeciesCount,
    keystoneCount: metrics.keystoneCount,
    invasiveCount: metrics.invasiveCount,
    totalPlantsSurveyed: metrics.totalPlantsSurveyed,
    badges: metrics.badges,
    areas: metrics.areas,
    published: true,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(firestore, "public_yards", property.id), publicYard, { merge: true });
  return publicYard;
}

/**
 * Unpublish a user's yard from the public leaderboard (opt-out)
 */
export async function unpublishYardFromLeaderboard(
  propertyId: string,
  userId: string
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const firestore = getFirebaseDb();
  if (!firestore) return;

  await updateDoc(doc(firestore, "public_yards", propertyId), {
    published: false,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Auto-publish user yards for the pilot phase by default, unless explicitly unpublished
 */
export async function autoPublishPilotYards(
  properties: Property[],
  surveys: Survey[],
  user: { id?: string; uid?: string; displayName?: string | null; email?: string | null; [key: string]: any }
): Promise<void> {
  if (!isFirebaseConfigured() || !user || properties.length === 0) return;
  const firestore = getFirebaseDb();
  if (!firestore) return;

  for (const property of properties) {
    const propSurveys = surveys.filter((s) =>
      property.yard_areas.some((a) => a.id === s.areaId)
    );
    if (propSurveys.length === 0) continue;

    try {
      const snap = await getDoc(doc(firestore, "public_yards", property.id));
      if (!snap.exists()) {
        // Publish by default for the pilot phase as requested
        await publishYardToLeaderboard(property, propSurveys, user);
      }
    } catch {
      // Ignore background auto-publish errors silently
    }
  }
}
