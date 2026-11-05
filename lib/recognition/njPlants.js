/**
 * New Jersey plant knowledge base (prototype seed data).
 *
 * status:
 *   native     – native to New Jersey
 *   na_native  – native to North America, but not to New Jersey
 *   non_native – introduced, not (currently) listed as invasive in NJ
 *   invasive   – on NJ invasive lists (NJ Invasive Species Strike Team / NJDEP)
 *
 * Keystone status is derived from the genus (see KEYSTONE_GENERA) and only
 * applies to native species.
 *
 * ⚠️ Prototype data. Verify against USDA PLANTS, the NJ Invasive Species
 * Strike Team list, NJDEP and the Native Plant Society of NJ before launch.
 */

// Approximate number of butterfly & moth (Lepidoptera) species whose
// caterpillars use the genus as a host plant (Tallamy, Mid-Atlantic data).
export const KEYSTONE_GENERA = {
  Quercus: 557,
  Prunus: 456,
  Salix: 455,
  Betula: 411,
  Populus: 368,
  Malus: 311,
  Vaccinium: 288,
  Acer: 285,
  Ulmus: 213,
  Pinus: 203,
  Carya: 200,
  Amelanchier: 124,
  Solidago: 115,
  Symphyotrichum: 112,
  Helianthus: 73,
};

// Genus-level fallback when the exact species is not in the list.
export const GENUS_FALLBACK = {
  Quercus: "native",
  Solidago: "native",
  Symphyotrichum: "native",
  Eutrochium: "native",
  Monarda: "native",
  Pycnanthemum: "native",
  Asclepias: "native",
  Rudbeckia: "native",
  Amelanchier: "native",
  Carya: "native",
  Carex: "native",
  Panicum: "native",
  Andropogon: "native",
  Schizachyrium: "native",
  Iris: "native",
  Thuja: "native",
  Prunus: "native",
  Pinus: "native",
  Acer: "native",
  Viburnum: "native",
  Cornus: "native",
  Ilex: "native",
  Kalmia: "native",
  Hosta: "non_native",
  Buxus: "non_native",
  Hemerocallis: "non_native",
  Lagerstroemia: "non_native",
  Forsythia: "non_native",
  Weigela: "non_native",
  Liriope: "non_native",
  Nepeta: "non_native",
  Lavandula: "non_native",
  Hydrangea: "non_native",
  Pennisetum: "non_native",
  Sedum: "non_native",
  Taxus: "non_native",
  Pachysandra: "non_native",
  Spiraea: "non_native",
  Rosa: "non_native",
  Ligustrum: "invasive",
  Miscanthus: "invasive",
  Elaeagnus: "invasive",
  Phragmites: "invasive",
  Hedera: "invasive",
  Euonymus: "invasive",
  Berberis: "invasive",
  Wisteria: "invasive",
  Lonicera: "invasive",
  Ailanthus: "invasive",
};

const P = (sci, common, status, type, extra = {}) => ({ sci, common, status, type, ...extra });

