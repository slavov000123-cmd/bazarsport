import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Explicitly isolated staging deployment. Production bazarsport.eu is never
// configured here and this command cannot attach routes or public URLs.
const configPath = 'dist/server/wrangler.json';
const config = JSON.parse(readFileSync(configPath, 'utf8'));

if (config.name !== 'bazarsport-staging' ||
    config.vars?.BAZARSPORT_AUTH_MODE !== 'github-oauth' ||
    config.vars?.GITHUB_OWNER_ID !== '334568071' ||
    config.d1_databases?.length !== 1 ||
    config.d1_databases[0].binding !== 'DB' ||
    config.d1_databases[0].database_id !== '660089ce-a295-4f89-b863-8d335d02ac69' ||
    config.routes?.length || config.route || config.custom_domains?.length ||
    config.workers_dev !== false || config.preview_urls !== false) {
  throw new Error('Refusing deployment: expected isolated private BAZARSPORT staging build. Run npm run build:staging.');
}
const args = process.argv.slice(2);
if (args.length !== 1 || !['--dry-run', '--release'].includes(args[0])) {
  throw new Error('Select --dry-run or --release; implicit deployment is forbidden.');
}
if (args[0] === '--release' && process.env.BAZARSPORT_STAGING_RELEASE !== '1') {
  throw new Error('Staging release requires BAZARSPORT_STAGING_RELEASE=1.');
}
const wranglerArgs = ['deploy', '--config', configPath];
if (args[0] === '--dry-run') wranglerArgs.push('--dry-run');
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const result = spawnSync(process.execPath, [wrangler, ...wranglerArgs], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
