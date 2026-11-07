export interface LeaderboardBadge {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface PublicYardPlant {
  id: string;
  commonName: string;
  scientificName: string;
  status: "keystone" | "native" | "non-native" | "invasive";
  type?: string;
  photo?: string;
  confidence?: number;
}

export interface PublicYardArea {
  id: string;
  name: string;
  photoUrl?: string;
  plants: PublicYardPlant[];
}

export interface PublicYard {
  id: string; // matches propertyId
  ownerId: string;
  yardName: string;
  gardenerAlias: string;
  townOrCounty: string;
  zip: string;
  county?: string;
  coverPhotoUrl?: string;
  score: number;
  rawScore?: number | null;
  tier: string;
  nativeSpeciesCount: number;
  keystoneCount: number;
  invasiveCount: number;
  totalPlantsSurveyed: number;
  badges: LeaderboardBadge[];
  areas: PublicYardArea[];
  published: boolean;
  publishedAt: string;
  updatedAt: string;
}

export type LeaderboardSortBy = "score" | "species" | "keystone";
