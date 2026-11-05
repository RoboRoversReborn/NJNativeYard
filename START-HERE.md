# NativeYard — start here

Source release **R22 · November 5, 2026**, matching local build **ObXO_WyiXf2AyVLtIvPDd**.

Open the extracted `nativeyard` folder in VS Code. This ZIP contains application source, public media, the dependency lockfile, and database migrations. It does **not** contain installed dependencies, a compiled application, credentials, personal photos, account records, or the sender’s database.

1. Read `RELEASE-RECEIPT.json`. Its validation limits apply to this release. Final acceptance testing was deferred at the owner’s request.
2. Verify extracted files: `node scripts/verify-handoff.mjs`.
3. Use Node **24.x or newer** and npm. The sender used **Node 25.2.1**. Node 24 satisfies the locked development dependencies and the Node test-loader APIs; an install on your machine has not been performed by the sender.
4. Run `npm ci`. Keep the lockfile. npm installs the correct platform’s dependencies, including Sharp’s native package and the bundled local HEIC WASM decoder. Do not copy another machine’s `node_modules` or binaries.
5. Run `npm run dev -- --hostname 127.0.0.1 --port 3100`, then open **http://localhost:3100**. The catalog and illustrative samples work without provider credentials.
6. For scanning and accounts, follow **docs/PRODUCTION-HANDOFF.md** and use your own services. Copy `.env.example` to `.env.local`; all template values are intentionally empty. Keep `.env.local` out of Git.

**Copilot:** paste the prompt in **docs/COPILOT-SETUP-PROMPT.md** into GitHub Copilot Agent with this folder open. It covers installation, your own Supabase setup, Google authentication, API configuration, and optional deployment.

The release includes automatic yard-plan generation/checklists, focused area overviews, personal header navigation, local HEIC/HEIF conversion, source-based plant enrichment with a shared botanical cache, and the latest layout fixes. Task checkoff is a record of work, not a measured ecosystem improvement. Unsupported plant identities/origins remain review states.

For a local production run, after setting your environment:

```sh
npm run build
npm start -- --hostname 127.0.0.1 --port 3100
```

Do not run a new build into a build directory used by a running instance. Stop that instance first or use a separate `NATIVEYARD_DIST_DIR`. No deployment or external upload has been performed by this handoff.
