import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { authenticateStagingRequest } from "../lib/cloudflare-access";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    // A separate Cloudflare staging Worker must verify signed Access identity
    // before forwarding anything to existing Sites-compatible routes.
    if (env.BAZARSPORT_AUTH_MODE === "cloudflare-access") {
      const authenticated = await authenticateStagingRequest(request, env);
      if (!authenticated) {
        return new Response("Access denied", {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        });
      }
      request = authenticated;
    } else if (env.BAZARSPORT_AUTH_MODE && env.BAZARSPORT_AUTH_MODE !== "sites") {
      return new Response("Authentication configuration error", { status: 503 });
    }

    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
