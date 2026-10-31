/**
 * USAMarket live-site Worker runtime.
 *
 * Static website files are served through the ASSETS binding. API routes are
 * evaluated first so dynamic endpoints can be added without changing the
 * existing site files or routing the site through a second Worker.
 */
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health" || url.pathname === "/api/health") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method_not_allowed" }, 405);
      }
      return json({
        service: "usamarket-live",
        status: "worker-runtime-active",
        assets: Boolean(env.ASSETS),
        admitadFeed: "not_configured"
      });
    }

    if (url.pathname === "/api/admitad/products") {
      if (request.method !== "GET") {
        return json({ error: "method_not_allowed" }, 405);
      }
      // Deliberately fail closed until the real Admitad OAuth/feed flow is
      // configured. The storefront can fall back to its static catalogue.
      return json({
        error: "product_feed_not_configured",
        message: "The live product feed is not configured yet."
      }, 503);
    }

    if (!env.ASSETS) {
      return json({ error: "static_assets_binding_missing" }, 500);
    }

    return env.ASSETS.fetch(request);
  }
};
