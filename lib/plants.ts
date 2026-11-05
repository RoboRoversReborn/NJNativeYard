import {
  findPlantCandidates,
  getAllPlants,
  getPlant,
  getPlants,
  getSwapReason,
  NJ_DATA_VERSION,
  regionForZip,
} from "./nj-data";
import type {
  Audit,
  AuditImage,
  Detection,
  NjPlantStatus,
  Plant,
  PlantStatus,
  ScoreMetric,
  SwapRecommendation,
  VisionDetection,
  VisionMatch,
} from "./types";

// Re-export the local NJ data repository so existing UI imports keep working.
export {
  findPlantByScientificName,
  findPlantCandidates,
  getAllPlants,
  getCounty,
  getNurseries,
  getPlant,
  getPlants,
  getReplacements,
  getSwapIds,
  getSwapReason,
  isNjZip,
  NJ_COUNTIES,
  NJ_DATA_META,
  NJ_DATA_VERSION,
  NJ_NURSERIES,
  normalizePlantName,
  regionForZip,
} from "./nj-data";

/**
 * Legacy alias kept for the one-time seed generator and older imports.
 * The NJ snapshot is now the single source of truth.
 */
export const PLANTS: Plant[] = getAllPlants();

export type StatusMeta = {
  label: string;
  short: string;
  action: string;
  description: string;
  color: string;
  soft: string;
  border: string;
};

export const STATUS_META: Record<PlantStatus, StatusMeta> = {
  keystone: {
    label: "NJ keystone native",
    short: "Keystone",
    action: "Preserve & celebrate",
    description:
      "A top-tier New Jersey native that supports a disproportionate share of the local food web.",
    color: "var(--category-keystone)",
    soft: "color-mix(in srgb, var(--category-keystone) 6%, white)",
    border: "var(--category-keystone)",
  },
  native: {
    label: "New Jersey native",
    short: "Native",
    action: "Preserve",
    description:
      "Naturally occurring in New Jersey before European settlement and adapted to local soils and rainfall.",
    color: "var(--category-native)",
    soft: "color-mix(in srgb, var(--category-native) 6%, white)",
    border: "var(--category-native)",
  },
  "non-native": {
    label: "Non-native · low risk",
    short: "Non-native",
    action: "Optional swap",
    description:
      "An introduced ornamental that does not usually spread aggressively in New Jersey, but offers limited food-web value.",
    color: "var(--category-non-native)",
    soft: "color-mix(in srgb, var(--category-non-native) 6%, white)",
    border: "var(--category-non-native)",
  },
  invasive: {
    label: "NJ invasive species",
    short: "Invasive",
    action: "Prioritize removal",
    description:
      "A regulated or watchlist invasive that displaces native New Jersey flora and degrades habitat.",
    color: "var(--category-invasive)",
    soft: "color-mix(in srgb, var(--category-invasive) 6%, white)",
    border: "var(--category-invasive)",
  },
};

/**
 * The five statuses required by the NJ specification. Regulated and watchlist
 * invasives are separated because they carry different urgency and legal weight.
 */
