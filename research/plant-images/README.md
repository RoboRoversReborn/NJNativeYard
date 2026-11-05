# Catalog reference photograph audit

Current source revision: **416/558 taxa (74.6%)**, with832 verified detail/card renditions. This includes33 licensed photograph additions and removal of one conflicting tulip source relative to R7. The accepted R7 archive remains unchanged. `coverage.v1.json` and `followup-r8/terminal-audit.v1.json` distinguish44 no eligible cached candidates,93 eligible but unattempted candidates,4 visual holds and1 identity-conflict hold. These are bounded selected-path dispositions, not proof that no other internet source exists. Remaining acquisition is owned by the implementation image follow-up and is separate from the core release.

The baseline contains 558 distinct catalog taxa: 186 existing local mappings (all files decode) and 372 without a local mapping. Those legacy files have no per-file creator/license manifest and are preserved, not promoted to verified references.

The acquisition checks exact Wikidata P225 scientific names and P18 images, with a bounded alternate-file path using directly verified Commons P180 exact-taxon statements. Only existing, sourced whole-taxon aliases are eligible; there is no common-name search, genus substitution, parent-species fallback or generated imagery. Commons imageinfo supplies creator, license, file source, dimensions and original SHA-1. Accepted licenses are CC BY, CC BY-SA, CC0 and explicit public domain. An explicit “Unknown author” credit remains unknown; recording a field does not independently identify its creator. Initial source preferences were400px shorter edge/800px longer edge; these are not hard product requirements. The current priority is correct-species photographs with reuse permission and usable resolution. New relaxed batches may use320px longer edge/200px shorter edge without upscaling; PD/CC0 may have no creator listed. CC attribution and unclear permission remain substantive checks. Historical illustration/map screening is conservative. This is source metadata verification, not independent botanical re-identification of every pictured specimen.

PlantNet image access was probed once and returned403. The original Wikimedia image host returned429, so original downloads were deferred rather than repeatedly requested. API-returned official thumbnail URLs were downloaded with two workers, cached metadata and bounded backoff. The audit distinguishes host deferral from absent imagery.

`acquire.py` is resumable using `cache/` and `raw/`. It never needs or logs credentials. `probe.py` reads only the configured PlantNet key for its single capability check; its output omits the credential-bearing request URL. `optimize.mjs` creates immutable content-hashed WebP files under `public/references`:1024px maximum for detail and480px for cards. Source pixels are resized and re-encoded, never destructively cropped. The local full-image view remains available even when the remote original host is rate limited; the original source image and description page are linked separately. The component contains the complete image in detail frames and uses an explicit cover crop for cards, with a local full-image link, original-source link and visible credits.

The generated runtime manifest is `data/reference-photos.downloaded.v1.json`; `lib/plant-reference-store.ts` exposes exact whole-taxon lookups. Every entry retains source taxon, requested taxon, Wikidata ID, match rule/alias citation where relevant, creator/license/source URLs, source and optimized dimensions, hashes and resize credit. An organ label is added only when the file title explicitly names it.

Evidence files:

- `baseline.v1.json`: initial coverage and decode audit.
- `wikidata-exact-matches.v1.json`: P225/P18 evidence.
- `commons-imageinfo.v1.json`: source metadata snapshot.
- `acquisition-audit.v1.json`: all558 acquisition outcomes.
- `optimized-audit.v1.json`: final local assets and held outcomes.
- `coverage.v1.json`: measured coverage, residual causes and limitations.
- `contact-sheet.v1.png` and `alias-contact-sheet.v1.png`:23-photo spot check of image type/framing, not exhaustive botanical validation.

This is an exhaustive assessment of the selected exact-taxonomy source path, not a claim that all internet image sources were searched. Missing or held references remain honest fallbacks. Creator/license/source attribution must remain accessible wherever the local assets are displayed, including library cards.

Prior R7 frozen publication: **384 of558 taxa** have licensed downloaded reference photographs (68.8%). Remaining disjoint outcomes:72 original-host deferrals,95 no eligible original-path candidates,3 visually held illustrations,4 with no exact-taxonomy usable primary photo. The original strict preferences do not establish that other usable photos are unavailable. All 768 referenced detail/card files decode and match their recorded SHA/dimensions. Eighteen newly recovered photographs were visually checked; source metadata is not expert botanical verification.

New evidence: `retry-deferred-batch.v1.json`, `retry-thumb-service-batch.v1.json`, `alternate-depicts-batch.v1.json`, `alternate-depicts-taxonomy-holds.v1.json`, directP180 proof cache, `visual-approvals.v1.json`, `visual-holds.v1.json`, and `recovery-validation.v1.json`. New P180 files require explicit visual approval before publication; scanned illustrations are excluded even when their file format is photographic.
