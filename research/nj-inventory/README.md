# NJ classification inventory

This reference is separate from the 558 rich garden profiles. It supplies exact-name NJ evidence for recognized species outside those profiles. It does not expand planting suggestions.

## Sources and retained evidence

- `raw/usda_nj_final2.xlsx`: the full NPSNJ-hosted USDA NJ vascular-plant workbook downloaded November 5, 2026 from <https://npsnj.org/wp-content/uploads/2023/01/usda_nj_final2.xlsx>. NPSNJ links it as “All NJ Vascular Plants – Scientific Name Sort” from its [plant-list hub](https://npsnj.org/native-plants/plant-lists-draft-refresh-20260521-132958/).
- SHA-256: `c643deec39168775932f1526e398a59df6c7a26c63cc1f1c198ca436cae9acc5`. It exactly matches the previously imported source hash in `data/nj-evidence.v2.json`. The workbook has 3,049 rows including its header; all 3,048 taxon rows were retained in that imported evidence.
- The combined reference also retains the existing 1,519 NJDEP native-reference rows and 1,194 accepted NJ native-program rows, with their source URLs, hashes and original evidence version in `coverage.json`. The source list has a 2023 upload path; the download date does not make its botanical contents a 2026 revision.
- The [Flora of New Jersey Project](https://www.njflora.org/the-flora-of-new-jersey/familes-and-genera-recognized-in-new-jersey/) explicitly describes its available treatments as incomplete, revised family by family. It is a corroborating botanical resource, not an additional purported complete species inventory imported here.

`../../data/nj-classification-inventory.v1.json` preserves source names, normalized lookup keys, explicit aliases, source row data, broader USDA origin codes, NJ evidence classification and conservation restrictions. The runtime resolver consults the same complete `nj-evidence.v2.json` indexes; the separate inventory is a reproducible reference/export, not a second independent authority.

## Coverage

| Measure | Count |
| --- | ---: |
| Raw / unique USDA NJ flora names | 3,048 / 3,048 |
| Broader-jurisdiction USDA N / I / NI codes | 2,163 / 847 / 38 |
| Combined source rows | 5,761 |
| Combined distinct source names | 3,351 |
| Normalized lookup keys | 3,339 |
| Native / keystone source-name classifications | 1,655 / 262 |
| Introduced non-native / invasive classifications | 765 / 84 |
| Unresolved classifications | 585 |
| Conservation-restricted source names retained | 582 |
| Explicit audited aliases / aliases reaching this reference | 21 / 14 |

Classification counts above count distinct source spellings. The corresponding unique normalized-key counts are native 1,644; keystone 261; non-native 765; invasive 84; unresolved 585. Synonym spellings therefore do not represent additional distinct taxa.

USDA `N` is not, by itself, proof of NJ nativity. NJ-native sources corroborate native classifications; explicit introduced codes support non-native classification. Mixed origin, conflicts and lineage uncertainty remain unresolved. Absence from this historical source snapshot is not proof of introduced status, nonviability in NJ, or absence from current NJ flora.

## Lookup behavior and boundaries

- **Acalypha gracilens**: outside the rich catalog; the full native evidence supports `native`.
- **Abutilon theophrasti**: outside the rich catalog; explicit source code `I` supports `non-native`.
- **Imaginaris botanica** (controlled missing-species fixture): absent from the evidence, so status stays unresolved; it is not classified non-native merely because it is missing.
- **Acer spp.**: genus-only, so no species identity or species classification is invented.
- Exact source subspecies and varieties are classified separately. Parent species must not inherit a native subspecies’ classification. Only the explicit audited alias table may join whole-taxon synonyms.
- Source nomenclature is preserved. “Lookup key” does not assert a newly validated globally accepted name. No wholesale modern accepted-name/synonym inventory has been fabricated or imported from fuzzy API results.
- Conservation-restricted taxa remain searchable evidence. An API-only/reference-only profile is never admitted into planting recommendations, including otherwise native taxa.

Rebuild from the project root:

```sh
node --import tsx research/nj-inventory/build-inventory.mts
```

The builder refuses a raw-source hash change. A changed workbook requires a reviewed reimport, not automatic adoption. It emits deterministic `coverage.json` and `data/nj-classification-inventory.v1.json` from checked-in evidence and the exact retained source snapshot.
