> **Current source handoff: R22 (November 5, 2026).** Start with [START-HERE.md](START-HERE.md) and [recipient setup](docs/PRODUCTION-HANDOFF.md). Release-specific validation is recorded in RELEASE-RECEIPT.json inside the archive; older notes below are historical.

# NativeYard — combined local application

A New Jersey plant and yard discovery app, based on **RoboRoversReborn/Native_Yard** (`fe82789`) with selected recognition and account integrations from **RoboRoversReborn/NativeYard-1** (`46b08d1`). This is a separate local Git repository; it has no GitHub remote.

## Run

Use Node 20.9+ (validated here with Node 25.2.1) and npm:

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3100
```

Open http://localhost:3100. The public homepage and three reference sample yard review flows work without credentials. The examples are clearly labeled and excluded from personal scan comparisons.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Configure real services

```bash
cp .env.example .env.local
```

Edit `.env.local` locally. It is ignored by Git. Never commit service keys.

- `GEMINI_API_KEY`: whole-yard region detection and leaf-photo diagnosis. `GEMINI_MODEL` defaults to `gemini-2.5-flash`; configure a model available to your account. The adapter can fall back to `gemini-3.5-flash` or `gemini-flash-latest`; model availability is verified against the configured key.
- `PLANTNET_API_KEY` (optional): secondary identification of cropped regions and leaves. With PlantNet alone, One plant mode can return a clearly labeled whole-photo suggestion. Whole yard mode requires Gemini region detection and will show a retry error if it is unavailable.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: account access. Only the public anon key belongs here; do not use a service-role key.

For accounts, create/configure a Supabase project, enable the Google auth provider, add `http://localhost:3100/auth/callback` and `http://127.0.0.1:3100/auth/callback` to allowed redirect URLs, and apply `supabase/schema.sql` in its SQL editor. Configure Google's OAuth callback to the Supabase project's `/auth/v1/callback` URL. Restart the server after environment changes. Database setup is not applied automatically.

The schema preserves existing donor `properties` and `yard_areas`. Combined surveys and roadmap tasks use separate `ny_surveys` and `ny_roadmap_tasks` tables. Donor `yard_scans` are not silently migrated because their model and score semantics differ. Photos use a new **private** `nativeyard-surveys` bucket with owner access policies and time-limited signed URLs. Existing donor photo buckets and access rules are not changed.

## Experience

- Welcoming educational homepage: photo → explore/refine → suitable native alternatives.
- Guest scan of a plant or whole yard; optional Google account.
- Photo with numbered regions, a complete accessible selector list, and adjacent details. On mobile, selection brings the inline detail panel into view.
- Leaf capture/upload and candidate comparison are inline. Manual matching includes reference specimens, scientific/common-name search, category filters, and pagination.
- Original four ecological categories: **keystone native, native, non-native, invasive**. NJ regulated/watchlist invasive details are retained. Unverified identity is a separate state, never an ecological category or automatic poor score.
- Suggested species contribute immediately to a provisional ecosystem estimate. Unknowns remain explicit, earn no native credit, and reduce assessment coverage. Correcting matches updates the score; review status is tracked independently.
- Original profiles and donor identification coverage are enriched with versioned NJ evidence. NJDEP regional nativity/conservation records, NJISST ecological listings and NJDA statutory listings override conflicting prototype status labels. Unmatched classifications stay provisional; native planting options require source support and exclude conservation-sensitive entries. See [NJ catalog evidence](docs/NJ-CATALOG.md). Genus guesses do not establish NJ ecological status.
- Printable report includes all detected plants, identity state, ecological context, alternatives, removal guidance where available, and nursery leads.
- Signed-in property hub without the public hero: properties, named yard areas, latest surveys, saved photos/reviews, and history.
- Every dated real-photo scan can appear in its exact yard-area timeline, including repeat scans within a day or year. Versioned score snapshots are saved with the survey. Samples are excluded, and differences in framing or identification are identified as limits.
- Dedicated homeowner roadmap with property/area scope, planned native replacements, editable tasks, notes, and persisted completion. Whole-property tasks remain at property scope. Task progress does not change ecological metrics.
- Profile editing and direct access to properties/roadmap.

## Sample yards and ecosystem estimates

The home and scan pages offer the exact Suburban Front Yard, Pollinator Backyard, and Woodland Edge Side Yard samples from the reference app. Each opens the same homeowner dashboard as an upload, with an immediate provisional score and coordinated plant categories. See [the formula, saved history, and sample provenance](docs/ECOSYSTEM-ASSESSMENT.md).

## Data and implementation

- Original NJ snapshot and modules: `data/nj-flora.v1.json`, `lib/nj-data.ts`, `lib/plants.ts`.
- Combined catalog, provisional metrics, snapshots, and repeat-scan comparisons: `lib/survey.ts`.
- Donor recognition prompts/adapters: `lib/recognition/`; normalized integration: `pipeline.ts`.
- Account persistence: `lib/account/`, `supabase/schema.sql`.
- New responsive styling: `app/journey.css`. The original stylesheet remains in `app/original-globals.css`; original components/report source remain available, but the new journey is the active entry point.
- Guest survey drafts are kept in IndexedDB for up to 24 hours, to survive sign-in or a reload at `?view=analysis`. Google returns with an explicit resume flag. Signing out clears the draft. No API keys are stored in browser storage.

Whole yard and One plant are explicit scan modes. Yard scans use a bounded backup detector when the primary model is overloaded, retain up to 24 regions, and never silently substitute a one-plant fallback. Loading shows the photo, elapsed time, and cancellation; duplicate uploads are blocked. Missing/failed AI providers return explicit errors. The donor's heuristic leaf fallback that fabricated observed traits is not used. Uploads reuse the donor’s browser JPEG conversion/compression before server processing. HEIC works when the browser or Sharp/libvips can decode it; compatible JPEG camera output is the reliable path. Camera capture uses the device's native file picker rather than the donor's custom live-camera modal.

## Verification and limitations

Build and logic/DOM checks are recorded in `docs/VALIDATION.md`. Real Supabase tables and private photo storage have now been created and ownership isolation tested. PlantNet identification has passed a live reference-photo test. Google login, authenticated cloud photo saving, and signed-photo refresh still require a configured Google provider and interactive login. See the validation record for Gemini model test results. No remote repository, push, or deployment was performed.

Original project documentation is preserved in `docs/ORIGINAL_README.md`. Botanical reference photos were copied from the donor's tracked `web/public/plants`; verify image attribution and species correctness before public release. Ecological data is a curated planning aid, not an authoritative inventory of New Jersey flora. Confirm species and local guidance before acting.

## Portable source handoff

For recipient setup, use [PRODUCTION-HANDOFF.md](docs/PRODUCTION-HANDOFF.md) and the standalone [VS Code / Copilot setup prompt](docs/COPILOT-SETUP-PROMPT.md). These supersede sender-specific setup details in historical notes. Every recipient supplies their own service project and secrets; no sender QA credentials or private data are included.

`python3 scripts/package-handoff.py` stages a credential-scanned source manifest. Final ZIP creation requires `--final --release-id NAME --release-receipt PATH`; it emits a checksum, file manifest and extraction-verification receipt under `handoff/`. See the handoff guide for exact verification commands and release limits. No dependency directory, build, `.env.local`, `.local` credential file, private upload or Git history is packaged.
