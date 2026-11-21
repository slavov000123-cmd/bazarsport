import { env } from "cloudflare:workers";

// The owner email is set in the Site's protected runtime configuration.
// If it is absent, fail closed: no writes are permitted.
export function isOwnerEmail(email: string | null | undefined): boolean {
  const configured = (env as Cloudflare.Env & { OWNER_EMAIL?: string }).OWNER_EMAIL;
  return Boolean(configured && email && email.toLowerCase() === configured.toLowerCase());
}

export function ownerFromRequest(request: Request): string | null {
  if (!["GET","HEAD","OPTIONS"].includes(request.method)) {
    if (request.headers.get("sec-fetch-site") === "cross-site") return null;
    const origin=request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return null;
  }
  const email = request.headers.get("oai-authenticated-user-email");
  const id = request.headers.get("oai-authenticated-user-id");
  return id && isOwnerEmail(email) ? id : null;
}
