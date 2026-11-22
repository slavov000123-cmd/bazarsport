/**
 * Cloudflare Access gateway for the *separate* BAZARSPORT staging Worker.
 * Production Sites has a different authentication trust boundary.
 * Client-supplied oai-authenticated-user-* headers are never trusted.
 */
export type StagingAccessConfig = {
  TEAM_DOMAIN?: string;
  POLICY_AUD?: string;
  OWNER_EMAIL?: string;
};

type RemoteKey = JsonWebKey & { kid?: string };
type RemoteKeyResponse = { keys?: RemoteKey[] };
const keyCache = new Map<string, { keys: RemoteKey[]; validUntil: number }>();

const isValidTeamDomain = (value: string): boolean =>
  /^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(value);

function decodePart(value: string): unknown {
  if (!/^[a-zA-Z0-9_-]+$/.test(value) || value.length > 16000) throw Error("Invalid JWT part");
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0))));
}

function decodeSignature(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[a-zA-Z0-9_-]+$/.test(value) || value.length > 16000) throw Error("Invalid JWT signature");
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

async function trustedKeys(domain: string, kid: string, fetcher: typeof fetch): Promise<RemoteKey[]> {
  const previous = keyCache.get(domain);
  if (previous && previous.validUntil > Date.now() && previous.keys.some((key) => key.kid === kid)) {
    return previous.keys;
  }

  const response = await fetcher(`${domain}/cdn-cgi/access/certs`, {
    redirect: "error",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw Error("Access keys are unavailable");
  const body: RemoteKeyResponse = await response.json();
  if (!Array.isArray(body.keys) || body.keys.length > 32) throw Error("Invalid key set");
  const keys = body.keys.filter((key) =>
    key && key.kty === "RSA" && typeof key.kid === "string" &&
    typeof key.n === "string" && typeof key.e === "string" &&
    (!key.alg || key.alg === "RS256") && (!key.use || key.use === "sig")
  );
  keyCache.set(domain, { keys, validUntil: Date.now() + 5 * 60 * 1000 });
  return keys;
}

/** Verify signature + issuer + audience + expiry + matching owner identity. */
export async function verifiedAccessOwner(
  jwt: string | null,
  config: StagingAccessConfig,
  fetcher: typeof fetch = fetch,
): Promise<{ userId: string; email: string } | null> {
  if (!jwt || jwt.length > 16000) return null;
  const { TEAM_DOMAIN: domain, POLICY_AUD: audience, OWNER_EMAIL: ownerEmail } = config;
  if (!domain || !isValidTeamDomain(domain) || !audience || !ownerEmail) return null;

  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);
    if (!header || typeof header !== "object" || !payload || typeof payload !== "object") return null;
    const jwtHeader = header as { alg?: unknown; kid?: unknown };
    const claims = payload as { iss?: unknown; aud?: unknown; exp?: unknown; nbf?: unknown; sub?: unknown; email?: unknown };
    if (jwtHeader.alg !== "RS256" || typeof jwtHeader.kid !== "string" || !jwtHeader.kid) return null;

    const keys = await trustedKeys(domain, jwtHeader.kid, fetcher);
    const matchingKey = keys.find((key) => key.kid === jwtHeader.kid);
    if (!matchingKey) return null;
    const key = await crypto.subtle.importKey(
      "jwk", matchingKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    const signedContent = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeSignature(parts[2]), signedContent)) return null;

    const now = Math.floor(Date.now() / 1000);
    const audMatch = claims.aud === audience ||
      (Array.isArray(claims.aud) && claims.aud.includes(audience));
    if (claims.iss !== domain || !audMatch ||
        typeof claims.exp !== "number" || claims.exp <= now ||
        (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > now)) ||
        typeof claims.sub !== "string" || !claims.sub ||
        typeof claims.email !== "string" || claims.email.toLowerCase() !== ownerEmail.toLowerCase()) {
      return null;
    }

    return { userId: `cloudflare-access:${claims.sub}`, email: claims.email };
  } catch {
    // Network, unknown key, malformed JWT and signature failures all fail closed.
    return null;
  }
}

/** Replace all untrusted identity headers with cryptographically verified identity. */
export async function authenticateStagingRequest(
  request: Request,
  config: StagingAccessConfig,
  fetcher: typeof fetch = fetch,
): Promise<Request | null> {
  const owner = await verifiedAccessOwner(
    request.headers.get("cf-access-jwt-assertion"), config, fetcher,
  );
  if (!owner) return null;
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith("oai-authenticated-user-")) headers.delete(name);
  }
  headers.set("oai-authenticated-user-id", owner.userId);
  headers.set("oai-authenticated-user-email", owner.email);
  return new Request(request, { headers });
}
