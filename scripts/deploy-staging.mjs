import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Deploy only compiled staging output; never fall through to Sites configuration.
const configPath = 'dist/server/wrangler.json';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config.name !== 'bazarsport-staging' ||
    config.vars?.BAZARSPORT_AUTH_MODE !== 'github-oauth' ||
    config.d1_databases?.length !== 1 ||
    config.d1_databases[0].binding !== 'DB' ||
    config.d1_databases[0].database_id !== '660089ce-a295-4f89-b863-8d335d02ac69' ||
    config.routes?.length || config.route || config.preview_urls !== false) {
  throw new Error('Refusing deployment: output is not the isolated staging Worker. Run npm run build:staging.');
}
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--dry-run')) throw new Error('Only --dry-run is supported.');
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const result = spawnSync(process.execPath, [wrangler, 'deploy', '--config', configPath, ...args], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