export const PLANTS = [
  // ───────────── Invasive in NJ ─────────────
  P("Berberis thunbergii", "Japanese Barberry", "invasive", "shrub", {
    note: "Spreads into forests; dense thickets harbor deer ticks (Lyme disease).",
    subs: ["Ilex glabra", "Aronia melanocarpa", "Itea virginica", "Ceanothus americanus"],
  }),
  P("Euonymus alatus", "Burning Bush", "invasive", "shrub", {
    note: "Birds spread its seeds into woodlands, where it shades out native understory.",
    subs: ["Vaccinium corymbosum", "Itea virginica", "Aronia arbutifolia", "Viburnum dentatum"],
  }),
  P("Acer platanoides", "Norway Maple", "invasive", "tree", {
    note: "Dense shade and shallow roots suppress native plants; seeds spread widely.",
    subs: ["Acer rubrum", "Quercus rubra", "Nyssa sylvatica"],
  }),
  P("Pyrus calleryana", "Callery (Bradford) Pear", "invasive", "tree", {
    note: "Cross-pollinates and spreads into fields as thorny thickets; weak branches.",
    subs: ["Amelanchier canadensis", "Cornus florida", "Cercis canadensis"],
  }),
  P("Hedera helix", "English Ivy", "invasive", "vine", {
    note: "Smothers groundcover and climbs trees, adding weight and harboring disease.",
    subs: ["Carex pensylvanica", "Packera aurea", "Polystichum acrostichoides"],
  }),
  P("Lonicera japonica", "Japanese Honeysuckle", "invasive", "vine", {
    note: "Fast vine that strangles shrubs and young trees.",
    subs: ["Lonicera sempervirens", "Parthenocissus quinquefolia"],
  }),
  P("Lonicera maackii", "Amur Honeysuckle", "invasive", "shrub", {
    note: "Leafs out early, shading out spring wildflowers.",
    subs: ["Lindera benzoin", "Viburnum dentatum", "Sambucus canadensis"],
  }),
  P("Lonicera morrowii", "Morrow's Honeysuckle", "invasive", "shrub", {
    subs: ["Lindera benzoin", "Viburnum dentatum", "Sambucus canadensis"],
  }),
  P("Rosa multiflora", "Multiflora Rose", "invasive", "shrub", {
    note: "Forms impenetrable thorny thickets; one plant can produce 500,000 seeds a year.",
    subs: ["Rosa carolina", "Rosa palustris", "Aronia melanocarpa"],
  }),
  P("Ailanthus altissima", "Tree-of-Heaven", "invasive", "tree", {
    note: "Fast-growing, chemically suppresses nearby plants; host of the spotted lanternfly.",
    subs: ["Rhus typhina", "Sassafras albidum"],
  }),
  P("Reynoutria japonica", "Japanese Knotweed", "invasive", "perennial", {
    synonyms: ["Fallopia japonica", "Polygonum cuspidatum"],
    note: "Extremely aggressive rhizomes can damage foundations and pavement.",
    subs: ["Eutrochium fistulosum", "Sambucus canadensis", "Cephalanthus occidentalis"],
  }),
  P("Ligustrum obtusifolium", "Border Privet", "invasive", "shrub", {
    note: "Birds spread its berries into woods and wetlands.",
    subs: ["Ilex glabra", "Clethra alnifolia", "Viburnum dentatum", "Morella pensylvanica"],
  }),
  P("Ligustrum vulgare", "Common Privet", "invasive", "shrub", {
    subs: ["Ilex glabra", "Clethra alnifolia", "Viburnum dentatum", "Morella pensylvanica"],
  }),
  P("Ligustrum sinense", "Chinese Privet", "invasive", "shrub", {
    subs: ["Ilex glabra", "Clethra alnifolia", "Viburnum dentatum"],
  }),
  P("Ligustrum ovalifolium", "California Privet", "invasive", "shrub", {
    subs: ["Ilex glabra", "Clethra alnifolia", "Viburnum dentatum", "Morella pensylvanica"],
  }),
  P("Elaeagnus umbellata", "Autumn Olive", "invasive", "shrub", {
    subs: ["Morella pensylvanica", "Amelanchier canadensis", "Aronia arbutifolia"],
  }),
  P("Celastrus orbiculatus", "Oriental Bittersweet", "invasive", "vine", {
    note: "Girdles and topples trees.",
    subs: ["Parthenocissus quinquefolia", "Lonicera sempervirens"],
  }),
  P("Ampelopsis glandulosa", "Porcelain Berry", "invasive", "vine", {
    synonyms: ["Ampelopsis brevipedunculata"],
    subs: ["Parthenocissus quinquefolia", "Lonicera sempervirens"],
  }),
  P("Wisteria sinensis", "Chinese Wisteria", "invasive", "vine", {
    subs: ["Lonicera sempervirens", "Parthenocissus quinquefolia"],
  }),
  P("Wisteria floribunda", "Japanese Wisteria", "invasive", "vine", {
    subs: ["Lonicera sempervirens", "Parthenocissus quinquefolia"],
  }),
  P("Euonymus fortunei", "Wintercreeper", "invasive", "groundcover", {
    subs: ["Carex pensylvanica", "Packera aurea", "Tiarella cordifolia"],
  }),
  P("Vinca minor", "Periwinkle", "invasive", "groundcover", {
    subs: ["Carex pensylvanica", "Packera aurea", "Tiarella cordifolia"],
  }),
  P("Spiraea japonica", "Japanese Spirea", "invasive", "shrub", {
    subs: ["Physocarpus opulifolius", "Ceanothus americanus", "Clethra alnifolia"],
  }),
  P("Miscanthus sinensis", "Chinese Silver Grass", "invasive", "grass", {
    subs: ["Schizachyrium scoparium", "Panicum virgatum", "Sorghastrum nutans"],
  }),
  P("Microstegium vimineum", "Japanese Stiltgrass", "invasive", "grass", {
    subs: ["Carex pensylvanica", "Packera aurea", "Geranium maculatum"],
  }),
  P("Rubus phoenicolasius", "Wineberry", "invasive", "shrub", {
    subs: ["Rubus occidentalis"],
  }),
  P("Persicaria perfoliata", "Mile-a-Minute", "invasive", "vine", {
    subs: ["Parthenocissus quinquefolia"],
  }),
  P("Alliaria petiolata", "Garlic Mustard", "invasive", "perennial", {
    subs: ["Geranium maculatum", "Packera aurea", "Aquilegia canadensis"],
  }),
  P("Ficaria verna", "Lesser Celandine", "invasive", "groundcover", {
    synonyms: ["Ranunculus ficaria"],
    subs: ["Packera aurea", "Geranium maculatum"],
  }),
  P("Morus alba", "White Mulberry", "invasive", "tree", {
    subs: ["Prunus serotina", "Amelanchier canadensis"],
  }),
  P("Paulownia tomentosa", "Princess Tree", "invasive", "tree", {
    subs: ["Liriodendron tulipifera", "Quercus alba"],
  }),
  P("Albizia julibrissin", "Mimosa (Silk Tree)", "invasive", "tree", {
    subs: ["Cercis canadensis", "Amelanchier canadensis"],
  }),
  P("Rhodotypos scandens", "Jetbead", "invasive", "shrub", {
    subs: ["Viburnum acerifolium", "Lindera benzoin"],
  }),
  P("Viburnum dilatatum", "Linden Viburnum", "invasive", "shrub", {
    subs: ["Viburnum dentatum", "Viburnum prunifolium"],
  }),
  P("Lythrum salicaria", "Purple Loosestrife", "invasive", "perennial", {
    subs: ["Lobelia cardinalis", "Verbena hastata", "Eutrochium fistulosum"],
  }),
  P("Iris pseudacorus", "Yellow Flag Iris", "invasive", "perennial", {
    subs: ["Iris versicolor"],
  }),
  P("Phragmites australis", "Common Reed (Phragmites)", "invasive", "grass", {
    note: "The non-native subspecies is highly invasive in NJ wetlands.",
    subs: ["Panicum virgatum", "Eutrochium fistulosum"],
  }),

  // ───────────── Non-native (common ornamentals / lawn) ─────────────
  P("Hosta plantaginea", "Hosta", "non_native", "perennial", {
    subs: ["Polystichum acrostichoides", "Heuchera americana", "Tiarella cordifolia", "Geranium maculatum"],
  }),
  P("Hosta sieboldiana", "Hosta", "non_native", "perennial", {
    subs: ["Polystichum acrostichoides", "Heuchera americana", "Tiarella cordifolia", "Geranium maculatum"],
  }),
  P("Buxus sempervirens", "Boxwood", "non_native", "shrub", {
    subs: ["Ilex glabra", "Taxus canadensis", "Kalmia latifolia"],
  }),
  P("Buxus microphylla", "Littleleaf Boxwood", "non_native", "shrub", {
    subs: ["Ilex glabra", "Taxus canadensis"],
  }),
  P("Hydrangea macrophylla", "Bigleaf Hydrangea", "non_native", "shrub", {
    subs: ["Hydrangea arborescens", "Clethra alnifolia", "Itea virginica"],
  }),
  P("Hydrangea paniculata", "Panicle Hydrangea", "non_native", "shrub", {
    subs: ["Hydrangea arborescens", "Clethra alnifolia", "Cephalanthus occidentalis"],
  }),
  P("Acer palmatum", "Japanese Maple", "non_native", "tree", {
    note: "Self-seeds into some NJ woodlands; watch for seedlings.",
    subs: ["Amelanchier canadensis", "Cornus florida", "Hamamelis virginiana"],
  }),
  P("Cornus kousa", "Kousa Dogwood", "non_native", "tree", {
    subs: ["Cornus florida", "Amelanchier canadensis", "Cercis canadensis"],
  }),
  P("Lagerstroemia indica", "Crape Myrtle", "non_native", "shrub", {
    subs: ["Amelanchier canadensis", "Cercis canadensis", "Clethra alnifolia"],
  }),
  P("Hemerocallis fulva", "Orange Daylily", "non_native", "perennial", {
    note: "Spreads aggressively along roadsides and woodland edges.",
    subs: ["Rudbeckia fulgida", "Asclepias tuberosa", "Lilium superbum"],
  }),
  P("Hemerocallis lilioasphodelus", "Yellow Daylily", "non_native", "perennial", {
    subs: ["Rudbeckia fulgida", "Asclepias tuberosa"],
  }),
  P("Taxus cuspidata", "Japanese Yew", "non_native", "shrub", {
    subs: ["Ilex opaca", "Juniperus virginiana", "Taxus canadensis"],
  }),
  P("Taxus baccata", "English Yew", "non_native", "shrub", {
    subs: ["Ilex opaca", "Juniperus virginiana", "Taxus canadensis"],
  }),
  P("Taxus × media", "Anglojap Yew", "non_native", "shrub", {
    subs: ["Ilex opaca", "Juniperus virginiana", "Taxus canadensis"],
  }),
  P("Juniperus chinensis", "Chinese Juniper", "non_native", "shrub", {
    subs: ["Juniperus virginiana", "Juniperus communis"],
  }),
  P("Cupressus × leylandii", "Leyland Cypress", "non_native", "tree", {
    synonyms: ["Cuprocyparis leylandii", "× Cuprocyparis leylandii"],
    subs: ["Juniperus virginiana", "Ilex opaca", "Pinus strobus"],
  }),
  P("Picea abies", "Norway Spruce", "non_native", "tree", {
    subs: ["Pinus strobus", "Ilex opaca", "Juniperus virginiana"],
  }),
  P("Forsythia × intermedia", "Forsythia", "non_native", "shrub", {
    subs: ["Lindera benzoin", "Amelanchier canadensis"],
  }),
  P("Syringa vulgaris", "Common Lilac", "non_native", "shrub", {
    subs: ["Clethra alnifolia", "Viburnum prunifolium"],
  }),
  P("Hibiscus syriacus", "Rose of Sharon", "non_native", "shrub", {
    note: "Self-seeds heavily.",
    subs: ["Hibiscus moscheutos", "Cephalanthus occidentalis"],
  }),
  P("Ilex crenata", "Japanese Holly", "non_native", "shrub", {
    note: "Emerging invasive in NJ woodlands.",
    subs: ["Ilex glabra"],
  }),
  P("Prunus laurocerasus", "Cherry Laurel", "non_native", "shrub", {
    subs: ["Ilex opaca", "Kalmia latifolia", "Ilex glabra"],
  }),
  P("Prunus serrulata", "Japanese Flowering Cherry", "non_native", "tree", {
    subs: ["Amelanchier canadensis", "Cercis canadensis", "Cornus florida"],
  }),
  P("Pieris japonica", "Japanese Pieris", "non_native", "shrub", {
    subs: ["Kalmia latifolia", "Ilex glabra"],
  }),
  P("Rhododendron simsii", "Azalea (hybrid)", "non_native", "shrub", {
    subs: ["Rhododendron viscosum", "Rhododendron periclymenoides", "Kalmia latifolia"],
  }),
  P("Rhododendron indicum", "Azalea (hybrid)", "non_native", "shrub", {
    subs: ["Rhododendron viscosum", "Rhododendron periclymenoides", "Kalmia latifolia"],
  }),
  P("Liriope muscari", "Lilyturf", "non_native", "groundcover", {
    subs: ["Carex pensylvanica", "Packera aurea"],
  }),
  P("Ajuga reptans", "Bugleweed", "non_native", "groundcover", {
    subs: ["Carex pensylvanica", "Packera aurea", "Fragaria virginiana"],
  }),
  P("Pachysandra terminalis", "Japanese Pachysandra", "non_native", "groundcover", {
    note: "Can escape into woodlands.",
    subs: ["Carex pensylvanica", "Tiarella cordifolia", "Packera aurea"],
  }),
  P("Nandina domestica", "Heavenly Bamboo", "non_native", "shrub", {
    note: "Berries can be toxic to birds.",
    subs: ["Ilex verticillata", "Aronia arbutifolia"],
  }),
  P("Buddleja davidii", "Butterfly Bush", "non_native", "shrub", {
    note: "Feeds adult butterflies but hosts almost no caterpillars; can self-seed.",
    subs: ["Cephalanthus occidentalis", "Clethra alnifolia", "Asclepias tuberosa", "Eutrochium purpureum"],
  }),
  P("Pennisetum alopecuroides", "Fountain Grass", "non_native", "grass", {
    synonyms: ["Cenchrus alopecuroides"],
    subs: ["Schizachyrium scoparium", "Panicum virgatum"],
  }),
  P("Viburnum opulus", "European Cranberrybush", "non_native", "shrub", {
    subs: ["Viburnum trilobum", "Viburnum dentatum"],
  }),
  P("Viburnum plicatum", "Japanese Snowball", "non_native", "shrub", {
    subs: ["Viburnum dentatum", "Viburnum prunifolium"],
  }),
  P("Hylotelephium spectabile", "Showy Stonecrop", "non_native", "perennial", {
    synonyms: ["Sedum spectabile"],
    subs: ["Pycnanthemum muticum", "Asclepias tuberosa"],
  }),
  P("Nepeta × faassenii", "Catmint", "non_native", "perennial", {
    subs: ["Pycnanthemum muticum", "Monarda fistulosa"],
  }),
  P("Salvia nemorosa", "Woodland Sage", "non_native", "perennial", {
    subs: ["Monarda fistulosa", "Lobelia siphilitica", "Penstemon digitalis"],
  }),
  P("Lavandula angustifolia", "Lavender", "non_native", "perennial", {
    subs: ["Pycnanthemum tenuifolium", "Monarda punctata"],
  }),
  P("Rosa chinensis", "Garden Rose", "non_native", "shrub", {
    subs: ["Rosa carolina", "Rosa palustris"],
  }),
  P("Weigela florida", "Weigela", "non_native", "shrub", {
    subs: ["Diervilla lonicera", "Clethra alnifolia"],
  }),
  P("Magnolia × soulangeana", "Saucer Magnolia", "non_native", "tree", {
    subs: ["Magnolia virginiana", "Cercis canadensis"],
  }),
  P("Lolium perenne", "Perennial Ryegrass (lawn)", "non_native", "grass", {
    subs: ["Carex pensylvanica", "Fragaria virginiana"],
  }),
  P("Festuca arundinacea", "Tall Fescue (lawn)", "non_native", "grass", {
    synonyms: ["Lolium arundinaceum", "Schedonorus arundinaceus"],
    subs: ["Carex pensylvanica", "Fragaria virginiana"],
  }),
  P("Poa pratensis", "Kentucky Bluegrass (lawn)", "non_native", "grass", {
    subs: ["Carex pensylvanica", "Fragaria virginiana"],
  }),
  P("Ageratum houstonianum", "Floss Flower (annual)", "non_native", "perennial", {
    subs: ["Conoclinium coelestinum", "Symphyotrichum laeve"],
  }),

  // ───────────── Native to North America, not NJ ─────────────
  P("Echinacea purpurea", "Purple Coneflower", "na_native", "perennial", {
    note: "Native to the Midwest/South. Good for pollinators; pair with NJ natives.",
    subs: ["Rudbeckia hirta", "Monarda fistulosa"],
  }),
  P("Hydrangea quercifolia", "Oakleaf Hydrangea", "na_native", "shrub", {
    note: "Native to the Southeast US.",
    subs: ["Hydrangea arborescens", "Clethra alnifolia"],
  }),
  P("Helianthus annuus", "Common Sunflower", "na_native", "perennial", {
    note: "Native to western North America; still great for bees and seed-eating birds.",
  }),
  P("Thuja occidentalis", "American Arborvitae", "na_native", "tree", {
    subs: ["Juniperus virginiana", "Ilex opaca"],
  }),
  P("Gaillardia aristata", "Blanket Flower", "na_native", "perennial", {}),

  // ───────────── Native to NJ ─────────────
  // Trees
  P("Quercus alba", "White Oak", "native", "tree"),
  P("Quercus rubra", "Northern Red Oak", "native", "tree"),
  P("Quercus palustris", "Pin Oak", "native", "tree"),
  P("Quercus bicolor", "Swamp White Oak", "native", "tree"),
  P("Quercus phellos", "Willow Oak", "native", "tree"),
  P("Quercus coccinea", "Scarlet Oak", "native", "tree"),
  P("Quercus velutina", "Black Oak", "native", "tree"),
  P("Quercus montana", "Chestnut Oak", "native", "tree", { synonyms: ["Quercus prinus"] }),
  P("Prunus serotina", "Black Cherry", "native", "tree"),
  P("Prunus virginiana", "Chokecherry", "native", "shrub"),
  P("Acer rubrum", "Red Maple", "native", "tree"),
  P("Acer saccharinum", "Silver Maple", "native", "tree"),
  P("Acer saccharum", "Sugar Maple", "native", "tree"),
  P("Betula nigra", "River Birch", "native", "tree"),
  P("Betula lenta", "Black Birch", "native", "tree"),
  P("Betula populifolia", "Gray Birch", "native", "tree"),
  P("Salix nigra", "Black Willow", "native", "tree"),
  P("Salix discolor", "Pussy Willow", "native", "shrub"),
  P("Populus tremuloides", "Quaking Aspen", "native", "tree"),
  P("Populus grandidentata", "Bigtooth Aspen", "native", "tree"),
  P("Carya ovata", "Shagbark Hickory", "native", "tree"),
  P("Carya tomentosa", "Mockernut Hickory", "native", "tree"),
  P("Pinus strobus", "Eastern White Pine", "native", "tree"),
  P("Pinus rigida", "Pitch Pine", "native", "tree"),
  P("Ulmus americana", "American Elm", "native", "tree"),
  P("Malus coronaria", "Sweet Crabapple", "native", "tree"),
  P("Amelanchier canadensis", "Canadian Serviceberry", "native", "tree"),
  P("Amelanchier laevis", "Allegheny Serviceberry", "native", "tree"),
  P("Amelanchier arborea", "Downy Serviceberry", "native", "tree"),
  P("Cercis canadensis", "Eastern Redbud", "native", "tree"),
  P("Cornus florida", "Flowering Dogwood", "native", "tree"),
  P("Nyssa sylvatica", "Black Gum", "native", "tree"),
  P("Liriodendron tulipifera", "Tulip Tree", "native", "tree"),
  P("Ilex opaca", "American Holly", "native", "tree"),
  P("Juniperus virginiana", "Eastern Red Cedar", "native", "tree"),
  P("Liquidambar styraciflua", "Sweetgum", "native", "tree"),
  P("Platanus occidentalis", "American Sycamore", "native", "tree"),
  P("Diospyros virginiana", "American Persimmon", "native", "tree"),
  P("Sassafras albidum", "Sassafras", "native", "tree"),
  P("Magnolia virginiana", "Sweetbay Magnolia", "native", "tree"),
  // Shrubs
  P("Hamamelis virginiana", "American Witch-hazel", "native", "shrub"),
  P("Vaccinium corymbosum", "Highbush Blueberry", "native", "shrub"),
  P("Itea virginica", "Virginia Sweetspire", "native", "shrub"),
  P("Ilex glabra", "Inkberry Holly", "native", "shrub"),
  P("Ilex verticillata", "Winterberry Holly", "native", "shrub"),
  P("Clethra alnifolia", "Sweet Pepperbush", "native", "shrub"),
  P("Viburnum dentatum", "Arrowwood Viburnum", "native", "shrub"),
  P("Viburnum prunifolium", "Blackhaw Viburnum", "native", "shrub"),
  P("Viburnum acerifolium", "Mapleleaf Viburnum", "native", "shrub"),
  P("Viburnum trilobum", "American Cranberrybush", "native", "shrub", { synonyms: ["Viburnum opulus var. americanum"] }),
  P("Aronia arbutifolia", "Red Chokeberry", "native", "shrub", { synonyms: ["Photinia pyrifolia"] }),
  P("Aronia melanocarpa", "Black Chokeberry", "native", "shrub", { synonyms: ["Photinia melanocarpa"] }),
  P("Cephalanthus occidentalis", "Buttonbush", "native", "shrub"),
  P("Lindera benzoin", "Spicebush", "native", "shrub"),
  P("Sambucus canadensis", "American Elderberry", "native", "shrub", { synonyms: ["Sambucus nigra subsp. canadensis"] }),
  P("Hydrangea arborescens", "Smooth Hydrangea", "native", "shrub"),
  P("Rhododendron viscosum", "Swamp Azalea", "native", "shrub"),
  P("Rhododendron periclymenoides", "Pinxterbloom Azalea", "native", "shrub"),
  P("Rhododendron maximum", "Rosebay Rhododendron", "native", "shrub"),
  P("Kalmia latifolia", "Mountain Laurel", "native", "shrub"),
  P("Morella pensylvanica", "Northern Bayberry", "native", "shrub", { synonyms: ["Myrica pensylvanica"] }),
  P("Ceanothus americanus", "New Jersey Tea", "native", "shrub"),
  P("Rhus typhina", "Staghorn Sumac", "native", "shrub"),
  P("Rhus copallinum", "Winged Sumac", "native", "shrub"),
  P("Physocarpus opulifolius", "Ninebark", "native", "shrub"),
  P("Rosa carolina", "Carolina Rose", "native", "shrub"),
  P("Rosa palustris", "Swamp Rose", "native", "shrub"),
  P("Rubus occidentalis", "Black Raspberry", "native", "shrub"),
  P("Taxus canadensis", "Canada Yew", "native", "shrub"),
  P("Juniperus communis", "Common Juniper", "native", "shrub"),
  P("Diervilla lonicera", "Northern Bush Honeysuckle", "native", "shrub"),
  P("Comptonia peregrina", "Sweetfern", "native", "shrub"),
  P("Hibiscus moscheutos", "Swamp Rose Mallow", "native", "perennial"),
  // Perennials
  P("Solidago rugosa", "Wrinkleleaf Goldenrod", "native", "perennial"),
  P("Solidago sempervirens", "Seaside Goldenrod", "native", "perennial"),
  P("Solidago canadensis", "Canada Goldenrod", "native", "perennial"),
  P("Solidago nemoralis", "Gray Goldenrod", "native", "perennial"),
  P("Solidago caesia", "Bluestem Goldenrod", "native", "perennial"),
  P("Symphyotrichum novae-angliae", "New England Aster", "native", "perennial"),
  P("Symphyotrichum laeve", "Smooth Blue Aster", "native", "perennial"),
  P("Symphyotrichum cordifolium", "Blue Wood Aster", "native", "perennial"),
  P("Symphyotrichum ericoides", "Heath Aster", "native", "perennial"),
  P("Symphyotrichum oblongifolium", "Aromatic Aster", "native", "perennial"),
  P("Eurybia divaricata", "White Wood Aster", "native", "perennial"),
  P("Helianthus divaricatus", "Woodland Sunflower", "native", "perennial"),
  P("Helianthus giganteus", "Giant Sunflower", "native", "perennial"),
  P("Eutrochium purpureum", "Sweet Joe-Pye Weed", "native", "perennial"),
  P("Eutrochium maculatum", "Spotted Joe-Pye Weed", "native", "perennial"),
  P("Eutrochium fistulosum", "Hollow Joe-Pye Weed", "native", "perennial"),
  P("Conoclinium coelestinum", "Blue Mistflower", "native", "perennial"),
  P("Monarda fistulosa", "Wild Bergamot", "native", "perennial"),
  P("Monarda didyma", "Scarlet Bee Balm", "native", "perennial"),
  P("Monarda punctata", "Spotted Bee Balm", "native", "perennial"),
  P("Asclepias tuberosa", "Butterfly Weed", "native", "perennial", { note: "Monarch caterpillar host plant." }),
  P("Asclepias incarnata", "Swamp Milkweed", "native", "perennial", { note: "Monarch caterpillar host plant." }),
  P("Asclepias syriaca", "Common Milkweed", "native", "perennial", { note: "Monarch caterpillar host plant." }),
  P("Pycnanthemum muticum", "Clustered Mountain Mint", "native", "perennial"),
  P("Pycnanthemum virginianum", "Virginia Mountain Mint", "native", "perennial"),
  P("Pycnanthemum tenuifolium", "Narrowleaf Mountain Mint", "native", "perennial"),
  P("Rudbeckia hirta", "Black-eyed Susan", "native", "perennial"),
  P("Rudbeckia fulgida", "Orange Coneflower", "native", "perennial"),
  P("Rudbeckia laciniata", "Cutleaf Coneflower", "native", "perennial"),
  P("Lobelia cardinalis", "Cardinal Flower", "native", "perennial"),
  P("Lobelia siphilitica", "Great Blue Lobelia", "native", "perennial"),
  P("Penstemon digitalis", "Foxglove Beardtongue", "native", "perennial"),
  P("Phlox paniculata", "Garden Phlox", "native", "perennial"),
  P("Phlox subulata", "Moss Phlox", "native", "perennial"),
  P("Geranium maculatum", "Wild Geranium", "native", "perennial"),
  P("Aquilegia canadensis", "Eastern Columbine", "native", "perennial"),
  P("Heuchera americana", "American Alumroot", "native", "perennial"),
  P("Tiarella cordifolia", "Foamflower", "native", "perennial"),
  P("Packera aurea", "Golden Ragwort", "native", "perennial"),
  P("Zizia aurea", "Golden Alexanders", "native", "perennial"),
  P("Vernonia noveboracensis", "New York Ironweed", "native", "perennial"),
  P("Verbena hastata", "Blue Vervain", "native", "perennial"),
  P("Liatris spicata", "Dense Blazing Star", "native", "perennial"),
  P("Iris versicolor", "Northern Blue Flag", "native", "perennial"),
  P("Lilium superbum", "Turk's Cap Lily", "native", "perennial"),
  P("Fragaria virginiana", "Wild Strawberry", "native", "groundcover"),
  P("Viola sororia", "Common Blue Violet", "native", "groundcover"),
  P("Carex pensylvanica", "Pennsylvania Sedge", "native", "groundcover"),
  // Grasses & ferns
  P("Schizachyrium scoparium", "Little Bluestem", "native", "grass"),
  P("Panicum virgatum", "Switchgrass", "native", "grass"),
  P("Andropogon gerardii", "Big Bluestem", "native", "grass"),
  P("Sorghastrum nutans", "Indiangrass", "native", "grass"),
  P("Polystichum acrostichoides", "Christmas Fern", "native", "fern"),
  P("Osmundastrum cinnamomeum", "Cinnamon Fern", "native", "fern", { synonyms: ["Osmunda cinnamomea"] }),
  P("Onoclea sensibilis", "Sensitive Fern", "native", "fern"),
  P("Matteuccia struthiopteris", "Ostrich Fern", "native", "fern"),
  P("Dennstaedtia punctilobula", "Hay-scented Fern", "native", "fern"),
  // Vines
  P("Lonicera sempervirens", "Coral Honeysuckle", "native", "vine"),
  P("Parthenocissus quinquefolia", "Virginia Creeper", "native", "vine"),
  P("Campsis radicans", "Trumpet Creeper", "native", "vine"),
];
