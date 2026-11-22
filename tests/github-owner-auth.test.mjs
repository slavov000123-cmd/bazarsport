import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";

const scope = {
  exports: {},
  atob, btoa, crypto: webcrypto, TextEncoder, TextDecoder,
  Request, Response, Headers, URL, Date, Object, Uint8Array,
};
vm.runInNewContext(ts.transpileModule(readFileSync("lib/github-owner-auth.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, scope);
const { githubOwnerGateway } = scope.exports;
const base = "https://bazarsport-staging.example.workers.dev";
const env = {
  BAZARSPORT_AUTH_MODE: "github-oauth",
  GITHUB_AUTH_ORIGIN: base,
  GITHUB_CLIENT_ID: "public-client-id",
  GITHUB_CLIENT_SECRET: "private-test-secret",
  AUTH_SESSION_KEY: "a-long-random-auth-key-at-least-32-characters-for-test",
  GITHUB_OWNER_ID: "334568071",
  OWNER_EMAIL: "test-owner@example.test",
};
const mock = async (url, options) => {
  if (url === "https://github.com/login/oauth/access_token") {
    assert.equal(options.method, "POST");
    const body = JSON.parse(options.body);
    assert.equal(body.client_id, env.GITHUB_CLIENT_ID);
    assert.equal(body.client_secret, env.GITHUB_CLIENT_SECRET);
    assert.match(body.code_verifier, /^[A-Za-z0-9_-]{43,128}$/);
    assert.equal(body.redirect_uri, base + "/auth/github/callback");
    return new Response(JSON.stringify({ access_token: "access-token", token_type: "bearer" }));
  }
  if (url === "https://api.github.com/user") {
    assert.equal(options.headers.Authorization, "Bearer access-token");
    return new Response(JSON.stringify({ id: 334568071, login: "slavov000123-cmd" }));
  }
  throw new Error("Unexpected fetch: " + url);
};
const start = await githubOwnerGateway(new Request(base + "/signin-with-chatgpt?return_to=%2Fadmin"), env, mock);
assert.equal(start.status, 302);
const authorize = new URL(start.headers.get("location"));
assert.equal(authorize.origin, "https://github.com");
assert.equal(authorize.pathname, "/login/oauth/authorize");
assert.equal(authorize.searchParams.get("redirect_uri"), base + "/auth/github/callback");
assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
assert.match(authorize.searchParams.get("code_challenge"), /^[A-Za-z0-9_-]{43}$/);
assert.equal(authorize.searchParams.get("scope"), "read:user");
const oauthCookie = start.headers.get("set-cookie").split(";")[0];
assert.match(oauthCookie, /^__Host-bazarsport_oauth=/);
assert.match(start.headers.get("set-cookie"), /Secure; HttpOnly; SameSite=Lax/);
const state = authorize.searchParams.get("state");
const callback = base + "/auth/github/callback?code=valid-code&state=" + state;

const missingState = await githubOwnerGateway(new Request(callback), env, mock);
assert.equal(missingState.status, 403);
const incorrectState = await githubOwnerGateway(new Request(callback + "wrong", {
  headers: { Cookie: oauthCookie },
}), env, mock);
assert.equal(incorrectState.status, 403);

const noConfig = await githubOwnerGateway(new Request(base + "/admin", {
  headers: { "oai-authenticated-user-id": "forged", "oai-authenticated-user-email": env.OWNER_EMAIL },
}), { ...env, AUTH_SESSION_KEY: "" }, mock);
assert.equal(noConfig.status, 503);

const login = await githubOwnerGateway(new Request(callback, { headers: { Cookie: oauthCookie } }), env, mock);
assert.equal(login.status, 302);
assert.equal(login.headers.get("location"), "/admin");
const sessionCookie = login.headers.getSetCookie().find((h) => h.startsWith("__Host-bazarsport_session=")).split(";")[0];
assert.match(sessionCookie, /^__Host-bazarsport_session=/);
const sessionReq = new Request(base + "/api/drafts", {
  headers: {
    Cookie: sessionCookie,
    "oai-authenticated-user-id": "forged-id",
    "oai-authenticated-user-email": "forged@example.test",
    "oai-authenticated-user-full-name": "attacker",
  },
});
const valid = await githubOwnerGateway(sessionReq, env, mock);
assert.ok(valid instanceof Request);
assert.equal(valid.headers.get("oai-authenticated-user-id"), "github:334568071");
assert.equal(valid.headers.get("oai-authenticated-user-email"), env.OWNER_EMAIL);
assert.equal(valid.headers.get("oai-authenticated-user-full-name"), null);

const unsigned = await githubOwnerGateway(new Request(base + "/api/drafts", {
  headers: {
    "oai-authenticated-user-id": "forged-id",
    "oai-authenticated-user-email": env.OWNER_EMAIL,
  },
}), env, mock);
assert.equal(unsigned.headers.get("oai-authenticated-user-id"), null);
assert.equal(unsigned.headers.get("oai-authenticated-user-email"), null);

const wrong = await githubOwnerGateway(new Request(callback, { headers: { Cookie: oauthCookie } }), env,
  async (url, options) => url.includes("access_token")
    ? new Response(JSON.stringify({ access_token: "access-token", token_type: "bearer" }))
    : new Response(JSON.stringify({ id: 999999999 })));
assert.equal(wrong.status, 403);
const malformed = await githubOwnerGateway(new Request(base + "/admin", {
  headers: { Cookie: sessionCookie + "tampered", "oai-authenticated-user-id": "forged" },
}), env, mock);
assert.equal(malformed.headers.get("oai-authenticated-user-id"), null);

const signout = await githubOwnerGateway(new Request(base + "/signout-with-chatgpt?return_to=%2F"), env, mock);
assert.equal(signout.status, 302);
assert.equal(signout.headers.get("location"), "/");
assert.match(signout.headers.getSetCookie().join("\n"), /Max-Age=0/);

const maliciousReturn = await githubOwnerGateway(new Request(base + "/signin-with-chatgpt?return_to=%2F%2Fevil.test"), env, mock);
const maliciousCookie = maliciousReturn.headers.get("set-cookie").split(";")[0];
const maliciousState = new URL(maliciousReturn.headers.get("location")).searchParams.get("state");
const maliciousLogin = await githubOwnerGateway(new Request(base + "/auth/github/callback?code=valid-code&state=" + maliciousState, {
  headers: { Cookie: maliciousCookie },
}), env, mock);
assert.equal(maliciousLogin.headers.get("location"), "/admin");
console.log("PASS: GitHub owner OAuth uses PKCE, state, signed cookies and rejects forged identity");
