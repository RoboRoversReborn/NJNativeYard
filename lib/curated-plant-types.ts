export type PlantOrgan = "leaf" | "flower" | "fruit" | "bark" | "habit" | "seed" | "winter";

export type CuratedPhoto = {
  id: string;
  url: string;
  thumbnailUrl?: string;
  organ?: PlantOrgan;
  author?: string;
  license?: string;
  licenseUrl?: string;
  citation?: string;
  attributionUrl?: string;
  originalUrl?: string;
  source?: string;
  isPrimary?: boolean;
  uploadedAt?: string;
  storagePath?: string;
};

export type CuratedSource = {
  id: string;
  title: string;
  url?: string;
  author?: string;
  notes?: string;
  verifiedAt?: string;
};

export type CuratedReplacement = {
  targetPlantId: string;
  scientificName?: string;
  commonName?: string;
  reason?: string;
  priority?: "high" | "medium" | "low";
  isPrimary?: boolean;
};

export type CuratedRemovalProtocol = {
  id?: string;
  title?: string;
  steps?: string[];
  bestMonths?: number[];
  chemicalFreeAlternative?: string;
};

export type CuratedPlant = {
  id: string;
  scientificName: string;
  commonName: string;
  family?: string;
  status: "keystone" | "native" | "non-native" | "invasive";
  njStatus?: string;
  type?: string;
  growthHabit?: string;
  sun?: string;
  lightRange?: string[];
  moisture?: string;
  moistureRange?: string[];
  soilTypes?: string[];
  bloom?: string;
  bloomMonths?: number[];
  height?: string;
  matureHeightFt?: number[];
  lepidoptera?: number;
  lepidopteraCount?: number;
  specialistBeeSupport?: boolean;
  deerResistance?: string;
  ornamentalFeatures?: string[];
  description?: string;
  photos: CuratedPhoto[];
  sources: CuratedSource[];
  synonyms?: string[];
  suggestedReplacements?: CuratedReplacement[];
  removalProtocol?: CuratedRemovalProtocol;
  createdAt?: string;
  updatedAt?: string;
  lastEditedBy?: {
    uid: string;
    email?: string;
    displayName?: string;
  };
};