export const NJ_STATUS_META: Record<NjPlantStatus, StatusMeta> = {
  NATIVE_KEYSTONE: {
    label: "NJ keystone native",
    short: "Keystone",
    action: "Preserve & celebrate",
    description:
      "One of New Jersey's highest-value natives, supporting a disproportionate share of caterpillars, bees, and birds.",
    color: "var(--category-keystone)",
    soft: "color-mix(in srgb, var(--category-keystone) 6%, white)",
    border: "var(--category-keystone)",
  },
  NATIVE: {
    label: "New Jersey native",
    short: "Native",
    action: "Preserve",
    description:
      "Naturally occurring in New Jersey before European settlement and adapted to local soils and rainfall.",
    color: "var(--category-native)",
    soft: "color-mix(in srgb, var(--category-native) 6%, white)",
    border: "var(--category-native)",
  },
  NON_NATIVE_BENIGN: {
    label: "Non-native · low risk",
    short: "Non-native",
    action: "Optional swap",
    description:
      "An introduced ornamental that is not currently listed as invasive in New Jersey, but adds little to the local food web.",
    color: "var(--category-non-native)",
    soft: "color-mix(in srgb, var(--category-non-native) 6%, white)",
    border: "var(--category-non-native)",
  },
  INVASIVE_REGULATED: {
    label: "NJ regulated invasive",
    short: "Regulated",
    action: "Prioritize removal",
    description:
      "Listed as invasive or prohibited in New Jersey. Removal is the highest-leverage action for habitat.",
    color: "var(--category-invasive)",
    soft: "color-mix(in srgb, var(--category-invasive) 6%, white)",
    border: "var(--category-invasive)",
  },
  INVASIVE_WATCHLIST: {
    label: "NJ watchlist invasive",
    short: "Watchlist",
    action: "Remove before it spreads",
    description:
      "On New Jersey watchlists for aggressive spread. Remove seed heads and monitor nearby edges.",
    color: "var(--category-invasive)",
    soft: "color-mix(in srgb, var(--category-invasive) 6%, white)",
    border: "var(--category-invasive)",
  },
};

export function getStatusMeta(plant: Pick<Plant, "status" | "njStatus">): StatusMeta {
  return plant.njStatus ? NJ_STATUS_META[plant.njStatus] : STATUS_META[plant.status];
}

export const DEMO_DETECTIONS: Detection[] = [
  {
    id: "det-01",
    plantId: "acer-platanoides",
    confidence: 0.94,
    box: { x: 1.5, y: 1, w: 35, h: 30 },
    areaSqFt: 320,
    note: "Mature canopy over the patio",
  },
  {
    id: "det-02",
    plantId: "acer-palmatum",
    confidence: 0.89,
    box: { x: 13, y: 34, w: 16, h: 22 },
    areaSqFt: 70,
    note: "Burgundy understory tree",
  },
  {
    id: "det-03",
    plantId: "rhododendron-catawbiense",
    confidence: 0.91,
    box: { x: 43, y: 37, w: 17, h: 21 },
    areaSqFt: 45,
    note: "Purple spring bloom",
  },
  {
    id: "det-04",
    plantId: "euonymus-alatus",
    confidence: 0.86,
    box: { x: 79, y: 38, w: 19, h: 25 },
    areaSqFt: 95,
    note: "Dense hedge with bird-dispersed fruit",
  },
  {
    id: "det-05",
    plantId: "berberis-thunbergii",
    confidence: 0.82,
    box: { x: 15, y: 53, w: 14, h: 15 },
    areaSqFt: 30,
    note: "Thorny hedge row",
  },
  {
    id: "det-06",
    plantId: "hedera-helix",
    confidence: 0.95,
    box: { x: 0, y: 64, w: 24, h: 29 },
    areaSqFt: 200,
    note: "Groundcover mat under the border",
  },
  {
    id: "det-07",
    plantId: "hemerocallis-fulva",
    confidence: 0.72,
    box: { x: 29, y: 62, w: 17, h: 18 },
    areaSqFt: 40,
    note: "Strap-like foliage near the steps",
    needsReview: true,
    topMatches: [
      {
        plantId: "hemerocallis-fulva",
        scientificName: "Hemerocallis fulva",
        commonName: "Orange Daylily",
        confidence: 0.72,
      },
      {
        plantId: "iris-pseudacorus",
        scientificName: "Iris pseudacorus",
        commonName: "Yellow Flag Iris",
        confidence: 0.48,
      },
    ],
  },
  {
    id: "det-08",
    plantId: "hosta",
    confidence: 0.84,
    box: { x: 74, y: 69, w: 20, h: 20 },
    areaSqFt: 24,
    note: "Shade perennial clump in a pot",
  },
  {
    id: "det-09",
    plantId: "solidago-rugosa",
    confidence: 0.88,
    box: { x: 47, y: 73, w: 19, h: 17 },
    areaSqFt: 30,
    note: "Late-season nectar patch",
  },
  {
    id: "det-10",
    plantId: "thuja-occidentalis",
    confidence: 0.92,
    box: { x: 92, y: 34, w: 8, h: 34 },
    areaSqFt: 60,
    note: "Evergreen screen at the property edge",
  },
];

