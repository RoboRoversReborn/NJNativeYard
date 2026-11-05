# New Jersey catalog and admission evidence

The next release contains **558 named profiles**, preserving all 249 baseline IDs and adding 309 independently reviewed, provider-backed records. **540 profiles have matched horticultural references**; 18 baseline profiles explicitly await detail sources. Named profiles include a few legacy genus entries, so this is not a claim of 558 verified species identifications.

The catalog is local curated data assembled from the original/donor catalog and evidence snapshots. It is not a live copy of PlantNet. Every **new** profile has a unique species-level PlantNet record, independent NJ relevance evidence and useful source-backed botanical facts.

## Recognition and planting are separate

The 309 additions comprise five first-batch garden profiles, 273 further NJ-associated recognition profiles (including 39 reviewed for site use), and 31 invasive-recognition profiles. The 39 are part of the 273, not an extra tranche.

- **43 additions qualify for site-conditioned native planting suggestions.** This is five first-batch profiles plus 38 newly reviewed garden options.
- **266 additions are recognition/context only.** This includes 235 from the NJ-native reference pool and 31 invasive-recognition records. They remain searchable and useful for existing vegetation, but are excluded from generic planting options.
- One reviewed woodland plant, Hydrophyllum virginianum, is recognition-only because the source rules out small-garden use and the app has no site-size selector.
- Source conflicts for Cornus alba and Xanthium strumarium remain unverified ecological categories with zero score credit. Catalog inclusion does not settle ownership, suitability or ecological status.

Overall category counts are 109 keystone natives, 299 other natives, 40 non-native, 78 invasive and 32 unverified. There are 165 supported native planting options including the baseline catalog. These categories describe source evidence, not a recommendation to remove existing vegetation.

## Agreed admission rule

Catalog admission requires precise species identity or an independently validated whole-taxon equivalent, a unique PlantNet ID/name/date/snapshot, independent NJ relevance and conflict/conservation disposition, plus sourced structural habit and useful physical or seasonal recognition facts.

Native planting eligibility additionally requires explicit landscape/design use, light and moisture/drainage guidance, and site context. Height, flowers, polished prose and photos are optional enrichment. Ferns do not need flower fields. Recognition records can be useful without being suitable planting choices.

Warnings are shown as attributed facts and context. They do not automatically make a native plant invasive or require removal. Conservation exclusions and unresolved identities prevent routine planting suggestions. Invasive recognition does not need garden-use evidence and never becomes a planting recommendation. No new control method or NJ treatment calendar was generated for the expanded recognition tranche.

`data/catalog-expansion/approved-additions.v1.json` is the compact runtime admission manifest; `lib/catalog-additions.ts` checks it against matched profiles and NJ evidence. Full provider/research inventories are not imported into the browser. Taxonomic aliases are explicit audited records, not automatically inferred from differing headings.

## Full candidate accounting

The NJDEP list has 1,519 rows. Removing 582 conservation-flagged rows leaves 937 eligible reference names: 104 baseline overlaps and 833 additional candidates.

| Exclusive final disposition of the 833 | Count |
| --- | ---: |
| Integrated first garden batch | 5 |
| Integrated further recognition profiles | 273 |
| Primary-source detail unresolved after direct and search follow-up | 355 |
| Provider gate held | 177 |
| Identity/origin/ecological holds | 22 |
| Semantic source mismatch quarantined | 1 |
| **Total** | **833** |

The 355 unresolved records comprise 350 without an exact primary profile from the source checked and five whose found pages describe a narrower variety/subspecies. They are not rejected as plants or declared unsuitable. There are no untouched candidates in this source-availability pass. This is not a claim that every possible botanical source worldwide has been exhausted.

A separate 54-taxon invasive-recognition pool has 31 integrated profiles, 14 unresolved source lookups, eight provider holds and one semantic quarantine. It has no overlap with the 833 native-reference pool.

All 833 native candidates were matched locally against the cached PlantNet inventory: 648 unique matches, 184 not found in the fetched snapshot and one ambiguity. Those provider outcomes overlap the exclusive evidence holds above. The snapshot has 85,394 unique IDs across 18 nonempty pages and a verified empty next page. Published project metadata differed by 12 rows, so absence is explicitly snapshot-scoped, not universal API absence. Inventory membership is not photo-identification accuracy.

Two misleading source aliases were quarantined: Nasturtium officinale → Tropaeolum majus, and broad Schoenoplectus tabernaemontani → S. lacustris. Neither is admitted. Two Andropogon → Anatherum whole-taxon equivalents were independently validated against Kew.

## Detail, sources and limits

Matched records retain source taxon, URL, check date, source-page SHA and categorical appearance/growing facts. General reference seasons are not verified NJ bloom calendars. Wildlife association lists are not measured habitat impact or counts for an individual yard. Source cautions are displayed in details and print; missing cautions are not a safety clearance. The 39 reviewed contexts use homeowner-facing notes, including an explicit source-internal life-cycle discrepancy for Anaphalis margaritacea.

The original 230 NC State profiles were independently reconciled against labelled cached HTML (13,260 values). Five first additions contributed 275 further values. The full later native direct-source extraction was independently reconciled before semantic holds; the runtime excludes the identified mismatch. This establishes transcription/scope fidelity, not field verification of all botanical facts.

There are **42 curated seasonal actions across 24 profiles**, including all 19 sample identities, and four evidence-guarded plant stories. No generic action is presented as species-specific care for every expanded record. Reference images retain attribution/licensing where available; PlantNet image access is restricted separately from species metadata access.

Research evidence and reproducible scripts are in `research/nj-expansion/`, `scripts/` and `docs/evidence/`. The baseline-ID snapshot and provider inventory hash are checked by tests. Source/public-page access did not bypass access controls; long descriptions and source photographs were not copied into the horticultural dataset.
