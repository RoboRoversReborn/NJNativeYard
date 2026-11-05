# NativeYard R22 — recipient setup

Release date: **November 5, 2026**. Source matches local build **ObXO_WyiXf2AyVLtIvPDd**. `RELEASE-RECEIPT.json` and `SOURCE-MANIFEST.json` identify the archive. Read `START-HERE.md` first.

The current source built and served locally. The owner explicitly deferred further acceptance testing. Earlier unit, provider, database, and UI evidence belongs to its named revision; it does not establish complete acceptance of R22. This packaging pass only verifies archive contents, hashes, required files, exclusions, and credential scans. No fresh dependency install, rebuild, application test suite, or browser QA was run during packaging.

## Install in a fresh folder

Extract the ZIP, open its `nativeyard` folder in VS Code, and use Node **24.x or newer** with npm. Sender runtime: **25.2.1**. Locked Next 16.4.3 requires Node >=20.9.0, but the bundled development dependencies and test-loader API require a newer Node line; Node 24 meets the recorded constraints. Your organization’s chosen Node/platform still needs its own verification.

```sh
node scripts/verify-handoff.mjs
node --version
npm --version
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3100
```

Open http://localhost:3100. `npm ci` consumes the exact versions and integrity hashes in `package-lock.json`. Do not regenerate the lockfile or copy installed packages from the sender. If optional dependencies or install scripts are blocked by enterprise policy, resolve that through your approved package workflow; do not bypass TLS or corporate controls. Sharp may need its platform-specific optional packages.

No Docker, global database server, Python research packages, or sender-specific paths are required for normal launch. Next regenerates `next-env.d.ts` and build types. Old `.next-rXX` include globs in TypeScript configuration describe local build directories and do not require those directories to be shipped.

## What ships, including HEIC support

All app/components/lib/data/public source trees, tests and their public fixtures, scripts, migrations, and required source configuration are included. Public plant photos, credits, sample assets and versioned botanical evidence are bundled. The rich catalog is smaller than the separate classification inventory; inventory membership is not automatic planting approval.

The archive intentionally excludes `node_modules`, compiled Next output, machine/native installed binaries, caches, `.git`, `.env.local`, local QA accounts, private photos, personal records, database exports, and raw research acquisitions. The public HEIC fixture and provenance are test assets, not personal uploads.

HEIC/HEIF conversion runs **locally on the app server**, using locked **libheif-js 1.23.5** bundled WASM and **exifr 7.1.3**, with Sharp JPEG encoding. No third-party conversion service is used. `npm ci` supplies `libheif-js/wasm-bundle.js` and its `libheif-wasm/libheif-bundle.js`; `next.config.ts` externalizes/traces them for server routes. Keep this configuration and the lockfile. Actual decoder assets are installable package contents, so installed WASM/native packages are not copied into this source ZIP. Public media and other non-installable runtime assets are included.

Conversion preserves container orientation and available capture-time metadata before producing an EXIF/GPS-stripped JPEG. Limits: 12 MB input, 40 megapixels, primary still frame, JPEG output bounded to 1600 pixels. A naive EXIF clock is retained as metadata without inventing a timezone or verified capture date. Both yard and leaf flows share this path. Image conversion being local does not make recognition local: configured Gemini/PlantNet receive the normalized image for identification.

## Configure your own services

Copy `.env.example` to `.env.local` and fill it locally. Never reuse the sender’s project, credentials, profiles, bucket data, or `.local` folder. The shipped template contains variable names with empty values only.

