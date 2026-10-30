/**
 * USAMarket secure affiliate connector.
 * This first deployment is intentionally a health-check only.
 * OAuth routes will be enabled after Cloudflare secrets and KV are configured.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({
        service: "USAMarket Admitad connector",
        status: "ready-for-configuration",
        oauthConfigured: Boolean(
          env.ADMITAD_CLIENT_ID &&
          env.ADMITAD_CLIENT_SECRET &&
          env.ADMITAD_REDIRECT_URI
        )
      }, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
};
