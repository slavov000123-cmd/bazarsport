# Migration status — 2026-11-23

The production Sites project remains authoritative. Sites version 21 (source 594c257e46b1520dbcf007b6082cfe385a9f7ea5) contains the compact results table. This change copies that component into the staging branch. GitHub main remains ef0c1b627bd2005c3bd4e892f693e0af1a4ead9c; PR #8 is not merged.

Verified locally: application tests, owner OAuth tests (PKCE, state, signed cookies, owner ID, forged identity and CSRF rejection), typecheck, staging build, and compiled-Worker fail-closed smoke test.

Previously verified by Cloudflare build log: automatic staging deploy from commit 030d045. This is not evidence that OAuth or the staging schema works remotely.

Blocked: Cloudflare dashboard session is not authenticated. OAuth runtime secrets, staging D1 tables, live admin login and public test URL have not been verified. Keep workers_dev and preview_urls disabled until runtime setup is complete.

Original database: Sites row tools truncate some payloads even at one row per page. Those responses are NOT a complete backup. No original records were deleted. A full archive and successful restore remain prerequisites for production migration.

No production D1 was provisioned. No DNS changes, production domain attachment or PR #8 merge were performed. Final cutover requires the owner's explicit approval after all checks.
