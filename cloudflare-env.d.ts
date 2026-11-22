declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Only set in the separately hosted staging Worker. */
    BAZARSPORT_AUTH_MODE?: "cloudflare-access" | "sites";
    TEAM_DOMAIN?: string;
    POLICY_AUD?: string;
    OWNER_EMAIL?: string;
  }
}
