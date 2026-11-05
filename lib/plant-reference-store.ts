import dataset from "../data/reference-photos.downloaded.v1.json";
import type { ReferencePhoto } from "./survey";

export type StoredReferencePhoto = ReferencePhoto & {
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailSha256: string;
  requestedTaxon: string;
  sourceTaxon: string;
  wikidataId: string;
  wikidataUrl: string;
  matchRule: string;
  aliasSource?: string;
  originalUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  sha256: string;
  modified: string;
  checkedOn: string;
  organ?: string;
  organEvidence?: string;
  sourceAuthor?: string;
};
const records = dataset.records as Record<string, StoredReferencePhoto[]>;
const normalize = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();
const byName = new Map(
  Object.entries(records).map(([name, photos]) => [normalize(name), photos]),
);
export const REFERENCE_STORE_VERSION = dataset.version;
/** Exact whole-taxon keys only; image retrieval never truncates a taxon to its genus. */
export function storedReferencePhotos(
  scientificName: string,
): StoredReferencePhoto[] {
  return (byName.get(normalize(scientificName)) || []).map((photo) => ({
    ...photo,
  }));
}
