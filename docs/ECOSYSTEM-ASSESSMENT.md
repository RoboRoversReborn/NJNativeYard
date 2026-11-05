# Ecosystem estimates, reference samples, and scan history

The product goal is **Improve your yard’s ecosystem**. Uploads and sample yards open the same dashboard: an immediate ecosystem estimate, coverage and review state, category counts, a numbered plant map, and the plant review/native-options workspace. No manual review flag is required to receive an estimate. A corrected match updates the assessment immediately.

## Exactly three reference samples

The active gallery uses the exact images and species/region fixtures from `NativeYard-1/web/public/samples` and `NativeYard-1/web/lib/sampleDetections.js`, matching [the reference app](https://native-yard-1.vercel.app/):

| Sample | Regions | Initial score | State |
| --- | ---: | ---: | --- |
| Suburban Front Yard | 6 | 1/100 | Provisional |
| Pollinator Backyard | 7 | 49/100 | Provisional |
| Woodland Edge Side Yard | 6 | 9/100 | Provisional |

Images are copied unchanged under `public/samples`; the normalized fixtures are `data/reference-samples.v1.json`. The existing catalog maps all 19 sample regions. These are illustrative reference fixtures, not newly verified live-provider identifications. The donor's authored confidence percentages are omitted because they are not measured botanical validation. No new private address or independent geographic provenance is asserted. A small source link credits the reference samples; parks, source dates, and location explanations are absent from the product flow.

All three overlaid maps were visually inspected against their source images. The boxes align with vegetation rather than paving-only regions. Selection works in both directions: selecting a map region selects/pages its matching list item, while selecting a list item highlights the matching region. Keystone teal, native blue, non-native ochre, invasive red, and unknown slate consistently label category counts, numbered map markers, outlines, list badges, and details. Text labels accompany colour.

Old sample drafts migrate to sample version 4. Real uploaded surveys are unchanged. Superseded sample image paths are cleared during migration so saving the migrated example cannot reuse the previous image's storage path.

## Formula: `species-mix-v3-signed`

Version 3 uses explicit product-policy weights with typed catalog categories. These coefficients are not scientifically calibrated habitat values. Earlier saved versions retain their original scores and must not be compared numerically across formula versions:

1. Resolve each suggested or corrected identity to a catalog species. An unknown/off-catalog species remains unassessed; a genus guess does not establish ecological status.
2. Count each **distinct catalog species once** for scoring, even if several regions show that species.
3. Assign keystone native 100, other NJ native 85, non-native −10, invasive −50. Compute the average across those distinct identified species.
4. Add 5 if any keystone is present, and 5 if there are at least three distinct native species (including keystones).
5. Retain the signed raw result, then round and limit the displayed index to 0–100. A floor of zero does not give non-native or invasive plants positive credit. When nothing can be assessed, the score is unavailable rather than an invented zero or native benefit.

The dashboard exposes this formula and its current breakdown. Native/invasive shares are labelled as shares of assessed **photo regions**, not land area or plant population. Unknowns receive no native points and are excluded from that denominator. Assessment coverage (`mapped regions / all regions`) makes the remaining uncertainty visible. Repeated regions can change region-count shares but do not inflate the species-based score. Identity review is a separate count; a partly reviewed or partly unknown survey remains provisional. Low coverage uses a cautious "first glimpse" heading.

This is an exploratory composition index, not an independently validated measure of ecosystem health. It does not measure pesticide use, soil, canopy area, wildlife abundance, or actual habitat improvement. Sample scores illustrate this same formula; they are not expert property ratings.

## Category visuals

The stacked plant-mix bar and category cards show each category’s percentage of **all detected photo regions**, including unknowns. Clicking a segment or card filters the same plant map and navigator; original numbers and explicit reset are preserved. The active filter shows a signed point impact. Category score effects are shown as **points**, never as a percentage of the final score. A separate expandable waterfall below the photo reconciles signed category points, shared bonuses and rounding/limits. The ring in that explanation only shows plant share, not score share or yard area. The top summary is compact so the photo appears before the detailed score mechanics.

The guest homepage now starts with an interactive preview of the actual three sample datasets, followed by homeowner outcomes, the photo-to-plan journey and a site-dependent native replacement example. The full three-yard gallery follows that context. Optional saved progress is introduced later. Preview score values are derived from the same assessment function as the review workspace; no fictional saved history or user results are shown.

The preview has a visible Explore this yard button and full sample names. Shared navy/white/teal tokens, readable field labels and consistent action styles apply across scan, account, review and home. Category subtitles explain ecological terms at the point of use. The next action checks suggested invasives before directing the homeowner to gated replacement planning; unknown identity and unknown NJ status lead to different actions. The product calls its task list a yard plan.

Plant details now lead with a source-fact narrative and three recognition cues, with deeper features and soil/growth facts on demand. Seasonal flower/fruit/foliage cards and reported wildlife associations retain their general horticultural scope. Source links and unmatched-reference states are explicit. Comparisons and printed reports use the same sourced summary. Previously stored control notes are labelled as not revalidated by this enrichment pass and require identity review.

All five category filters remain visible in a wrapping grid on narrow screens. Account-saving calls to action appear only when accounts are available; guests retain scanning, comparison and printing. The seasonal-action collection has 42 actions across 24 profiles, including the 19 sample profiles, with observation, care and control distinguished, individual sources linked, and species-specific control instructions gated on identity review. It is not full-catalog seasonal-action coverage. Four curated stories use source-guarded recognition and observation prompts linked to the close-up tool.

## Saving and comparing scans

`withScoreSnapshot` records formula version, score, native share, assessed/total/reviewed counts, coverage, provisional state, time, and an identity/review fingerprint. It appends only when that fingerprint or score version changes. Catalog evidence version is retained and included in the fingerprint; see NJ-CATALOG.md. Existing snapshots are retained, so a later correction does not overwrite earlier saved values. Both the application save action and account repository apply this helper; repeat application does not create duplicate entries.

Snapshots are stored inside the existing `ny_surveys.payload` JSON. No schema migration or wider access policy is needed. Existing property/yard-area ownership and reassignment guards remain intact. New uploads get unique survey IDs and dates. Editing an existing survey adds a score revision within that survey's history rather than pretending a new photograph was taken.

`scanComparison` includes every nonempty real upload in the **exact selected yard area**, in chronological order, including provisional observations and repeat scans in the same year or day. Samples and other areas are excluded. Saved snapshots supply captured historical values when present; legacy scans have a computed estimate until their next save. The UI shows date/time, provisional state, coverage, and review counts, plus saved score revisions. Differences are described as estimate changes: framing, coverage, and identification can change the comparison.

## Validation boundaries

Automated tests cover sample isolation and migration, immediate provisional scores, match corrections, map/list category synchronization, unknown coverage, duplicate-species invariance, same-day/same-year comparisons, property scope, saved snapshot revision retention, and application save propagation. Build and HTTP checks verify the local deployment. Browser automation inventory is unavailable; image/overlay inspection and DOM tests do not establish live browser visual QA. Live interactive Google sign-in and account persistence remain dependent on the separate Google OAuth setup.

## Yard boundary and background context

Real uploads never receive AI-assigned ownership. With no confirmed yard regions, an immediate photo estimate uses unconfirmed regions and excludes marked background. Once any region is confirmed in-yard, only confirmed yard regions contribute; unresolved membership remains excluded and keeps the result provisional. All-background photos have no yard estimate. Background plants remain visible for recognition. Scope travels through saved revisions and print. Legacy scores keep their numbers but are labelled photo estimates with unconfirmed boundaries, and differing ownership scopes do not produce a yard-progress delta.
