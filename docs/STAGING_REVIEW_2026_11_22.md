# Staging review — 22 November 2026

This is an intermediate review, not a deployment certificate.

## Verified
- PR #8 base is main ef0c1b6; branch head before this review ff4a88d.
- Existing Sites reports version 20 and bazarsport.eu. Live DB binding is DB; user tables are editorial_entries and editorial_audit.
- npm test, npm run typecheck, npm run build:staging and npm run deploy:staging -- --dry-run passed locally.
- Generated artifact has exactly the supplied staging D1 ID, no domain routes, and workers_dev/preview_urls disabled.

## Fixed in this review
- Standalone build cannot fall back to trusting incoming Sites identity headers when runtime auth mode is removed or changed.
- Cookie-authenticated mutations require an exact same-origin Origin header; cross-site requests are rejected before application routing.
- GET logout displays a confirmation form; only same-origin POST clears cookies.
- Guarded deployment command rejects wrong Worker, wrong database, routes, or auth mode and deploys only the compiled artifact.

## Not yet verified / blockers
- Cloudflare dashboard authentication is awaiting Google's device confirmation. No Worker or secret was modified in this review.
- No actual staging deploy, remote schema migration, full OAuth round trip, or automatic deploy test has occurred.
- Sites row-reader truncates some payload values. Its output is NOT a full backup. Use a supported lossless database export, then verify all rows, payload hashes, relationships and audit history after test restore. Do not cut over on the basis of this bounded reader.
- AI BET is not a distinct accepted category in this branch; only elite and quantbet are defined.
- Existing ChatGPT scheduled tasks and connector capability bindings are not automatically portable to standalone Workers.
- Stateless session logout clears the browser cookie; a stolen signed cookie remains valid until expiry or key rotation. Server-side revocation is not yet implemented.
- The additional result-replacement/old-admin compatibility fix in Sites source 3657b42 is not in PR #8 and has not been deployed in this review.

## Intended independent deployment setup (not configured yet)
Use Cloudflare Workers Builds with this repository and an approved staging branch. Build command: npm run install:ci && npm test && npm run typecheck && npm run build:staging. Deploy command: npm run deploy:staging. Configure runtime secrets in Cloudflare only. Use required PR checks and owner-controlled merges before the deployment branch advances. Verify an actual pushed harmless change and its live response. No production deploy workflow should run until backup restoration and owner cutover approval.

Before enabling workers.dev, verify OAuth app callback, runtime secrets and owner ID in the actual account. Use only bazarsport-staging D1 for schema/restore testing. Keep production in Sites and retain its database for rollback. Future production requires a separate explicit configuration and database; do not reuse staging data or secrets.

Rollback: retain the last known-good Worker version and database backup. Code rollback does not roll back D1 writes. Avoid destructive schema changes and stop writes during final snapshot/cutover. Record exact source SHA, Worker version, backup checksum and restored row counts before requesting final DNS approval.

## Follow-up runtime verification
The compiled artifact initially failed to start: nodejs_compat was duplicated by Vite overrides, and the configured date exceeded the pinned workerd binary's supported 2026-05-22 date. Removed the redundant flag override and pinned staging compatibility to 2026-05-22. The actual compiled Worker now starts locally and returns 503 for forged Sites identity with an invalid standalone auth mode. Added scripts/smoke-staging.mjs to CI after staging build/dry-run. Local typecheck, staging build, runtime smoke and dry-run passed. No remote deployment or remote DB mutation was performed. Cloudflare dashboard still requires authentication.