export const SWAP_ECO_GAIN: Record<string, string> = {
  "acer-platanoides":
    "White Oak anchors the food web: 500+ caterpillar species, acorns for wildlife, and a 100-year canopy.",
  "euonymus-alatus":
    "Winterberry and highbush blueberry feed pollinators in spring and birds in fall—without bird-dispersed invasions.",
  "hedera-helix":
    "Golden groundsel forms a dense, weed-suppressing native mat and feeds early bees before most perennials wake up.",
  "berberis-thunbergii":
    "Fragrant sumac restores structure, erosion control, and berry forage while removing tick-harboring thickets.",
  "hemerocallis-fulva":
    "Orange coneflower delivers late-summer nectar and seed for goldfinches with far less maintenance.",
  hosta:
    "Foamflower and alumroot bring native groundcover diversity to shade—and support specialist bees.",
  "acer-palmatum":
    "Serviceberry gives you spring blossoms, summer berries, and fall color while hosting 100+ caterpillars.",
  "hydrangea-macrophylla":
    "Oakleaf hydrangea and summersweet deliver native nectar, longer bloom, and better wildlife value.",
  "buxus-sempervirens":
    "Inkberry and wax myrtle make dense evergreen hedges that also feed pollinators and birds.",
  "liriope-muscari":
    "Pennsylvania sedge and green-and-gold give you a soft, shade-tolerant edge without the exotic monoculture.",
  "vinca-minor":
    "Golden groundsel and wild ginger create a native shade carpet that supports early pollinators.",
  "ligustrum-sinense":
    "Winterberry, arrowwood viburnum, and spicebush provide berries, nectar, and caterpillar host leaves.",
  "lonicera-japonica":
    "Trumpet honeysuckle feeds hummingbirds and offers the same twining habit without smothering the forest.",
  "wisteria-sinensis":
    "American wisteria gives you lavender blooms on a better-behaved native vine.",
  "celastrus-orbiculatus":
    "Virginia creeper provides bird fruit and fall color without strangling the canopy.",
  "rosa-multiflora":
    "Carolina rose gives you pink blooms, rose hips, and none of the thuggish spread.",
  "lythrum-salicaria":
    "Great blue lobelia and blue flag iris bring native color and nectar to wet edges.",
  "phragmites-australis":
    "Switchgrass and little bluestem rebuild native structure and bird cover in wet meadows.",
  "microstegium-vimineum":
    "Pennsylvania sedge and little bluestem can reclaim the ground layer from stiltgrass.",
  "alliaria-petiolata":
    "Golden groundsel and green-and-gold fill the shade niche with native early-season flowers.",
  "ailanthus-altissima":
    "White Oak and tulip tree restore a long-lived native canopy and its food web.",
  "elaeagnus-umbellata":
    "Wax myrtle, winterberry, and fragrant sumac provide bird fruit without altering the soil.",
  "euonymus-fortunei":
    "Virginia creeper and wild ginger offer native cover without smothering trees.",
  "iris-pseudacorus":
    "Blue flag iris and great blue lobelia bring native blue blooms to the water's edge.",
  "pueraria-montana":
    "Trumpet honeysuckle gives you a vigorous native vine that stays in bounds with management.",
  "rhamnus-cathartica":
    "Fragrant sumac and arrowwood viburnum restore shrub structure and bird forage.",
  "nandina-domestica":
    "Winterberry and oakleaf hydrangea provide safer berries and native flowers.",
  "mahonia-bealei":
    "Inkberry and fragrant sumac create evergreen structure without bird-dispersed spread.",
  "pyrus-calleryana":
    "Serviceberry and flowering dogwood give you spring bloom, fall color, and caterpillar food.",
  "morus-alba":
    "Black cherry and white oak restore native canopy food webs without hybridizing native mulberry.",
  "ulmus-pumila":
    "White Oak and black gum build a long-lived native canopy with far more ecological value.",
};

