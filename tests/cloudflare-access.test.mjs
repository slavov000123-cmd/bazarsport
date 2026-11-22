import { readFileSync } from 'node:fs';
import { createSign, generateKeyPairSync, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';

// Test the actual TypeScript source with signed JWTs; no Cloudflare account or
// production database is needed.
const context = {
  exports: {}, atob, crypto: webcrypto, TextDecoder, TextEncoder,
  Headers, Request, Date, Map,
  fetch: async () => { throw Error('Unexpected network call'); },
};
const source = readFileSync('lib/cloudflare-access.ts', 'utf8');
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { verifiedAccessOwner, authenticateStagingRequest } = context.exports;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
jwk.kid = 'staging-key'; jwk.alg = 'RS256'; jwk.use = 'sig';
const fetcher = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
const config = {
  TEAM_DOMAIN: 'https://bazarsport.cloudflareaccess.com',
  POLICY_AUD: 'expected-aud',
  OWNER_EMAIL: 'owner@example.test',
};
const base64url = (item) => Buffer.from(JSON.stringify(item)).toString('base64url');
const token = (claims, header = { alg: 'RS256', kid: 'staging-key' }) => {
  const data = `${base64url(header)}.${base64url(claims)}`;
  const signature = createSign('RSA-SHA256').update(data).end().sign(privateKey).toString('base64url');
  return `${data}.${signature}`;
};
const now = Math.floor(Date.now() / 1000);
const claims = {
  iss: config.TEAM_DOMAIN, aud: [config.POLICY_AUD],
  exp: now + 600, nbf: now - 10,
  sub: 'verified-user-123', email: 'owner@example.test',
};
const validToken = token(claims);
assert.equal((await verifiedAccessOwner(validToken, config, fetcher))?.email, 'owner@example.test');
assert.equal(await verifiedAccessOwner(token({ ...claims, exp: now - 1 }), config, fetcher), null);
assert.equal(await verifiedAccessOwner(token({ ...claims, nbf: now + 600 }), config, fetcher), null);
assert.equal(await verifiedAccessOwner(token({ ...claims, aud: ['wrong-aud'] }), config, fetcher), null);
assert.equal(await verifiedAccessOwner(token({ ...claims, iss: 'https://evil.example.test' }), config, fetcher), null);
assert.equal(await verifiedAccessOwner(token({ ...claims, email: 'attacker@example.test' }), config, fetcher), null);
assert.equal(await verifiedAccessOwner(token({ ...claims, sub: '' }), config, fetcher), null);
assert.equal(await verifiedAccessOwner(validToken, { ...config, TEAM_DOMAIN: 'http://evil.test' }, fetcher), null);
assert.equal(await verifiedAccessOwner(validToken, { ...config, POLICY_AUD: '' }, fetcher), null);
assert.equal(await verifiedAccessOwner(validToken, { ...config, OWNER_EMAIL: '' }, fetcher), null);
assert.equal(await verifiedAccessOwner(validToken.slice(0, -3) + 'bad', config, fetcher), null);
assert.equal(await verifiedAccessOwner(token(claims, { alg: 'none', kid: 'staging-key' }), config, fetcher), null);
const forged = new Request('https://staging.example.test/admin', {
  headers: {
    'oai-authenticated-user-id': 'fake-id',
    'oai-authenticated-user-email': 'owner@example.test',
  },
});
assert.equal(await authenticateStagingRequest(forged, config, fetcher), null);
const request = new Request('https://staging.example.test/admin', {
  headers: {
    'cf-access-jwt-assertion': validToken,
    'oai-authenticated-user-id': 'attacker',
    'oai-authenticated-user-full-name': 'spoofed',
    'oai-authenticated-user-email': 'attacker@example.test',
  },
});
const verified = await authenticateStagingRequest(request, config, fetcher);
assert.equal(verified.headers.get('oai-authenticated-user-id'), 'cloudflare-access:verified-user-123');
assert.equal(verified.headers.get('oai-authenticated-user-email'), 'owner@example.test');
assert.equal(verified.headers.get('oai-authenticated-user-full-name'), null);
console.log('PASS: staging verifies signed Cloudflare Access JWT and overwrites spoofed identity headers');
