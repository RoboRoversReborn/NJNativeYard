import fs from "node:fs";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { taxonKey, normalizeTaxon } from "../lib/nj-evidence";

const project = "k-world-flora",
  pageSize = 5000;
const endpoint = `https://my-api.plantnet.org/v2/projects/${project}/species`;
const dir = "docs/evidence";
fs.mkdirSync(dir, { recursive: true });
const snapshotPath = `${dir}/plantnet-${project}-inventory.v1.json.gz`;
const sha = (value: string | Buffer) =>
  crypto.createHash("sha256").update(value).digest("hex");
type Species = {
  id: string;
  scientificNameWithoutAuthor: string;
  scientificNameAuthorship?: string;
  gbifId?: number;
  powoId?: string;
};
type Snapshot = {
  provider: string;
  project: string;
  endpoint: string;
  checkedOn: string;
  pagination: {
    pageSize: number;
    pages: { page: number; count: number; sha256: string }[];
  };
  species: Species[];
};
let snapshot: Snapshot;
if (process.argv.includes("--refresh")) {
  const key = process.env.PLANTNET_API_KEY;
  if (!key)
    throw new Error("PLANTNET_API_KEY is required in the host environment");
  const rows: Species[] = [];
  const pages: Snapshot["pagination"]["pages"] = [];
  for (let page = 1; page <= 60; page++) {
    const url = new URL(endpoint);
    url.searchParams.set("api-key", key);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("lang", "en");
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    } catch {
      throw new Error(
        `PlantNet inventory page ${page} was unavailable; credential URL omitted`,
      );
    }
    if (!response.ok)
      throw new Error(
        `PlantNet inventory unavailable: HTTP ${response.status}, page ${page}; no absence is inferred`,
      );
    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`PlantNet returned non-JSON inventory page ${page}`);
    }
    if (!Array.isArray(payload))
      throw new Error("Unexpected PlantNet species inventory response shape");
    for (const row of payload) {
      if (!row.id || typeof row.scientificNameWithoutAuthor !== "string")
        throw new Error(
          "Provider inventory row lacks a taxon ID or scientific name",
        );
      rows.push({
        id: String(row.id),
        scientificNameWithoutAuthor: row.scientificNameWithoutAuthor,
        scientificNameAuthorship: row.scientificNameAuthorship,
        gbifId: row.gbifId,
        powoId: row.powoId,
      });
    }
    pages.push({ page, count: payload.length, sha256: sha(text) });
    console.log(
      JSON.stringify({
        page,
        speciesReceived: payload.length,
        cumulative: rows.length,
      }),
    );
    if (payload.length < pageSize) {
      snapshot = {
        provider: "PlantNet",
        project,
        endpoint,
        checkedOn: "2026-11-04",
        pagination: { pageSize, pages },
        species: rows,
      };
      fs.writeFileSync(
        snapshotPath,
        zlib.gzipSync(JSON.stringify(snapshot), { level: 9 }),
      );
      break;
    }
    if (page === 60)
      throw new Error(
        "Inventory pagination safety limit reached; completeness not established",
      );
  }
} else {
  if (!fs.existsSync(snapshotPath))
    throw new Error(
      "No PlantNet inventory snapshot; use --refresh with the host-held API key",
    );
}
const compressed = fs.readFileSync(snapshotPath);
snapshot = JSON.parse(zlib.gunzipSync(compressed).toString());
if (
  new Set(snapshot.species.map((row) => row.id)).size !==
  snapshot.species.length
)
  throw new Error(
    "Duplicate provider taxon IDs across pages; review pagination before using snapshot",
  );
if (
  new Set(snapshot.pagination.pages.map((page) => page.sha256)).size !==
  snapshot.pagination.pages.length
)
  throw new Error(
    "Repeated provider page hashes; pagination may have been ignored",
  );
const completenessPath = `${dir}/plantnet-inventory-completeness.v1.json`;
let completeness = fs.existsSync(completenessPath)
  ? JSON.parse(fs.readFileSync(completenessPath, "utf8"))
  : null;
if (
  completeness &&
  completeness.inventorySha256 !== sha(compressed) &&
  process.argv.includes("--refresh")
) {
  completeness = null;
  fs.rmSync(completenessPath);
}
if (completeness && completeness.inventorySha256 !== sha(compressed))
  throw new Error(
    "Completeness evidence does not match the current inventory snapshot",
  );
const byName = new Map<string, Species[]>();
for (const row of snapshot.species) {
  const key = taxonKey(row.scientificNameWithoutAuthor);
  byName.set(key, [...(byName.get(key) || []), row]);
}
const opportunity = JSON.parse(
  fs.readFileSync(`${dir}/nj-catalog-opportunity.v1.json`, "utf8"),
) as {
  baselineProfiles: number;
  candidates: {
    alreadyInBaseline: boolean;
    key: string;
    scientificName: string;
    flags: string[];
    careCoreSourceChecked: boolean;
  }[];
};
const candidates = opportunity.candidates.filter(
  (r: { alreadyInBaseline: boolean }) => !r.alreadyInBaseline,
);
const matches = candidates.map(
  (candidate: {
    key: string;
    scientificName: string;
    flags: string[];
    careCoreSourceChecked: boolean;
  }) => {
    const found = byName.get(taxonKey(candidate.scientificName)) || [];
    const unique = [...new Map(found.map((row) => [row.id, row])).values()];
    const status =
      unique.length === 1
        ? "matched"
        : unique.length > 1
          ? "ambiguous"
          : "not-found-in-fetched-project-snapshot";
    const foundName = unique[0]?.scientificNameWithoutAuthor;
    const simple = (name: string) =>
      name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
    const matchRule =
      unique.length !== 1
        ? null
        : simple(foundName) === simple(candidate.scientificName)
          ? "exact case-normalized species name"
          : normalizeTaxon(foundName) ===
              normalizeTaxon(candidate.scientificName)
            ? "hybrid-marker orthographic normalization"
            : "explicit validated whole-taxon alias";
    return {
      requestedScientificName: candidate.scientificName,
      status,
      matchedTaxa: unique,
      matchRule,
      confidence:
        unique.length === 1
          ? {
              level: "high",
              basis:
                "Species-level inventory membership only, not photo-identification confidence",
            }
          : null,
      sourceFlags: candidate.flags,
      careCoreSourceChecked: candidate.careCoreSourceChecked,
    };
  },
);
const report = {
  provider: "PlantNet",
  project,
  endpoint,
  checkedOn: snapshot.checkedOn,
  inventorySnapshot: snapshotPath,
  inventorySha256: sha(compressed),
  inventorySpeciesRows: snapshot.species.length,
  pagination: snapshot.pagination,
  completeness,
  scope:
    "Provider membership in the fetched project inventory, not global API absence, live photo-recognition accuracy, NJ nativity, garden suitability or care-detail verification. A matching completeness artifact records pagination checks when available; a refreshed snapshot requires fresh terminal-page and metadata checks. Temporal atomicity is not established.",
  candidateBaseline: opportunity.baselineProfiles,
  evaluated: matches.length,
  counts: matches.reduce<Record<string, number>>(
    (counts, row) => (
      (counts[row.status] = (counts[row.status] || 0) + 1),
      counts
    ),
    {},
  ),
  notChecked: 0,
  matches,
};
fs.writeFileSync(
  `${dir}/plantnet-nj-candidate-coverage.v1.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    provider: "PlantNet",
    project,
    inventoryRows: snapshot.species.length,
    evaluated: report.evaluated,
    counts: report.counts,
  }),
);