| Purpose | Variables |
| --- | --- |
| Yard/leaf identification | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` |
| Optional second identification provider | `PLANTNET_API_KEY`, `PLANTNET_PROJECT` |
| Your account project | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Shared botanical cache, server only | `SUPABASE_SERVICE_ROLE_KEY` |
| Optional administrative migration tooling / supported management fallback | `SUPABASE_ACCESS_TOKEN` |
| Optional email sign-in configuration | `ENABLE_PUBLIC_EMAIL_AUTH`, `EMAIL_DELIVERY_MODE` |
| Development-only QA switches, disabled by default | `NATIVEYARD_RUNTIME`, `NATIVEYARD_QA_AUTH` |

Select Gemini model names available to your account rather than assuming the sender’s access. No keys are entered through the UI. Never put a service-role key, management token, OAuth secret, or password in a `NEXT_PUBLIC_` variable. The public Supabase anon key does not grant administrative setup privileges.

### Supabase: fresh project and migrations

Create your own Supabase project. In its SQL editor, apply `supabase/schema.sql`, then every SQL file in `supabase/migrations/` in filename order. Review migrations before applying to an existing populated project. The current additive migrations include:

- `20261105_auto_yard_plan.sql`: automatic task identity, justified date windows, provenance, and deduplication index on the existing task table.
- `20261105_species_reference_cache.sql`: shared botanical-only reference cache with expiry and version provenance, RLS and restricted privileges.

Keep personal survey photos in the **private** `nativeyard-surveys` bucket with owner-folder access policies. Personal property/area/survey/task rows use ownership RLS. The shared species cache is separate, holds no user photos/account records, and denies direct browser writes. Its app-server adapter uses a server-only service-role key, or the supported host-held management-token fallback. Without privileged cache credentials, reference lookup can still return data but durable cache writes must not be reported as successful.

If you explicitly authorize management tooling on your own project, the included scripts read your ignored `.env.local` and never print credentials:

```sh
node scripts/setup-supabase.mjs --apply
node scripts/apply-auto-plan.mjs --apply
node scripts/apply-species-cache.mjs --apply
```

Do not point these scripts at the sender’s project. The base schema plus migration scripts establish structure; they do not copy private data or verify recipient authentication/account behavior.

### Google sign-in

Create your own Google OAuth web client and configure the Google provider in **your Supabase project** with its client ID and secret. The Google-authorized redirect URI is `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`. The app’s callback is a separate redirect target: allow `http://localhost:3100/auth/callback` and, if used, `http://127.0.0.1:3100/auth/callback` in Supabase. Set the local Site URL accordingly. Production origins require their own exact HTTPS callback URLs. The Gemini API key is not a Google OAuth client secret.

Restart the dev server after environment changes. Rebuild production output when public build-time environment values change. Email authentication requires your own delivery setup and received-code/session verification; do not treat requesting a code as signing in. Leave development QA bypass flags off in any deployed environment.

## Optional verification and deployment

When you choose to validate your installation, run the included tests and checks. These commands are instructions for the recipient; they were not executed in this packaging pass:

```sh
npm test
npm run lint
npm run build
npm run typecheck
npm start -- --hostname 127.0.0.1 --port 3100
```

Build before the final fresh-install typecheck so generated Next route types exist. Before deploying, verify your own provider results, Google consent/session return, save/reload, two-account isolation, private photo access, automatic-plan deduplication/complete/undo, selected-area deep links/Back/refresh, HEIC uploads, keyboard/mobile behavior, and print output. A build or packaging scan is not browser acceptance or proof of recipient account persistence.

For a Next-capable production host, use `npm ci`, `npm run build`, and its supported Next start/integration workflow. Set your own build-time public variables and server secrets, apply the database migrations, configure production callback origins, and ensure the traced local HEIC package assets are present. Do not serve this as static HTML or copy a sender-specific `.next` folder. Deployment/provider plans and any paid resources require your authorization; this handoff does not create or deploy them.

## Product boundaries

Automatic plans derive from saved, in-yard observations and source-backed actions. Unreviewed identities create review suggestions; unknown timing remains undated. Task completion does not modify an ecological measurement. Species missing from the small catalog are not automatically non-native. Saved scores preserve their original evidence/version, and photo comparison gates remain separate from a task checklist or a named photo spot. Samples and public botanical reference imagery do not establish real-property outcomes.
