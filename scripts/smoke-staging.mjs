import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
assert.equal(config.name, 'bazarsport-staging');
assert.equal(new Set(config.compatibility_flags).size, config.compatibility_flags.length,
  'Duplicate compatibility flags prevent Workers runtime startup');
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
// No remote bindings or real credentials: exercise the actual compiled Worker.
const child = spawn(process.execPath, [wrangler, 'dev', '--config', 'dist/server/wrangler.json',
  '--local', '--ip', '127.0.0.1', '--port', '8799', '--inspector-port', '0',
  '--var', 'BAZARSPORT_AUTH_MODE:invalid-smoke-test'], { stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { logs = (logs + chunk).slice(-8000); });
try {
  const deadline = Date.now() + 30000;
  let response;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Worker exited before startup: ' + logs);
    try {
      response = await fetch('http://127.0.0.1:8799/api/drafts', { headers: {
        'oai-authenticated-user-id': 'forged', 'oai-authenticated-user-email': 'forged@example.test',
      }, signal: AbortSignal.timeout(1000) });
      break;
    } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(response, 'Local Worker did not start: ' + logs);
  assert.equal(response.status, 503);
  assert.equal(await response.text(), 'Authentication configuration error');
  console.log('PASS: compiled staging Worker starts and refuses spoofed identity with invalid auth mode');
} finally {
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
  timer.unref();
}
