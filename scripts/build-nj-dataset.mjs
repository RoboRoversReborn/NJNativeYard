/**
 * One-time seed generator for the local NJ flora snapshot.
 *
 * Source of truth before Phase 1: lib/plants.ts
 * Output: data/nj-flora.v1.json
 *
 * Run with: node scripts/build-nj-dataset.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLANTS, SWAP_ECO_GAIN } from "../lib/plants.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const MONTHS = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const REGULATED_INVASIVES = new Set([
  "acer-platanoides",
  "euonymus-alatus",
  "berberis-thunbergii",
  "hedera-helix",
  "vinca-minor",
  "ligustrum-sinense",
  "lonicera-japonica",
  "wisteria-sinensis",
  "celastrus-orbiculatus",
  "rosa-multiflora",
  "lythrum-salicaria",
  "phragmites-australis",
  "microstegium-vimineum",
  "alliaria-petiolata",
  "ailanthus-altissima",
  "elaeagnus-umbellata",
  "euonymus-fortunei",
  "iris-pseudacorus",
  "pueraria-montana",
  "rhamnus-cathartica",
  "pyrus-calleryana",
]);

const WATCHLIST_INVASIVES = new Set([
  "nandina-domestica",
  "mahonia-bealei",
  "morus-alba",
  "ulmus-pumila",
]);

const HIGH_DEER_RESISTANCE = new Set([
  "athyrium-filix-femina",
  "osmundastrum-cinnamomeum",
  "carex-pensylvanica",
  "panicum-virgatum",
  "schizachyrium-scoparium",
  "lindera-benzoin",
  "clethra-alnifolia",
  "morella-cerifera",
  "ilex-glabra",
  "ilex-verticillata",
  "rhus-aromatica",
  "juniperus-virginiana",
  "asarum-canadense",
  "packera-aurea",
  "chrysogonum-virginianum",
  "monarda-fistulosa",
  "echinacea-purpurea",
  "asclepias-tuberosa",
  "solidago-rugosa",
  "symphyotrichum-novae-angliae",
  "eutrochium-purpureum",
  "zizia-aurea",
  "geranium-maculatum",
  "heuchera-americana",
  "tiarella-cordifolia",
  "pycnanthemum-muticum",
  "fragaria-virginiana",
]);

const LOW_DEER_RESISTANCE = new Set([
  "hosta",
  "hemerocallis-fulva",
  "hydrangea-macrophylla",
  "paeonia-lactiflora",
  "tulipa-gesneriana",
  "liriope-muscari",
  "acer-palmatum",
  "vaccinium-corymbosum",
  "cercis-canadensis",
  "cornus-florida",
  "rosa-carolina",
  "hydrangea-arborescens",
]);

const SPECIALIST_BEE_SUPPORT = new Set([
  "solidago-rugosa",
  "solidago-speciosa",
  "symphyotrichum-novae-angliae",
  "packera-aurea",
  "chrysogonum-virginianum",
  "echinacea-purpurea",
  "monarda-fistulosa",
  "eutrochium-purpureum",
  "zizia-aurea",
  "geranium-maculatum",
  "asclepias-tuberosa",
  "rudbeckia-fulgida",
  "lobelia-siphilitica",
  "pycnanthemum-muticum",
  "physocarpus-opulifolius",
  "vaccinium-corymbosum",
  "vaccinium-angustifolium",
  "ilex-verticillata",
  "ilex-glabra",
  "ceanothus-americanus",
]);

const GROWTH_HABIT_OVERRIDES = {
  "cercis-canadensis": "UNDERSTORY_TREE",
  "cornus-florida": "UNDERSTORY_TREE",
  "amelanchier-canadensis": "UNDERSTORY_TREE",
  "acer-palmatum": "UNDERSTORY_TREE",
  "ilex-opaca": "UNDERSTORY_TREE",
};

const BLOOM_MONTH_OVERRIDES = {
  "quercus-alba": [4, 5],
  "prunus-serotina": [4, 5],
  "solidago-rugosa": [9, 10],
  "solidago-speciosa": [8, 9],
  "acer-rubrum": [3, 4],
  "nyssa-sylvatica": [4, 5],
  "liriodendron-tulipifera": [5, 6],
  "cercis-canadensis": [4, 5],
  "amelanchier-canadensis": [4, 5],
  "cornus-florida": [4, 5],
  "ilex-opaca": [4, 5],
  "juniperus-virginiana": [3, 4],
  "rhododendron-catawbiense": [5, 6],
  "thuja-occidentalis": [3, 4],
  "ilex-verticillata": [5, 6],
  "vaccinium-corymbosum": [4, 5],
  "vaccinium-angustifolium": [4, 5],
  "rhus-aromatica": [4, 5],
  "physocarpus-opulifolius": [5, 6],
  "viburnum-dentatum": [5, 6],
  "lindera-benzoin": [3, 4],
  "clethra-alnifolia": [7, 8],
  "hydrangea-quercifolia": [6, 7],
  "hydrangea-arborescens": [6, 7],
  "morella-cerifera": [4, 5],
  "ilex-glabra": [5, 6],
  "packera-aurea": [4, 5],
  "asarum-canadense": [4, 5],
  "chrysogonum-virginianum": [4, 5],
  "carex-pensylvanica": [5, 6],
  "panicum-virgatum": [8, 9],
  "schizachyrium-scoparium": [8, 9],
  "rudbeckia-fulgida": [7, 9],
  "geranium-maculatum": [4, 5],
  "osmundastrum-cinnamomeum": [],
  "athyrium-filix-femina": [],
  "tiarella-cordifolia": [4, 5],
  "heuchera-americana": [5, 6],
  "lobelia-siphilitica": [8, 9],
  "parthenocissus-quinquefolia": [6, 7],
  "lonicera-sempervirens": [6, 7],
  "wisteria-frutescens": [5, 6],
  "rosa-carolina": [6, 7],
  "iris-versicolor": [5, 6],
  "echinacea-purpurea": [6, 8],
  "asclepias-tuberosa": [6, 8],
  "monarda-fistulosa": [7, 8],
  "symphyotrichum-novae-angliae": [9, 10],
  "eutrochium-purpureum": [7, 9],
  "zizia-aurea": [5, 6],
  "pycnanthemum-muticum": [7, 9],
  "fragaria-virginiana": [4, 5],
  "ceanothus-americanus": [5, 6],
};

const EXTRA_PLANTS = [
  {
    id: "miscanthus-sinensis",
    commonName: "Chinese Silvergrass",
    scientificName: "Miscanthus sinensis",
    status: "invasive",
    njStatus: "INVASIVE_REGULATED",
    type: "Grass",
    growthHabit: "GRAMINOID",
    sun: "Full sun",
    lightRange: ["FULL_SUN"],
    moisture: "Medium",
    moistureRange: ["MEDIUM"],
    bloom: "Silver plumes · August–October",
    bloomMonths: [8, 9, 10],
    height: "5–8 ft",
    matureHeightFt: [5, 8],
    lepidoptera: 0,
    specialistBeeSupport: false,
    deerResistance: "HIGH",
    ornamentalFeatures: ["SHOWY_BLOOMS"],
    description:
      "A popular ornamental grass that seeds into meadows and roadsides, forming dense stands that crowd out native warm-season grasses.",
    swapIds: ["panicum-virgatum", "schizachyrium-scoparium"],
    removal: {
      method:
        "Dig out the entire clump before seed heads mature. Remove the crown and root mass; bag seed-bearing stems.",
      timing: "Late summer before seed set, or early spring.",
      safety:
        "Wear gloves and eye protection. Avoid disturbing wet soils or steep banks.",
      disposal:
        "Bag seed heads and send to municipal yard waste. Do not compost.",
    },
  },
  {
    id: "forsythia-spp",
    commonName: "Forsythia",
    scientificName: "Forsythia spp.",
    status: "non-native",
    njStatus: "NON_NATIVE_BENIGN",
    type: "Shrub",
    growthHabit: "SHRUB",
    sun: "Full sun–part shade",
    lightRange: ["FULL_SUN", "PART_SHADE"],
    moisture: "Medium",
    moistureRange: ["MEDIUM"],
    bloom: "Yellow · March–April",
    bloomMonths: [3, 4],
    height: "6–10 ft",
    matureHeightFt: [6, 10],
    lepidoptera: 0,
    specialistBeeSupport: false,
    deerResistance: "MODERATE",
    ornamentalFeatures: ["SHOWY_BLOOMS"],
    description:
      "An early yellow-flowered shrub with little caterpillar value. Northern spicebush offers the same early-season yellow glow and hosts the spicebush swallowtail.",
    swapIds: ["lindera-benzoin"],
  },
  {
    id: "pachysandra-terminalis",
    commonName: "Japanese Spurge",
    scientificName: "Pachysandra terminalis",
    status: "invasive",
    njStatus: "INVASIVE_WATCHLIST",
    type: "Groundcover",
    growthHabit: "GROUNDCOVER",
    sun: "Part shade–shade",
    lightRange: ["PART_SHADE", "FULL_SHADE"],
    moisture: "Medium",
    moistureRange: ["MEDIUM"],
    bloom: "White · April–May",
    bloomMonths: [4, 5],
    height: "0.5–1 ft",
    matureHeightFt: [0.5, 1],
    lepidoptera: 0,
    specialistBeeSupport: false,
    deerResistance: "HIGH",
    ornamentalFeatures: ["EVERGREEN"],
    description:
      "A shade-tolerant evergreen groundcover that forms a sterile carpet. Native golden ragwort and green-and-gold support early pollinators instead.",
    swapIds: ["packera-aurea", "chrysogonum-virginianum"],
    removal: {
      method:
        "Cut and roll back the mat, then sheet-mulch or hand-pull resprouts. Replant immediately with a native groundcover to suppress reinvasion.",
      timing: "Spring or early fall while soil is workable.",
      safety:
        "Wear gloves. Work in sections and keep roots out of storm drains.",
      disposal:
        "Bag roots and stems. Do not compost or dump near woodlands.",
    },
  },
  {
    id: "lonicera-maackii",
    commonName: "Amur Honeysuckle",
    scientificName: "Lonicera maackii",
    status: "invasive",
    njStatus: "INVASIVE_REGULATED",
    type: "Shrub",
    growthHabit: "SHRUB",
    sun: "Full sun–part shade",
    lightRange: ["FULL_SUN", "PART_SHADE"],
    moisture: "Medium",
    moistureRange: ["MEDIUM"],
    bloom: "White–yellow · May–June",
    bloomMonths: [5, 6],
    height: "6–15 ft",
    matureHeightFt: [6, 15],
    lepidoptera: 0,
    specialistBeeSupport: false,
    deerResistance: "LOW",
    ornamentalFeatures: ["FRAGRANT", "WINTER_BERRIES"],
    description:
      "A shade-tolerant shrub that leafs out early and holds leaves late, suppressing native understory plants and spreading bird-dispersed fruit.",
    swapIds: ["lindera-benzoin", "viburnum-dentatum"],
    removal: {
      method:
        "Cut-stump treatment or pull seedlings when soil is moist. Remove root crowns and bag fruit-bearing branches.",
      timing: "Late summer to early fall, before fruit ripens.",
      safety:
        "Wear gloves and eye protection. Treat cut stumps according to local guidance.",
      disposal:
        "Bag fruit and roots. Do not compost or leave cut stems on site.",
    },
  },
  {
    id: "fragaria-virginiana",
    commonName: "Wild Strawberry",
    scientificName: "Fragaria virginiana",
    status: "native",
    njStatus: "NATIVE",
    type: "Groundcover",
    growthHabit: "GROUNDCOVER",
    sun: "Full sun–part shade",
    lightRange: ["FULL_SUN", "PART_SHADE"],
    moisture: "Medium",
    moistureRange: ["DRY", "MEDIUM"],
    bloom: "White · April–May",
    bloomMonths: [4, 5],
    height: "0.5–1 ft",
    matureHeightFt: [0.5, 1],
    lepidoptera: 30,
    specialistBeeSupport: true,
    deerResistance: "HIGH",
    ornamentalFeatures: ["WINTER_BERRIES"],
    description:
      "A low, fast-spreading native groundcover with spring flowers and small edible fruit. It supports early bees and birds.",
    swapIds: [],
  },
  {
    id: "ceanothus-americanus",
    commonName: "New Jersey Tea",
    scientificName: "Ceanothus americanus",
    status: "native",
    njStatus: "NATIVE",
    type: "Shrub",
    growthHabit: "SHRUB",
    sun: "Full sun",
    lightRange: ["FULL_SUN"],
    moisture: "Medium–dry",
    moistureRange: ["DRY", "MEDIUM"],
    bloom: "White · May–June",
    bloomMonths: [5, 6],
    height: "2–3 ft",
    matureHeightFt: [2, 3],
    lepidoptera: 45,
    specialistBeeSupport: true,
    deerResistance: "HIGH",
    ornamentalFeatures: ["SHOWY_BLOOMS"],
    description:
      "A compact native shrub with frothy white flowers that feed bees and beneficial insects. It is a strong replacement for barberry in sunny beds.",
    swapIds: [],
  },
  {
    id: "hydrangea-arborescens",
    commonName: "Smooth Hydrangea",
    scientificName: "Hydrangea arborescens",
    status: "native",
    njStatus: "NATIVE",
    type: "Shrub",
    growthHabit: "SHRUB",
    sun: "Part shade",
    lightRange: ["PART_SHADE", "FULL_SHADE"],
    moisture: "Medium",
    moistureRange: ["MEDIUM", "WET"],
    bloom: "White · June–July",
    bloomMonths: [6, 7],
    height: "3–5 ft",
    matureHeightFt: [3, 5],
    lepidoptera: 20,
    specialistBeeSupport: false,
    deerResistance: "LOW",
    ornamentalFeatures: ["SHOWY_BLOOMS"],
    description:
      "A native hydrangea with white flower clusters and good shade tolerance. It offers more pollinator value than bigleaf hydrangea.",
    swapIds: [],
  },
  {
    id: "solidago-speciosa",
    commonName: "Showy Goldenrod",
    scientificName: "Solidago speciosa",
    status: "keystone",
    njStatus: "NATIVE_KEYSTONE",
    type: "Perennial",
    growthHabit: "PERENNIAL_FORB",
    sun: "Full sun",
    lightRange: ["FULL_SUN"],
    moisture: "Medium–dry",
    moistureRange: ["DRY", "MEDIUM"],
    bloom: "Golden yellow · August–September",
    bloomMonths: [8, 9],
    height: "2–4 ft",
    matureHeightFt: [2, 4],
    lepidoptera: 100,
    specialistBeeSupport: true,
    deerResistance: "HIGH",
    ornamentalFeatures: ["SHOWY_BLOOMS"],
    description:
      "A clump-forming goldenrod with showy plumes that feed late-season bees, butterflies, and migrating monarchs.",
    swapIds: [],
  },
  {
    id: "pycnanthemum-muticum",
    commonName: "Mountain Mint",
    scientificName: "Pycnanthemum muticum",
    status: "native",
    njStatus: "NATIVE",
    type: "Perennial",
    growthHabit: "PERENNIAL_FORB",
    sun: "Full sun–part shade",
    lightRange: ["FULL_SUN", "PART_SHADE"],
    moisture: "Medium",
    moistureRange: ["MEDIUM", "WET"],
    bloom: "White–pale purple · July–September",
    bloomMonths: [7, 8, 9],
    height: "2–3 ft",
    matureHeightFt: [2, 3],
    lepidoptera: 20,
    specialistBeeSupport: true,
    deerResistance: "HIGH",
    ornamentalFeatures: ["FRAGRANT", "SHOWY_BLOOMS"],
    description:
      "A pollinator magnet with silvery bracts and a long bloom window. It is deer-resistant and tolerates average to moist soil.",
    swapIds: [],
  },
];

const EXTRA_REPLACEMENTS = [
  {
    targetPlantId: "berberis-thunbergii",
    substitutePlantId: "ceanothus-americanus",
    matchReason:
      "New Jersey tea gives you a compact, sunny shrub with white flowers and pollinator value instead of tick-harboring thickets.",
  },
  {
    targetPlantId: "pachysandra-terminalis",
    substitutePlantId: "fragaria-virginiana",
    matchReason:
      "Wild strawberry forms a low native groundcover with spring flowers and fruit instead of a sterile evergreen mat.",
  },
  {
    targetPlantId: "miscanthus-sinensis",
    substitutePlantId: "panicum-virgatum",
    matchReason:
      "Switchgrass delivers the same upright ornamental plumes and copper fall color without escaping into meadows.",
  },
  {
    targetPlantId: "forsythia-spp",
    substitutePlantId: "lindera-benzoin",
    matchReason:
      "Spicebush gives you the same early yellow spring glow while hosting the spicebush swallowtail.",
  },
];

const REGIONS = [
  ["07645", "Montvale", "Bergen", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07652", "Paramus", "Bergen", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07601", "Hackensack", "Bergen", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07450", "Ridgewood", "Bergen", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07631", "Englewood", "Bergen", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07675", "Westwood", "Bergen", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07030", "Hoboken", "Hudson", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07302", "Jersey City", "Hudson", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07042", "Montclair", "Essex", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07017", "East Orange", "Essex", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07078", "Short Hills", "Essex", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07055", "Passaic", "Passaic", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07501", "Paterson", "Passaic", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07960", "Morristown", "Morris", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07940", "Madison", "Morris", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07901", "Summit", "Union", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07090", "Westfield", "Union", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["08840", "Metuchen", "Middlesex", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["08901", "New Brunswick", "Middlesex", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["08540", "Princeton", "Mercer", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["08550", "Princeton Junction", "Mercer", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["08608", "Trenton", "Mercer", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["08876", "Somerville", "Somerset", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07920", "Basking Ridge", "Somerset", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["07840", "Hackettstown", "Warren", "RIDGE_AND_VALLEY", "6b", "Ridge and Valley", "EPA Level III 67", "Limestone-influenced valley soils"],
  ["07825", "Blairstown", "Warren", "RIDGE_AND_VALLEY", "6a", "Ridge and Valley", "EPA Level III 67", "Limestone-influenced valley soils"],
  ["07801", "Dover", "Morris", "HIGHLANDS", "6b", "Northeastern Highlands", "EPA Level III 58", "Acidic glacial till and rocky loam"],
  ["07419", "Hamburg", "Sussex", "HIGHLANDS", "6a", "Northeastern Highlands", "EPA Level III 58", "Acidic glacial till and rocky loam"],
  ["07460", "Stockholm", "Sussex", "HIGHLANDS", "6a", "Northeastern Highlands", "EPA Level III 58", "Acidic glacial till and rocky loam"],
  ["07701", "Red Bank", "Monmouth", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["07728", "Freehold", "Monmouth", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["07748", "Middletown", "Monmouth", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["08701", "Lakewood", "Ocean", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["08753", "Toms River", "Ocean", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["08527", "Jackson", "Ocean", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["08002", "Cherry Hill", "Camden", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["08043", "Voorhees", "Camden", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["08033", "Haddonfield", "Camden", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["08016", "Burlington", "Burlington", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["08054", "Mount Laurel", "Burlington", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["08053", "Marlton", "Burlington", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["08302", "Bridgeton", "Cumberland", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["08360", "Vineland", "Cumberland", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["08215", "Egg Harbor City", "Atlantic", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["08037", "Hammonton", "Atlantic", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["08202", "Avalon", "Cape May", "COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Sandy barrier island soil"],
  ["08204", "Cape May", "Cape May", "COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Sandy barrier island soil"],
  ["08226", "Ocean City", "Cape May", "COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Sandy barrier island soil"],
];

const COUNTIES = [
  ["Atlantic", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["Bergen", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["Burlington", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["Camden", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["Cape May", "COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Sandy barrier island soil"],
  ["Cumberland", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["Essex", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["Gloucester", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["Hudson", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["Hunterdon", "RIDGE_AND_VALLEY", "6b", "Ridge and Valley", "EPA Level III 67", "Limestone-influenced valley soils"],
  ["Mercer", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["Middlesex", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["Monmouth", "INNER_COASTAL", "7a", "Middle Atlantic Coastal Plain", "EPA Level III 63", "Coastal plain sandy loam"],
  ["Morris", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["Ocean", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["Passaic", "PIEDMONT", "7a", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["Salem", "OUTER_COASTAL", "7a", "Atlantic Coastal Pine Barrens", "EPA Level III 84", "Acidic sandy Pinelands soil"],
  ["Somerset", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["Sussex", "HIGHLANDS", "6a", "Northeastern Highlands", "EPA Level III 58", "Acidic glacial till and rocky loam"],
  ["Union", "PIEDMONT", "6b", "Northern Piedmont", "EPA Level III 64", "Piedmont clay/shale loam"],
  ["Warren", "RIDGE_AND_VALLEY", "6b", "Ridge and Valley", "EPA Level III 67", "Limestone-influenced valley soils"],
];

const NURSERIES = [
  {
    id: "toadshade",
    name: "Toadshade Wildflower Farm",
    county: "Hunterdon",
    location: "Frenchtown, NJ",
    note: "Native perennials and local-ecotype seed; mail order and nursery visits.",
    url: "https://www.toadshade.com/",
    lastVerified: "2026-11-01",
  },
  {
    id: "wild-ridge",
    name: "Wild Ridge Plants",
    county: "Warren",
    location: "Alpha, NJ",
    note: "Native plants propagated from local seed; restoration and garden sales.",
    url: "https://www.wildridgeplants.com/",
    lastVerified: "2026-11-01",
  },
  {
    id: "pinelands-direct",
    name: "Pinelands Direct",
    county: "Burlington",
    location: "Chatsworth, NJ",
    note: "Pinelands-adapted native plants and landscape guidance.",
    url: "https://www.pinelandsdirect.com/",
    lastVerified: "2026-11-01",
  },
  {
    id: "earth-first",
    name: "Earth First Native Plant Nursery",
    county: "Atlantic",
    location: "Egg Harbor City, NJ",
    note: "Native trees, shrubs, and perennials for South Jersey gardens.",
    url: "https://www.earthfirstnativeplantnursery.com/",
    lastVerified: "2026-11-01",
  },
  {
    id: "npsnj",
    name: "Native Plant Society of New Jersey",
    county: "Statewide",
    location: "Statewide chapter sales",
    note: "Chapter plant sales and native-plant education across New Jersey.",
    url: "https://www.npsnj.org/",
    lastVerified: "2026-11-01",
  },
  {
    id: "bowmans-hill",
    name: "Bowman's Hill Wildflower Preserve",
    county: "Regional",
    location: "New Hope, PA",
    note: "Regional native plant nursery and wildflower preserve near the Delaware.",
    url: "https://bhwp.org/",
    lastVerified: "2026-11-01",
  },
];

const SYNONYMS = [
  ["Aster novae-angliae", "symphyotrichum-novae-angliae"],
  ["Aster novae angliae", "symphyotrichum-novae-angliae"],
  ["Euonymus alata", "euonymus-alatus"],
  ["Euonymus alatus", "euonymus-alatus"],
  ["Hemerocallis fulva", "hemerocallis-fulva"],
  ["Miscanthus sinensis", "miscanthus-sinensis"],
  ["Pachysandra terminalis", "pachysandra-terminalis"],
  ["Lonicera maackii", "lonicera-maackii"],
  ["Forsythia", "forsythia-spp"],
  ["Hydrangea", "hydrangea-arborescens"],
  ["Acer", "acer-rubrum"],
  ["Cornus", "cornus-florida"],
  ["Viburnum", "viburnum-dentatum"],
  ["Ilex", "ilex-verticillata"],
  ["Solidago", "solidago-rugosa"],
  ["Symphyotrichum", "symphyotrichum-novae-angliae"],
];

function parseLight(sun) {
  const value = String(sun).toLowerCase();
  const result = [];
  if (value.includes("full sun")) result.push("FULL_SUN");
  if (value.includes("part shade")) result.push("PART_SHADE");
  if (value.includes("full shade")) result.push("FULL_SHADE");
  if (value.includes("shade") && !value.includes("part shade") && !value.includes("full shade")) {
    result.push("FULL_SHADE");
  }
  return result.length ? [...new Set(result)] : ["FULL_SUN", "PART_SHADE"];
}

function parseMoisture(moisture) {
  const value = String(moisture).toLowerCase();
  const result = [];
  if (value.includes("dry")) result.push("DRY");
  if (value.includes("medium") || value.includes("average")) result.push("MEDIUM");
  if (value.includes("wet") || value.includes("moist")) result.push("WET");
  if (value.includes("adaptable")) return ["DRY", "MEDIUM", "WET"];
  return result.length ? [...new Set(result)] : ["MEDIUM"];
}

function parseHeight(height) {
  const value = String(height).toLowerCase();
  const match = value.match(/(\d+(?:\.\d+)?)\s*(?:–|-|to)\s*(\d+(?:\.\d+)?)\s*(ft|in)/);
  if (match) {
    const min = Number(match[1]) / (match[3] === "in" ? 12 : 1);
    const max = Number(match[2]) / (match[3] === "in" ? 12 : 1);
    return [Number(min.toFixed(2)), Number(max.toFixed(2))];
  }
  const single = value.match(/(\d+(?:\.\d+)?)\s*(ft|in)/);
  if (single) {
    const n = Number(single[1]) / (single[2] === "in" ? 12 : 1);
    return [Number(n.toFixed(2)), Number(n.toFixed(2))];
  }
  return [0, 0];
}

function parseBloomMonths(bloom) {
  const value = String(bloom).toLowerCase();
  const found = [];
  for (const [name, month] of Object.entries(MONTHS)) {
    const re = new RegExp(`\\b${name}\\b`, "g");
    let match;
    while ((match = re.exec(value))) {
      found.push({ month, index: match.index });
    }
  }
  const unique = [...new Map(found.map((item) => [item.month, item])).values()].sort(
    (a, b) => a.index - b.index,
  );
  if (!unique.length) return [];
  if (unique.length === 1) return [unique[0].month];
  const first = unique[0].month;
  const last = unique[unique.length - 1].month;
  if (last >= first) {
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }
  return [first, last];
}

function mapHabit(plant) {
  if (GROWTH_HABIT_OVERRIDES[plant.id]) return GROWTH_HABIT_OVERRIDES[plant.id];
  switch (plant.type) {
    case "Tree":
      return "CANOPY_TREE";
    case "Shrub":
      return "SHRUB";
    case "Perennial":
      return "PERENNIAL_FORB";
    case "Groundcover":
      return "GROUNDCOVER";
    case "Vine":
      return "VINE";
    case "Grass":
      return "GRAMINOID";
    case "Fern":
      return "FERN";
    default:
      return "PERENNIAL_FORB";
  }
}

function mapNjStatus(plant) {
  if (plant.njStatus) return plant.njStatus;
  if (plant.status === "keystone") return "NATIVE_KEYSTONE";
  if (plant.status === "native") return "NATIVE";
  if (plant.status === "non-native") return "NON_NATIVE_BENIGN";
  if (REGULATED_INVASIVES.has(plant.id)) return "INVASIVE_REGULATED";
  if (WATCHLIST_INVASIVES.has(plant.id)) return "INVASIVE_WATCHLIST";
  return "INVASIVE_WATCHLIST";
}

function deriveFeatures(plant) {
  const text = String(plant.description).toLowerCase();
  const features = [];
  if (/fall (color|foliage)|scarlet|burgundy|red fall|crimson/.test(text)) {
    features.push("RED_FALL_FOLIAGE");
  }
  if (/berr|fruit|acorn|drupe/.test(text)) features.push("WINTER_BERRIES");
  if (/fragrant|scent|aromatic/.test(text)) features.push("FRAGRANT");
  if (/evergreen/.test(text)) features.push("EVERGREEN");
  if (/showy|flower|bloom/.test(text)) features.push("SHOWY_BLOOMS");
  return [...new Set(features)];
}

function removalProtocolId(plant) {
  return plant.removal ? `removal-${plant.id}` : undefined;
}

const allPlants = [...PLANTS, ...EXTRA_PLANTS];
const plantIds = new Set(allPlants.map((plant) => plant.id));

const removalProtocols = allPlants
  .filter((plant) => plant.removal)
  .map((plant) => ({
    id: `removal-${plant.id}`,
    plantId: plant.id,
    method: plant.removal.method,
    timing: plant.removal.timing,
    safety: plant.removal.safety,
    disposal: plant.removal.disposal,
  }));

const replacements = [];
for (const plant of allPlants) {
  const swapIds = Array.isArray(plant.swapIds) ? plant.swapIds : [];
  swapIds.forEach((substituteId, index) => {
    if (!plantIds.has(substituteId)) return;
    replacements.push({
      mappingId: `map-${plant.id}-${substituteId}`,
      targetPlantId: plant.id,
      substitutePlantId: substituteId,
      matchReason:
        SWAP_ECO_GAIN[plant.id] ??
        `${substituteId.replace(/-/g, " ")} adds native structure, nectar, and caterpillar host value.`,
      removalProtocolId: removalProtocolId(plant) ?? null,
      priority: plant.status === "invasive" ? "high" : "medium",
      isPrimary: index === 0,
    });
  });
}
for (const extra of EXTRA_REPLACEMENTS) {
  if (!plantIds.has(extra.targetPlantId) || !plantIds.has(extra.substitutePlantId)) continue;
  const existing = replacements.find(
    (item) =>
      item.targetPlantId === extra.targetPlantId &&
      item.substitutePlantId === extra.substitutePlantId,
  );
  if (existing) continue;
  const target = allPlants.find((plant) => plant.id === extra.targetPlantId);
  replacements.push({
    mappingId: `map-${extra.targetPlantId}-${extra.substitutePlantId}`,
    targetPlantId: extra.targetPlantId,
    substitutePlantId: extra.substitutePlantId,
    matchReason: extra.matchReason,
    removalProtocolId: target?.removal ? `removal-${target.id}` : null,
    priority: target?.status === "invasive" ? "high" : "medium",
    isPrimary: false,
  });
}

const plants = allPlants.map((plant) => {
  const lepidoptera = Number(plant.lepidoptera ?? 0);
  return {
    id: plant.id,
    legacyPlantId: plant.id,
    scientificName: plant.scientificName,
    commonName: plant.commonName,
    status: plant.status,
    njStatus: mapNjStatus(plant),
    type: plant.type,
    growthHabit: mapHabit(plant),
    sun: plant.sun,
    lightRange: plant.lightRange ?? parseLight(plant.sun),
    moisture: plant.moisture,
    moistureRange: plant.moistureRange ?? parseMoisture(plant.moisture),
    bloom: plant.bloom,
    bloomMonths: BLOOM_MONTH_OVERRIDES[plant.id] ?? parseBloomMonths(plant.bloom),
    height: plant.height,
    matureHeightFt: plant.matureHeightFt ?? parseHeight(plant.height),
    lepidoptera,
    lepidopteraCount: lepidoptera,
    specialistBeeSupport:
      plant.specialistBeeSupport ?? SPECIALIST_BEE_SUPPORT.has(plant.id),
    deerResistance:
      plant.deerResistance ??
      (HIGH_DEER_RESISTANCE.has(plant.id)
        ? "HIGH"
        : LOW_DEER_RESISTANCE.has(plant.id)
          ? "LOW"
          : "MODERATE"),
    ornamentalFeatures: plant.ornamentalFeatures ?? deriveFeatures(plant),
    description: plant.description,
    removalProtocolId: removalProtocolId(plant),
  };
});

const regions = REGIONS.map(
  ([zip, city, county, province, zone, ecoregion, ecoregionCode, soilPh]) => ({
    zip,
    city,
    county,
    province,
    zone,
    ecoregion,
    ecoregionCode,
    soilPh,
    state: "NJ",
    isNj: true,
    isEstimate: false,
  }),
);

const counties = COUNTIES.map(([name, province, zone, ecoregion, ecoregionCode, soilPh]) => ({
  name,
  province,
  zone,
  ecoregion,
  ecoregionCode,
  soilPh,
}));

const dataset = {
  meta: {
    version: "1.0.0",
    generatedAt: "2026-11-01",
    locale: "New Jersey, USA",
    ecoregion: "Ecoregion 8 — Eastern Temperate Forests",
    sources: [
      "Native Plant Society of New Jersey (NPSNJ) county lists",
      "Jersey-Friendly Yards / Barnegat Bay Partnership",
      "NJDEP and NJDA prohibited invasive species lists",
      "National Wildlife Federation / Doug Tallamy keystone plant research",
    ],
    notes:
      "Local seed snapshot for the NativeYard NJ MVP. Status and province assignments are illustrative and should be verified against current NJDEP and NPSNJ sources before regulatory action.",
  },
  plants,
  removalProtocols,
  replacements,
  regions,
  counties,
  nurseries: NURSERIES,
  synonyms: SYNONYMS.map(([synonym, acceptedPlantId]) => ({ synonym, acceptedPlantId })),
};

mkdirSync(join(root, "data"), { recursive: true });
writeFileSync(
  join(root, "data", "nj-flora.v1.json"),
  `${JSON.stringify(dataset, null, 2)}\n`,
  "utf8",
);

console.log(
  `Wrote data/nj-flora.v1.json: ${plants.length} plants, ${replacements.length} replacements, ${regions.length} ZIPs, ${counties.length} counties, ${NURSERIES.length} nurseries.`,
);
