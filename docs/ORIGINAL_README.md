# NativeYard NJ

A local-first, New Jersey-specific MVP that turns a yard photo into a native-habitat action plan.

NativeYard NJ identifies the plants in a yard photo, classifies each against New Jersey's flora and physiographic provinces as a **NJ keystone native**, **native**, **non-native (low risk)**, **NJ regulated invasive**, or **NJ watchlist invasive**, scores the yard's biodiversity, and generates a printable **Ecological Transformation Report** with removal protocols and native replacements sourced from local NJ nurseries.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm start
```

## What works

- Camera/gallery photo upload with client-side resizing and server-side vegetation validation
- Drag-and-drop flow plus a clearly labeled sample-yard audit
- NJ ZIP code → town, county, USDA zone, and physiographic province resolution
- Local, versioned NJ flora snapshot (`data/nj-flora.v1.json`) with a typed repository API
- Interactive plant audit with numbered bounding boxes aligned to the natural photo aspect ratio
- Five NJ statuses, including separate regulated and watchlist invasives
- Confidence review: low-confidence matches are flagged, can be confirmed from NJ alternatives, or removed from the audit
- Yard biodiversity score with four metrics, plus native-share and invasive-load tracking
- Curated native swap engine with NJ replacement guidance
- Invasive removal protocols (method, timing, safety, disposal)
- Printable / save-as-PDF transformation report with county-matched NJ nursery leads
- Responsive layout and installable PWA manifest

## Local NJ data layer

All botanical and ecological data is read from the local snapshot — no live USDA or third-party plant API calls.

- `data/nj-flora.v1.json` — generated, versioned snapshot of 92 plants, replacement mappings, NJ ZIP/county/province records, and nurseries.
- `lib/nj-data.ts` — repository API: plant lookup (scientific name, synonym, genus fallback), replacements, nurseries, NJ ZIP validation, and region resolution.
- `scripts/build-nj-dataset.mjs` — regenerates the snapshot. Run it with Node and commit the resulting JSON.

`lib/plants.ts` re-exports the repository so UI imports stay stable, and holds status metadata, the demo audit, scoring, audit rebuilding, and vision-to-audit normalization.

## Live plant identification

The sample yard works without credentials and is always labeled as a sample. Uploaded photos never receive demo boxes.

To enable live photo identification, add a Gemini API key:

```bash
cp .env.example .env.local
# then set GEMINI_API_KEY=your-key
```

Without a key, photo uploads return a clear `503 vision_unavailable` message and stay on the landing page. With a key, `app/api/analyze/route.ts`:

1. Validates the NJ ZIP code.
2. Runs `lib/image-validation.ts` (Sharp) to reject blank, tiny, unreadable, or vegetation-free images before spending a model call.
3. Sends the image and NJ province context to Gemini.
4. Maps returned scientific names to the local NJ snapshot and builds an audit.
5. Returns actionable 4xx/5xx errors instead of falling back to sample data.

Optional PlantNet fallback for staged crop identification or a PlantNet-only deployment:

```bash
PLANTNET_API_KEY=your-key
```

The analysis flow first asks Gemini to find all plants and return normalized boxes. Gemini then identifies each cropped box individually. If Gemini cannot identify a crop, that crop is sent to PlantNet when `PLANTNET_API_KEY` is configured. If no Gemini key is configured, PlantNet identifies the full image directly.

Optional model override:

```bash
GEMINI_VISION_MODEL=gemini-2.5-flash
```

## Project structure

```
app/
  api/analyze/route.ts   NJ ZIP validation, image gate, vision adapter, actionable errors
  globals.css            Design system, overlay geometry, print styles
  layout.tsx             Fonts, NJ metadata, PWA theme
  page.tsx               App entry
components/
  native-yard-app.tsx    Flow state, image resizing, API call, error handling
  landing-page.tsx       NJ landing + upload experience
  analyzing-view.tsx     Scan animation
  audit-view.tsx         Interactive audit, confidence review, detection removal
  report-view.tsx        Printable NJ transformation report
  status-badge.tsx       Five-status NJ badge
  ...
data/
  nj-flora.v1.json       Versioned local NJ flora/replacement/nursery snapshot
lib/
  nj-data.ts             Local NJ data repository
  plants.ts              Status metadata, scoring, demo audit, audit rebuilding
  image-validation.ts    Sharp-based upload gate
  vision.ts              Gemini vision adapter and response parser
  types.ts               Shared types
scripts/
  build-nj-dataset.mjs   Snapshot generator
public/
  images/                Demo yard photography
```

## Data and ecological caveats

- The NJ snapshot is a curated MVP dataset, not a complete flora of New Jersey. Native and invasive status can vary by county, habitat, and source.
- Statuses follow the five-level NJ model: keystone native, native, non-native low risk, regulated invasive, watchlist invasive.
- The sample audit is illustrative. It is not a claim that the sample photo contains exactly those species.
- The upload gate only checks that an image plausibly contains vegetation; it is not a plant identifier.
- Invasive removal guidance is general. Herbicide use must follow the product label and local law; large infestations and work near water should be handled by a licensed professional.
- Always verify identification and local regulations with a county extension office or the Native Plant Society of New Jersey.
- Reference points: Native Plant Society of New Jersey county lists; Jersey-Friendly Yards / Barnegat Bay Partnership; NJDEP and NJDA invasive species lists; National Wildlife Federation keystone plant research; Doug Tallamy's *Nature's Best Hope*; EPA Level III/IV ecoregions.

## Demo photo credits

- Backyard patio photo: Pexels, photo 25972319 (Enrique).
- Lush garden photo: Pexels, photo 33768992 (Nui Malama).
- Pexels license: https://www.pexels.com/license/

## Next steps

1. Expand the NJ snapshot with county-level occurrence and source citations.
2. Support 1–3 photos per yard and merge detections across views.
3. Add segmentation masks to the overlay alongside bounding boxes.
4. Persist audits locally and add seasonal bloom-gap and 70% native-cover targets.
5. Add nursery inventory feeds and seasonal reminder emails.
6. Add neighborhood habitat-corridor aggregation with privacy controls.
