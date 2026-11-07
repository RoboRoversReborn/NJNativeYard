import type { Survey, SurveyPlant } from "./survey";
import { summary } from "./survey";
import { regionForZip } from "./nj-data";
import type { LeaderboardBadge, PublicYardArea, PublicYardPlant } from "./leaderboard-types";
import { KEYSTONE_GENERA } from "./recognition/njPlants";

export function formatTownOrCounty(zip?: string, address?: string): { townOrCounty: string; county: string } {
  if (!zip) return { townOrCounty: "New Jersey", county: "New Jersey" };
  const region = regionForZip(zip);
  const county = region.county && region.county !== "New Jersey" ? region.county : "New Jersey";
  const city = region.city && region.city !== "New Jersey" && region.city !== "Outside New Jersey" ? region.city : "";
  
  if (city && county !== "New Jersey") {
    return { townOrCounty: `${city}, ${county} County`, county };
  }
  if (county !== "New Jersey") {
    return { townOrCounty: `${county} County`, county };
  }
  return { townOrCounty: "New Jersey", county: "New Jersey" };
}

export function computeYardMetrics(
  surveys: Survey[],
  propertyAreas: Array<{ id: string; name: string }> = []
): {
  score: number;
  rawScore: number | null;
  tier: string;
  nativeSpeciesCount: number;
  keystoneCount: number;
  invasiveCount: number;
  totalPlantsSurveyed: number;
  badges: LeaderboardBadge[];
  areas: PublicYardArea[];
  coverPhotoUrl?: string;
} {
  if (!surveys || surveys.length === 0) {
    return {
      score: 0,
      rawScore: null,
      tier: "Early stage / lawn heavy",
      nativeSpeciesCount: 0,
      keystoneCount: 0,
      invasiveCount: 0,
      totalPlantsSurveyed: 0,
      badges: [],
      areas: [],
    };
  }

  // Cover photo: latest non-empty survey photo
  const latestWithPhoto = [...surveys].reverse().find((s) => Boolean(s.photo));
  const coverPhotoUrl = latestWithPhoto?.photo || undefined;

  // Process score from latest survey summary
  const latestSurvey = surveys[surveys.length - 1];
  const stats = summary(latestSurvey);
  const score = stats.score ?? 0;
  const rawScore = stats.rawScore ?? null;
  const tier = stats.grade ?? (score >= 80 ? "High habitat value" : score >= 50 ? "Medium habitat value" : "Early stage / lawn heavy");

  // Track distinct species
  const nativeSpecies = new Set<string>();
  const keystoneSpecies = new Set<string>();
  const invasiveSpecies = new Set<string>();
  let hasTree = false;
  let totalPlants = 0;

  // Group by area
  const areaNameMap = new Map<string, string>();
  for (const pa of propertyAreas) {
    areaNameMap.set(pa.id, pa.name);
  }

  const areaPlantsMap = new Map<string, PublicYardPlant[]>();

  for (const survey of surveys) {
    const areaId = survey.areaId || "main";
    const areaPlants = areaPlantsMap.get(areaId) || [];

    for (const plant of survey.plants || []) {
      totalPlants++;
      const sci = plant.scientificName || plant.suggestion || "";
      const sciLower = sci.toLowerCase().trim();
      const genus = sci.split(" ")[0];
      const isKeystoneGenus = genus in KEYSTONE_GENERA;

      // Status check
      const status = plant.externalProfile?.status || (isKeystoneGenus ? "keystone" : "native");
      if (status === "keystone" || isKeystoneGenus) {
        keystoneSpecies.add(sciLower);
        nativeSpecies.add(sciLower);
      } else if (status === "native") {
        nativeSpecies.add(sciLower);
      } else if (status === "invasive") {
        invasiveSpecies.add(sciLower);
      }

      const plantType = plant.externalProfile?.type || "";
      if (plantType.toLowerCase().includes("tree") || genus.toLowerCase() === "quercus" || genus.toLowerCase() === "acer" || genus.toLowerCase() === "pinus") {
        hasTree = true;
      }

      areaPlants.push({
        id: plant.id || `${areaId}-${areaPlants.length}`,
        commonName: plant.suggestion || plant.candidates?.[0]?.commonName || sci,
        scientificName: sci,
        status: (status as any) || "native",
        type: plantType || undefined,
        photo: (plant.candidates && plant.candidates[0]?.referencePhotos?.[0]?.url) || undefined,
        confidence: plant.confidence,
      });
    }

    areaPlantsMap.set(areaId, areaPlants);
  }

  // Build public yard areas
  const areas: PublicYardArea[] = [];
  for (const [areaId, plants] of areaPlantsMap.entries()) {
    const matchingSurvey = surveys.find((s) => (s.areaId || "main") === areaId && s.photo);
    areas.push({
      id: areaId,
      name: areaNameMap.get(areaId) || "Yard Area",
      photoUrl: matchingSurvey?.photo,
      plants,
    });
  }

  // Calculate Badges
  const badges: LeaderboardBadge[] = [];

  if (keystoneSpecies.size >= 2) {
    badges.push({
      id: "keystone-champion",
      label: "Keystone Champion",
      icon: "🏆",
      description: "Hosts 2+ keystone genera providing critical food web foundation for hundreds of caterpillar species.",
    });
  }

  if (nativeSpecies.size >= 4) {
    badges.push({
      id: "bee-haven",
      label: "Specialist Bee Haven",
      icon: "🐝",
      description: "Features 4+ native flowering species supporting indigenous specialist and solitary bees.",
    });
  }

  if (invasiveSpecies.size === 0 && nativeSpecies.size >= 3) {
    badges.push({
      id: "invasive-free",
      label: "Invasive Free",
      icon: "🛡️",
      description: "Completely cleared of aggressive invasive competition to safeguard local ecology.",
    });
  }

  if (hasTree) {
    badges.push({
      id: "canopy-restorer",
      label: "Canopy Restorer",
      icon: "🌳",
      description: "Maintains native canopy trees that anchor the ecosystem, regulate microclimate, and host songbirds.",
    });
  }

  if (score >= 100) {
    badges.push({
      id: "century-yard",
      label: "Century Habitat",
      icon: "💯",
      description: "Achieved an outstanding 100+ native habitat score through rich diversity and keystone density.",
    });
  } else if (nativeSpecies.size >= 1) {
    badges.push({
      id: "native-pioneer",
      label: "Native Pioneer",
      icon: "🌿",
      description: "Actively transforming a residential lawn into a thriving native sanctuary.",
    });
  }

  return {
    score,
    rawScore,
    tier,
    nativeSpeciesCount: nativeSpecies.size,
    keystoneCount: keystoneSpecies.size,
    invasiveCount: invasiveSpecies.size,
    totalPlantsSurveyed: totalPlants,
    badges,
    areas,
    coverPhotoUrl,
  };
}