export type AuditMeta = {
  image?: AuditImage;
  source?: "sample" | "upload";
  dataVersion?: string;
  id?: string;
  createdAt?: string;
};

const REVIEW_CONFIDENCE = 0.75;
const MIN_BOX_SIDE = 0.035;
const MAX_BOX_AREA = 0.92;
const DEDUPE_IOU = 0.55;

export function buildDemoAudit(rawZip: string, image?: AuditImage): Audit {
  return buildAuditFromDetections(DEMO_DETECTIONS, rawZip, true, undefined, {
    image,
    source: "sample",
    dataVersion: NJ_DATA_VERSION,
  });
}

/**
 * Deterministic sample summary for the landing page. Kept free of Date.now()
 * so it can be prerendered safely under Next.js cache components.
 */
export function buildSamplePreview(rawZip: string): Audit {
  return buildAuditFromDetections(DEMO_DETECTIONS, rawZip, true, undefined, {
    id: "sample-preview",
    createdAt: "2026-11-01T00:00:00.000Z",
    source: "sample",
    dataVersion: NJ_DATA_VERSION,
  });
}

export function buildAuditFromDetections(
  detections: Detection[],
  rawZip: string,
  demoMode: boolean,
  notice?: string,
  meta: AuditMeta = {},
): Audit {
  const location = regionForZip(rawZip);
  const validDetections = detections
    .filter((detection) => Boolean(getPlant(detection.plantId)))
    .map((detection) => ({
      ...detection,
      confidence: clamp(detection.confidence, 0, 1),
      box: clampBox(detection.box),
    }))
    .filter((detection) => detection.box.w >= MIN_BOX_SIDE && detection.box.h >= MIN_BOX_SIDE);

  const plants = validDetections
    .map((detection) => getPlant(detection.plantId))
    .filter((plant): plant is Plant => Boolean(plant));

  const total = plants.length || 1;
  const nativeCount = plants.filter(
    (plant) => plant.status === "native" || plant.status === "keystone",
  ).length;
  const keystoneCount = plants.filter((plant) => plant.status === "keystone").length;
  const invasiveCount = plants.filter((plant) => plant.status === "invasive").length;
  const nativeShare = Math.round((nativeCount / total) * 100);
  const invasiveShare = Math.round((invasiveCount / total) * 100);
  const hostGenera = new Set(
    plants
      .filter((plant) => plant.lepidoptera)
      .map((plant) => plant.scientificName.split(" ")[0]),
  ).size;
  const reviewCount = validDetections.filter(
    (detection) => detection.needsReview || detection.confidence < REVIEW_CONFIDENCE,
  ).length;

  const score = Math.max(
    5,
    Math.min(
      96,
      Math.round(
        nativeShare * 0.45 +
          Math.min(hostGenera, 8) * 2.5 +
          (100 - invasiveShare) * 0.22 +
          keystoneCount * 2.3,
      ),
    ),
  );

  const scoreLabel =
    score >= 80
      ? "Keystone haven"
      : score >= 60
        ? "Habitat builder"
        : score >= 30
          ? "Eco-transitional"
          : score >= 20
            ? "Invasive pressure"
            : "Restoration priority";

  const metrics: ScoreMetric[] = [
    {
      label: "Native flora",
      value: `${nativeShare}%`,
      hint: "Share of detected plants native to this NJ ecoregion",
      tone: nativeShare >= 50 ? "good" : nativeShare >= 30 ? "warn" : "bad",
    },
    {
      label: "Invasive load",
      value: `${invasiveShare}%`,
      hint: "Share of detected plants with high NJ spread risk",
      tone: invasiveShare <= 10 ? "good" : invasiveShare <= 30 ? "warn" : "bad",
    },
    {
      label: "Host genera",
      value: `${hostGenera}`,
      hint: "Caterpillar host genera present in the audit",
      tone: hostGenera >= 4 ? "good" : hostGenera >= 2 ? "warn" : "bad",
    },
    {
      label: "Keystone species",
      value: `${keystoneCount}`,
      hint: "Top-tier food-web plants detected",
      tone: keystoneCount >= 2 ? "good" : keystoneCount === 1 ? "warn" : "bad",
    },
  ];

  const swaps = validDetections
    .map((detection): SwapRecommendation | null => {
      const plant = getPlant(detection.plantId);
      if (!plant || plant.status === "native" || plant.status === "keystone") return null;
      const targets = getPlants(plant.swapIds ?? []).slice(0, 3);
      if (!targets.length) return null;

      const priority: SwapRecommendation["priority"] =
        plant.status === "invasive" ? "high" : "medium";

      return {
        id: `swap-${detection.id}`,
        fromPlantId: plant.id,
        toPlantIds: targets.map((target) => target.id),
        priority,
        areaSqFt: detection.areaSqFt ?? 40,
        headline: `${plant.commonName} → ${targets.map((target) => target.commonName).join(" + ")}`,
        ecoGain:
          getSwapReason(plant.id) ??
          SWAP_ECO_GAIN[plant.id] ??
          `${targets.map((target) => target.commonName).join(" and ")} add native structure, nectar, and caterpillar host value.`,
        effort:
          plant.status === "invasive"
            ? detection.areaSqFt && detection.areaSqFt > 100
              ? "Multi-weekend project"
              : "Weekend project"
            : "Optional weekend swap",
        season: "Plant mid-September–late October",
      } satisfies SwapRecommendation;
    })
    .filter((swap): swap is SwapRecommendation => swap !== null)
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.priority] - rank[b.priority] || b.areaSqFt - a.areaSqFt;
    });

  const summary =
    score < 40
      ? "Your yard is a green island with real ecological value—but invasive woody plants and groundcover are crowding out New Jersey's food web. The fastest wins are removing the highest-spread species and replacing bare mulch or ivy with native groundcover."
      : score < 70
        ? "Your yard is already doing some ecological work. A few targeted swaps can turn it from a pretty garden into a reliable pollinator and caterpillar stopover."
        : "Your yard is a strong habitat anchor. Protect the keystone plants, keep leaves and stems, and add one or two more native layers to support more specialist species.";

  return {
    id: meta.id ?? `audit-${Date.now()}`,
    demoMode,
    createdAt: meta.createdAt ?? new Date().toISOString(),
    location,
    detections: validDetections,
    score,
    scoreLabel,
    metrics,
    summary,
    hostGenera,
    nativeShare,
    invasiveShare,
    swaps,
    notice,
    image: meta.image,
    source: meta.source ?? (demoMode ? "sample" : "upload"),
    dataVersion: meta.dataVersion ?? NJ_DATA_VERSION,
    reviewCount,
  };
}

