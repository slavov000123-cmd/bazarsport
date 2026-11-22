/**
 * Owner-only GitHub OAuth for a separately hosted Cloudflare Worker.
 * No repository permissions or client-side shared passwords are required.
 * Existing ChatGPT Sites authentication remains unchanged.
 */
export type GitHubAuthEnv = {
  BAZARSPORT_AUTH_MODE?: string;
  GITHUB_AUTH_ORIGIN?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_OWNER_ID?: string;
  AUTH_SESSION_KEY?: string;
  OWNER_EMAIL?: string;
};
const sessionCookie = "__Host-bazarsport_session";
const flowCookie = "__Host-bazarsport_oauth";
const encoder = new TextEncoder();
const sessionLifetime = 12 * 60 * 60;
const flowLifetime = 10 * 60;
type Session = { version: 1; kind: "session"; sub: string; exp: number };
type Flow = { version: 1; kind: "flow"; state: string; verifier: string; returnTo: string; exp: number };
type Signed = Session | Flow;
type Fetcher = typeof fetch;

function configurationValid(env: GitHubAuthEnv): boolean {
  if (!env.GITHUB_AUTH_ORIGIN || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET ||
      !env.GITHUB_OWNER_ID || !env.AUTH_SESSION_KEY || !env.OWNER_EMAIL ||
      env.AUTH_SESSION_KEY.length < 32 || !/^\d+$/.test(env.GITHUB_OWNER_ID)) return false;
  try {
    const url = new URL(env.GITHUB_AUTH_ORIGIN);
    return url.protocol === "https:" && url.pathname === "/" &&
      url.search === "" && url.hash === "" && url.origin === env.GITHUB_AUTH_ORIGIN;
  } catch { return false; }
}

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 4096) throw Error("Malformed token");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - padded.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function nonce(): string {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}
async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), {
    name: "HMAC", hash: "SHA-256",
  }, false, ["sign", "verify"]);
}
async function sign(value: Signed, secret: string): Promise<string> {
  const data = encode(encoder.encode(JSON.stringify(value)));
  const signature = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(data));
  return data + "." + encode(new Uint8Array(signature));
}
async function readSigned(value: string | undefined, secret: string): Promise<Signed | null> {
  if (!value || value.length > 4096) return null;
  try {
    const parts = value.split(".");
    if (parts.length !== 2) return null;
    if (!await crypto.subtle.verify("HMAC", await key(secret), decode(parts[1]), encoder.encode(parts[0]))) return null;
    const result = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (!result || result.version !== 1 || !["session", "flow"].includes(result.kind) ||
        !Number.isSafeInteger(result.exp) || result.exp <= Math.floor(Date.now() / 1000)) return null;
    return result as Signed;
  } catch { return null; }
}
function cookies(request: Request): Record<string, string> {
  return Object.fromEntries((request.headers.get("cookie") ?? "").split(";").map((x) => {
    const idx = x.indexOf("=");
    return idx < 0 ? ["", ""] : [x.slice(0, idx).trim(), x.slice(idx + 1).trim()];
  }));
}
function setCookie(name: string, value: string, maxAge: number): string {
  return name + "=" + value + "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=" + maxAge;
}
function safeReturnTo(candidate: string | null): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return "/admin";
  try {
    const parsed = new URL(candidate, "https://local.invalid");
    return parsed.origin === "https://local.invalid" && !["/signin-with-chatgpt", "/signout-with-chatgpt", "/auth/github/callback"].includes(parsed.pathname)
      ? parsed.pathname + parsed.search : "/admin";
  } catch { return "/admin"; }
}
function redirect(destination: string): Response {
  return new Response(null, {
    status: 302, headers: { Location: destination, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
function denied(): Response {
  return new Response("Authentication denied", {
    status: 403, headers: { "Cache-Control": "no-store" },
  });
}

/**
 * For GitHub mode this function runs BEFORE the application routes.
 * It removes spoofable Sites identity headers from all requests.
 */
export async function githubOwnerGateway(
  request: Request,
  env: GitHubAuthEnv,
  fetcher: Fetcher = fetch,
): Promise<Request | Response> {
  if (!configurationValid(env)) return new Response("Authentication is not configured", { status: 503 });
  const origin = env.GITHUB_AUTH_ORIGIN!;
  const url = new URL(request.url);
  if (url.origin !== origin) return denied();
  // Require an exact same-origin proof for cookie-authenticated mutations.
  // This also covers logout, regardless of downstream route implementation.
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site")) return denied();
  const cookie = cookies(request);
  const secret = env.AUTH_SESSION_KEY!;
  const callback = origin + "/auth/github/callback";

  if (url.pathname === "/signin-with-chatgpt") {
    if (request.method !== "GET") return denied();
    const state = nonce();
    const verifier = nonce();
    const challenge = encode(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
    const flow: Flow = {
      version: 1, kind: "flow", state, verifier,
      returnTo: safeReturnTo(url.searchParams.get("return_to")),
      exp: Math.floor(Date.now() / 1000) + flowLifetime,
    };
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID!);
    authUrl.searchParams.set("redirect_uri", callback);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("scope", "read:user");
    const response = redirect(authUrl.toString());
    response.headers.append("Set-Cookie", setCookie(flowCookie, await sign(flow, secret), flowLifetime));
    return response;
  }

  if (url.pathname === "/auth/github/callback") {
    if (request.method !== "GET") return denied();
    const flow = await readSigned(cookie[flowCookie], secret);
    const receivedState = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!flow || flow.kind !== "flow" || !receivedState || flow.state !== receivedState ||
        !code || !/^[A-Za-z0-9_-]{1,256}$/.test(code) ||
        !/^[A-Za-z0-9_-]{43,128}$/.test(flow.verifier)) return denied();
    try {
      const tokenResponse = await fetcher("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code, redirect_uri: callback, code_verifier: flow.verifier,
        }),
        redirect: "error",
      });
      if (!tokenResponse.ok) return denied();
      const tokenInfo: { access_token?: unknown; token_type?: unknown; error?: unknown } = await tokenResponse.json();
      if (tokenInfo.error || typeof tokenInfo.access_token !== "string" || !tokenInfo.access_token ||
          String(tokenInfo.token_type).toLowerCase() !== "bearer") return denied();
      const userResponse = await fetcher("https://api.github.com/user", {
        headers: {
          Authorization: "Bearer " + tokenInfo.access_token,
          Accept: "application/vnd.github+json",
          "User-Agent": "BAZARSPORT-Staging",
        },
        redirect: "error",
      });
      if (!userResponse.ok) return denied();
      const user: { id?: unknown } = await userResponse.json();
      if (!Number.isSafeInteger(user.id) || String(user.id) !== env.GITHUB_OWNER_ID) return denied();
      const session: Session = {
        version: 1, kind: "session", sub: env.GITHUB_OWNER_ID!,
        exp: Math.floor(Date.now() / 1000) + sessionLifetime,
      };
      const response = redirect(flow.returnTo);
      response.headers.append("Set-Cookie", setCookie(flowCookie, "", 0));
      response.headers.append("Set-Cookie", setCookie(sessionCookie, await sign(session, secret), sessionLifetime));
      return response;
    } catch { return denied(); }
  }

  if (url.pathname === "/signout-with-chatgpt") {
    if (request.method === "GET") {
      return new Response('<!doctype html><html lang="bg"><meta charset="utf-8"><title>BAZARSPORT</title><form method="post" action="/signout-with-chatgpt?return_to=%2F"><button type="submit">Изход / Sign out</button></form></html>', {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" },
      });
    }
    if (request.method !== "POST") return denied();
    const response = redirect(safeReturnTo(url.searchParams.get("return_to")));
    response.headers.append("Set-Cookie", setCookie(sessionCookie, "", 0));
    response.headers.append("Set-Cookie", setCookie(flowCookie, "", 0));
    return response;
  }

  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith("oai-authenticated-user-")) headers.delete(name);
  }
  // Never let an invalid/missing session propagate a client-supplied identity.
  const signed = await readSigned(cookie[sessionCookie], secret);
  if (signed?.kind === "session" && signed.sub === env.GITHUB_OWNER_ID) {
    headers.set("oai-authenticated-user-id", "github:" + env.GITHUB_OWNER_ID);
    // This is a local alias assigned only *after* checking GitHub's immutable
    // numeric account ID. No GitHub public/private email scope is needed.
    headers.set("oai-authenticated-user-email", env.OWNER_EMAIL!);
  }
  return new Request(request, { headers });
}
