export type PlantStatus = "keystone" | "native" | "non-native" | "invasive";

export type PlantType =
  | "Tree"
  | "Shrub"
  | "Perennial"
  | "Groundcover"
  | "Vine"
  | "Grass"
  | "Fern"
  | "Annual"
  | "Herb"
  | "Unknown";

export type PlantHorticulture = {
  source: {
    label: string;
    url: string;
    checkedOn: string;
    sha256: string;
    scope: string;
  };
  sourceTaxon: string;
  requestedTaxon?: string;
  taxonScope: "genus" | "species-or-hybrid";
  attributes: Record<string, string[]>;
};

export type NjPlantStatus =
  | "NATIVE_KEYSTONE"
  | "NATIVE"
  | "NON_NATIVE_BENIGN"
  | "INVASIVE_REGULATED"
  | "INVASIVE_WATCHLIST";

export type NjGrowthHabit =
  | "CANOPY_TREE"
  | "UNDERSTORY_TREE"
  | "SHRUB"
  | "PERENNIAL_FORB"
  | "GRAMINOID"
  | "VINE"
  | "GROUNDCOVER"
  | "FERN";

export type NjDeerResistance = "HIGH" | "MODERATE" | "LOW";

export type NjLight = "FULL_SUN" | "PART_SHADE" | "FULL_SHADE";
export type NjMoisture = "DRY" | "MEDIUM" | "WET";

export type NjOrnamentalFeature =
  | "RED_FALL_FOLIAGE"
  | "WINTER_BERRIES"
  | "FRAGRANT"
  | "EVERGREEN"
  | "SHOWY_BLOOMS";

export type RemovalProtocol = {
  method: string;
  timing: string;
  safety: string;
  disposal: string;
};

export type Plant = {
  apiOnly?: boolean;
  referenceVersion?: string;
  referenceExpiresAt?: string;
  referenceIdentity?: { provider: string; taxonId?: string; scientificName: string };
  referenceDetails?: { facts: Record<string, string[]>; source: { label: string; url: string; checkedOn: string } };
  referenceSource?: { label: string; url: string; checkedOn: string };
  referencePhoto?: { url: string; attribution: string; license: string; sourceUrl: string };
  id: string;
  commonName: string;
  scientificName: string;
  status: PlantStatus;
  type: PlantType;
  sun: string;
  moisture: string;
  bloom: string;
  height: string;
  description: string;
  lepidoptera?: number;
  swapIds?: string[];
  removal?: RemovalProtocol;
  // NJ-specific fields from the local flora snapshot.
  njStatus?: NjPlantStatus;
  njStatusLabel?: string;
  growthHabit?: NjGrowthHabit;
  deerResistance?: NjDeerResistance;
  specialistBeeSupport?: boolean;
  bloomMonths?: number[];
  matureHeightFt?: [number, number];
  ornamentalFeatures?: NjOrnamentalFeature[];
  horticulture?: PlantHorticulture;
  landscapeContext?: {
    note: string;
    source: PlantHorticulture["source"];
    recommendation: "site-conditioned" | "recognition-only";
    gardenSettings: string[];
  };
  sourceCautions?: {
    facts: Record<string, string[]>;
    source: PlantHorticulture["source"];
    reviewStatus: "site-context-reviewed" | "garden-context-pending";
  };
  providerCoverage?: {
    provider: "PlantNet";
    project: string;
    taxonId: string;
    scientificName: string;
    checkedOn: string;
    matchRule: string;
    inventorySha256: string;
  };
  njEvidence?: {
    checkedOn: string;
    native: boolean | null;
    invasiveStatus?: string;
    legalListed: boolean;
    doNotPlant: boolean;
    ecoregions: string[];
    sources: { label: string; url: string }[];
    note: string;
    assessmentStatus?: PlantStatus | "unverified";
    originStatus?: "NJ native" | "introduced" | "mixed origin" | "unresolved";
    floraOriginCode?: string;
    watchStatus?: string;
    keystoneScope?: string;
    taxonConflict?: boolean;
  };
};

