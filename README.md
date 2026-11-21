# BAZARSPORT

Source of the existing BAZARSPORT Site, synchronized from deployed Sites version 16
(commit `fc0890f7ca34f4e3904c2b9038eaf5f0f72f7331`) before applying the changes in this branch.
This is not a new website or a new database. Production remains https://bazarsport.eu.

## Architecture and entry points

- `public/index.html`, `public/style.css`: existing cinematic homepage and visual identity.
- `app/predictions`: today's approved predictions, Europe/Sofia calendar day.
- `app/results`: compact dated history (league, teams, market/choice, odds, slip outcome).
- `app/statistics`: verified WIN/LOSS/VOID, success rate and ROI.
- `app/mobile`: existing installable PWA, with separate prediction/result/statistic tabs.
- `app/admin`: existing owner-only editorial panel at https://bazarsport.eu/admin.
- `app/api/drafts`: owner-only creation/editing/approval/rejection.
- `app/api/public`: published data only; excludes owner identities and slip photographs.
- `app/mcp`: ChatGPT integration, creates drafts only; never approves or publishes.
- `lib/editorial.ts`: validation, settlement, reporting and audit events.
- `db/schema.ts`, `drizzle/`: existing Cloudflare D1 tables and initial migration.
- `worker/index.ts`: Vinext/React server on Cloudflare Workers via Sites.
- `.openai/hosting.json`: **existing** Site ID and DB binding; preserve it.
- `legacy-static/`: untouched files from the previous GitHub snapshot, retained for reference.

GitHub previously held a flat static export, with broken paths to `assets/`,
`data/` and `predictions/`, and no admin or database. The production source already
had those features. This branch brings them into GitHub without copying runtime data.
The root `index.html` redirects GitHub Pages visitors to the existing live Site;
GitHub Pages cannot run the authenticated backend or D1 database.

## Development / validation

Node >=22.13.0. Run `npm run install:ci`, `npm run typecheck`, `npm test`,
`npm run build`. Use `npm run dev` for local development. For a local DB use Wrangler's
**local** D1 migration command against binding `DB`; never run migrations against production
as part of reviewing this PR. No live database is embedded in this repository.
Without a configured local DB, public API requests fail and the UI reports unavailable data.

## Authentication / hosting boundary

Production relies on Sites' trusted gateway to verify ChatGPT sign-in and overwrite
`oai-authenticated-user-*` headers. `OWNER_EMAIL` is a protected runtime variable;
missing configuration denies all writes. API mutations also reject cross-site requests.
Do not expose the Worker directly on a host that accepts spoofed identity headers.
A move away from Sites requires replacing the identity adapter with verified sessions.
No credentials, owner email, database contents or API keys belong in GitHub.

## Editorial and reporting rules

All new records are drafts. The owner uses **Одобри и публикувай**, **Редактирай** or
**Отхвърли**. Upload a PNG/JPEG/WebP slip up to 500 KB (or supply its HTTPS URL).
Only the owner can see stored slip images. Existing category IDs remain `elite` and
`quantbet`; visible names are CORNER HUNTER and BET STRIKE.

CORNER HUNTER accepts owner-slip odds, requires fixture confirmation and 1H corners
3-way W1; a first-half corner draw loses. BET STRIKE retains its odds-source rules.
Results require evidence and owner approval. A confirmed result moves a slip out of
predictions immediately; old unverified slips remain explicitly UNVERIFIED in history.
No result is inferred merely because kickoff has passed. No external automatic sports
result provider is connected by this PR.

Statistics use the entire published history, deduplicate results and exclude orphans
and UNVERIFIED. Fixed virtual stake: 1 per slip. Success rate = WIN/(WIN+LOSS).
ROI = net profit / all verified stakes, including refunded VOID stakes.
A partially void combination must not be recorded as a full-odds WIN; per-leg void
recalculation is not implemented. Published historical records are not deleted.

Team logos are optional verified HTTPS URLs (`homeLogo`/`awayLogo`) entered by the owner
in the existing form or MCP draft. Failed images fall back gracefully. No unverified
club-to-logo mapping or external paid subscription is added.

## Release

This PR does **not** deploy. Tests/builds do not publish, and the CI workflow has no
production credentials or deployment step. Merge/release only after owner approval.
Deploy the reviewed source to the **existing** Sites project and existing D1 binding;
never create a replacement database or rerun the initial migration on an existing DB.