/**
 * Rebuild an audit in place after the homeowner removes a detection or confirms
 * a low-confidence match. Keeps the same audit id and creation date so the
 * report stays stable.
 */
export function rebuildAudit(audit: Audit, detections: Detection[]): Audit {
  return buildAuditFromDetections(
    detections,
    audit.location.zip,
    audit.demoMode,
    audit.notice,
    {
      image: audit.image,
      source: audit.source,
      dataVersion: audit.dataVersion,
      id: audit.id,
      createdAt: audit.createdAt,
    },
  );
}

export function buildAuditFromVision(
  vision: VisionDetection[],
  rawZip: string,
  meta: AuditMeta = {},
): Audit | null {
  const accepted: Detection[] = [];

  vision.forEach((item, index) => {
    if (item.isPlant === false) return;

    const candidates = dedupePlants([
      ...findPlantCandidates(item.scientificName),
      ...(item.commonName ? findPlantCandidates(item.commonName) : []),
    ]);
    const plant = candidates[0];
    if (!plant) return;

    const confidence = clamp(item.confidence || 0.7, 0, 1);
    const box = normalizeBox(item);
    if (!box) return;
    if (box.w < MIN_BOX_SIDE || box.h < MIN_BOX_SIDE) return;
    if (box.w * box.h > MAX_BOX_AREA) return;

    if (
      accepted.some(
        (detection) =>
          detection.plantId === plant.id && iou(detection.box, box) >= DEDUPE_IOU,
      )
    ) {
      return;
    }

    const topMatches = buildTopMatches(item, candidates, confidence);
    const needsReview = confidence < REVIEW_CONFIDENCE;

    accepted.push({
      id: `vision-${index}-${plant.id}`,
      plantId: plant.id,
      confidence,
      box,
      note: item.note,
      needsReview,
      topMatches: needsReview ? topMatches : undefined,
      polygon: normalizePolygon(item.polygon),
    });
  });

  if (!accepted.length) return null;

  return buildAuditFromDetections(accepted, rawZip, false, undefined, {
    ...meta,
    source: "upload",
  });
}