export type Detection = {
  id: string;
  plantId: string;
  confidence: number;
  box: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  areaSqFt?: number;
  note?: string;
  needsReview?: boolean;
  plantPart?: string;
  topMatches?: VisionMatch[];
  /** Optional normalized polygon: [[x,y], ...] with values from 0 to 1. */
  polygon?: Array<[number, number]>;
};

export type VisionMatch = {
  scientificName: string;
  commonName?: string;
  confidence: number;
  plantId?: string;
};

export type Region = {
  zip: string;
  zone: string;
  ecoregion: string;
  ecoregionCode: string;
  city: string;
  state: string;
  county?: string;
  province?: string;
  soilPh?: string;
  isNj?: boolean;
  isEstimate?: boolean;
  notice?: string;
};

export type ScoreMetric = {
  label: string;
  value: string;
  hint: string;
  tone: "good" | "warn" | "bad" | "neutral";
};

export type SwapRecommendation = {
  id: string;
  fromPlantId: string;
  toPlantIds: string[];
  priority: "high" | "medium" | "low";
  areaSqFt: number;
  headline: string;
  ecoGain: string;
  effort: string;
  season: string;
};

export type AuditImage = {
  width: number;
  height: number;
};

export type Audit = {
  id: string;
  demoMode: boolean;
  createdAt: string;
  location: Region;
  detections: Detection[];
  score: number;
  scoreLabel: string;
  metrics: ScoreMetric[];
  summary: string;
  hostGenera: number;
  nativeShare: number;
  invasiveShare: number;
  swaps: SwapRecommendation[];
  notice?: string;
  image?: AuditImage;
  source?: "sample" | "upload";
  dataVersion?: string;
  /** Count of detections below the 75% confidence review threshold. */
  reviewCount?: number;
};

export type VisionDetection = {
  scientificName: string;
  commonName?: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  note?: string;
  isPlant?: boolean;
  plantPart?: string;
  topMatches?: VisionMatch[];
  polygon?: Array<[number, number]>;
};

export type NjPlantRecord = {
  id: string;
  legacyPlantId: string;
  scientificName: string;
  commonName: string;
  status: PlantStatus;
  njStatus: NjPlantStatus;
  type: PlantType;
  growthHabit: NjGrowthHabit;
  sun: string;
  lightRange: NjLight[];
  moisture: string;
  moistureRange: NjMoisture[];
  bloom: string;
  bloomMonths: number[];
  height: string;
  matureHeightFt: [number, number];
  lepidoptera: number;
  lepidopteraCount: number;
  specialistBeeSupport: boolean;
  deerResistance: NjDeerResistance;
  ornamentalFeatures: NjOrnamentalFeature[];
  description: string;
  removalProtocolId?: string;
};

export type NjRemovalProtocol = RemovalProtocol & {
  id: string;
  plantId: string;
};

export type NjReplacement = {
  mappingId: string;
  targetPlantId: string;
  substitutePlantId: string;
  matchReason: string;
  removalProtocolId: string | null;
  priority: "high" | "medium";
  isPrimary: boolean;
};

export type NjRegionRecord = {
  zip: string;
  city: string;
  county: string;
  province: string;
  zone: string;
  ecoregion: string;
  ecoregionCode: string;
  soilPh: string;
  state: string;
  isNj: boolean;
  isEstimate: boolean;
};

export type NjCounty = {
  name: string;
  province: string;
  zone: string;
  ecoregion: string;
  ecoregionCode: string;
  soilPh: string;
};

export type NjNursery = {
  id: string;
  name: string;
  county: string;
  location: string;
  note: string;
  url: string;
  lastVerified: string;
};

export type NjSynonym = {
  synonym: string;
  acceptedPlantId: string;
};

export type NjDataset = {
  meta: {
    version: string;
    generatedAt: string;
    locale: string;
    ecoregion: string;
    sources: string[];
    notes: string;
  };
  plants: NjPlantRecord[];
  removalProtocols: NjRemovalProtocol[];
  replacements: NjReplacement[];
  regions: NjRegionRecord[];
  counties: NjCounty[];
  nurseries: NjNursery[];
  synonyms: NjSynonym[];
};
