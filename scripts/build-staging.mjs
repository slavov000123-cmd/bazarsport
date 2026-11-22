import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Explicit staging build. Normal npm run build remains the Sites build.
// Do not add this command to the main branch's production deployment workflow
// until Cloudflare Access, test D1 schema and staging validation are complete.
const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const command = spawnSync(process.execPath, [vite, "build"], {
  stdio: "inherit",
  env: { ...process.env, BAZARSPORT_STAGING_BUILD: "1" },
});
if (command.error) throw command.error;
process.exit(command.status ?? 1);