function buildTopMatches(
  item: VisionDetection,
  candidates: Plant[],
  confidence: number,
): VisionMatch[] {
  const genus = String(item.scientificName ?? "").trim().split(/\s+/)[0];
  const pool = dedupePlants([
    ...candidates,
    ...(genus ? findPlantCandidates(genus) : []),
  ]).slice(0, 3);

  return pool.map((plant, index) => ({
    scientificName: plant.scientificName,
    commonName: plant.commonName,
    confidence:
      index === 0
        ? confidence
        : clamp(confidence * (index === 1 ? 0.72 : 0.55), 0.05, 0.99),
    plantId: plant.id,
  }));
}

function dedupePlants(plants: Plant[]): Plant[] {
  const seen = new Set<string>();
  return plants.filter((plant) => {
    if (seen.has(plant.id)) return false;
    seen.add(plant.id);
    return true;
  });
}

function normalizeBox(item: VisionDetection) {
  const values = [item.x, item.y, item.width, item.height].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;
  let [x, y, w, h] = values;
  x = clamp(x, 0, 1);
  y = clamp(y, 0, 1);
  w = clamp(w, 0, 1);
  h = clamp(h, 0, 1);
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  return {
    x: round(x * 100),
    y: round(y * 100),
    w: round(w * 100),
    h: round(h * 100),
  };
}

function clampBox(box: Detection["box"]): Detection["box"] {
  const x = clamp(Number(box.x) || 0, 0, 100);
  const y = clamp(Number(box.y) || 0, 0, 100);
  const w = clamp(Number(box.w) || 0, 0, 100 - x);
  const h = clamp(Number(box.h) || 0, 0, 100 - y);
  return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

function normalizePolygon(
  polygon?: Array<[number, number]>,
): Array<[number, number]> | undefined {
  if (!Array.isArray(polygon) || polygon.length < 3) return undefined;
  const points = polygon
    .map(([x, y]) => [Number(x), Number(y)] as [number, number])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    .map(([x, y]) => [round(clamp(x, 0, 1) * 100), round(clamp(y, 0, 1) * 100)] as [number, number]);
  return points.length >= 3 ? points : undefined;
}

function iou(a: Detection["box"], b: Detection["box"]) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const overlapW = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const overlapH = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const intersection = overlapW * overlapH;
  const union = a.w * a.h + b.w * b.h - intersection;
  return union > 0 ? intersection / union : 0;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
