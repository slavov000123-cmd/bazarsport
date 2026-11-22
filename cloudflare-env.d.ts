declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Only set in the separately hosted staging Worker. */
    BAZARSPORT_AUTH_MODE?: "cloudflare-access" | "github-oauth" | "sites";
    TEAM_DOMAIN?: string;
    POLICY_AUD?: string;
    OWNER_EMAIL?: string;
    GITHUB_AUTH_ORIGIN?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GITHUB_OWNER_ID?: string;
    AUTH_SESSION_KEY?: string;
  }
}
