/**
 * USAMarket live-site Worker runtime.
 * Product feed integration is server-side and isolated to /api/admitad/*.
 */
const CACHE_TTL_SECONDS = 1800;
const MAX_PRODUCTS = 5000;
const FEED_TIMEOUT_MS = 15000;
let memoryCache = { expiresAt: 0, products: null, updatedAt: null, source: null };

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers
    }
  });

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const first = (obj, keys) => {
  for (const key of keys) {
    const value = obj[key] ?? obj[key.toLowerCase()];
    if (value !== undefined && value !== null && clean(value) !== "") return value;
  }
  return "";
};
const safeHttpUrl = (value) => {
  try {
    const u = new URL(clean(value));
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch { return ""; }
};
const numberValue = (value) => {
  const normalized = clean(value).replace(/[,\s]/g, "").replace(/[^\d.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function parseCsv(text) {
  const sample = text.slice(0, 12000);
  const candidates = [",", ";", "\t", "|"];
  const delimiter = candidates.map(d => ({ d, count: (sample.split("\n")[0].split(d).length - 1) }))
    .sort((a, b) => b.count - a.count)[0]?.d || ",";
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === delimiter && !quoted) { row.push(field); field = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(field); field = "";
      if (row.some(v => clean(v))) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => clean(v))) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows.shift().map(h => clean(h).replace(/^\uFEFF/, "").toLowerCase());
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

function decodeXml(value) {
  return clean(value).replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function parseXml(text) {
  const items = [];
  const itemRe = /<(?:offer|item|product)\b[^>]*>([\s\S]*?)<\/(?:offer|item|product)>/gi;
  let match;
  while ((match = itemRe.exec(text)) && items.length < MAX_PRODUCTS) {
    const obj = {};
    const tagRe = /<([\w:-]+)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/g;
    let tag;
    while ((tag = tagRe.exec(match[1]))) {
      const key = tag[1].split(":").pop().toLowerCase();
      const val = tag[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "");
      if (!(key in obj)) obj[key] = decodeXml(val);
    }
    const picture = match[1].match(/<(?:picture|image)\b[^>]*>([\s\S]*?)<\/(?:picture|image)>/i);
    if (picture) obj.picture = decodeXml(picture[1].replace(/<[^>]+>/g, ""));
    if (Object.keys(obj).length) items.push(obj);
  }
  return items;
}

function normalize(rows) {
  const seen = new Set(), products = [];
  for (const raw of rows) {
    const title = clean(first(raw, ["name", "title", "product_name"]));
    const affiliateUrl = safeHttpUrl(first(raw, ["url", "link", "affiliate_url", "deeplink"]));
    const image = safeHttpUrl(first(raw, ["picture", "image", "photo", "image_url"]));
    if (!title || !affiliateUrl) continue;
    const id = clean(first(raw, ["id", "offer_id", "product_id", "article", "vendorcode"])) || affiliateUrl;
    if (seen.has(id)) continue;
    seen.add(id);
    const price = numberValue(first(raw, ["price", "sale_price"]));
    const oldPrice = numberValue(first(raw, ["oldprice", "old_price", "price_old"]));
    products.push({
      id, title, affiliateUrl, image,
      ...(price !== null ? { price } : {}),
      currency: clean(first(raw, ["currencyid", "currency", "currency_id"])) || "USD",
      ...(oldPrice !== null ? { oldPrice } : {}),
      description: clean(first(raw, ["description", "short_description"])).slice(0, 1200),
      brand: clean(first(raw, ["vendor", "brand", "manufacturer"])),
      category: clean(first(raw, ["category_name", "category", "typeprefix", "categoryid"])) || "Other",
      source: "Admitad"
    });
    if (products.length >= MAX_PRODUCTS) break;
  }
  return products;
}

async function loadFeed(env, force = false) {
  if (!force && memoryCache.products && Date.now() < memoryCache.expiresAt) return memoryCache;
  const feeds = [
    ["ADMITAD_FEED_URL_79310", env.ADMITAD_FEED_URL_79310],
    ["ADMITAD_FEED_URL_79311", env.ADMITAD_FEED_URL_79311],
    ["ADMITAD_FEED_URL_79312", env.ADMITAD_FEED_URL_79312],
    ["ADMITAD_FEED_URL", env.ADMITAD_FEED_URL]
  ].filter(([, value]) => typeof value === "string" && value.startsWith("https://"));
  if (!feeds.length) throw new Error("feed_not_configured");

  let lastError;
  for (const [name, feedUrl] of feeds) {
    try {
      const response = await fetch(feedUrl, {
        headers: { "accept": "application/xml,text/xml,text/csv,text/plain,*/*" },
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
        redirect: "follow"
      });
      if (!response.ok) throw new Error("feed_http_" + response.status);
      const type = (response.headers.get("content-type") || "").toLowerCase();
      const body = await response.text();
      if (!body || body.length > 30_000_000) throw new Error("feed_empty_or_too_large");
      const looksXml = type.includes("xml") || /^\s*(<\?xml|<yml_catalog|<rss|<offers|<shop)/i.test(body);
      const rows = looksXml ? parseXml(body) : parseCsv(body);
      const products = normalize(rows);
      if (!products.length) throw new Error("feed_has_no_valid_products");
      const result = { products, updatedAt: new Date().toISOString(), source: name };
      memoryCache = { ...result, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 };
      return memoryCache;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("feed_unavailable");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/api/health") {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "method_not_allowed" }, 405);
      return json({ service: "usamarket-live", status: "worker-runtime-active", assets: Boolean(env.ASSETS) });
    }
    if (url.pathname === "/api/admitad/products") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      try {
        const data = await loadFeed(env, url.searchParams.get("refresh") === "1");
        const q = clean(url.searchParams.get("q")).toLowerCase();
        const category = clean(url.searchParams.get("category")).toLowerCase();
        const sort = url.searchParams.get("sort") || "newest";
        const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 100));
        let products = data.products.filter(p =>
          (!q || [p.title, p.brand, p.category, p.description].join(" ").toLowerCase().includes(q)) &&
          (!category || p.category.toLowerCase() === category)
        );
        if (sort === "price-asc") products.sort((a,b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        if (sort === "price-desc") products.sort((a,b) => (b.price ?? -1) - (a.price ?? -1));
        const total = products.length;
        products = products.slice((page - 1) * limit, page * limit);
        return json({ products, updatedAt: data.updatedAt, total, page, limit, pages: Math.ceil(total / limit) });
      } catch (error) {
        const missing = String(error?.message || "").includes("not_configured");
        return json({ error: missing ? "product_feed_not_configured" : "product_feed_unavailable",
          message: missing ? "The Admitad feed URL secrets are not configured." : "The product feed is temporarily unavailable." }, missing ? 503 : 502,
          { "cache-control": "no-store" });
      }
    }
    if (!env.ASSETS) return json({ error: "static_assets_binding_missing" }, 500);
    return env.ASSETS.fetch(request);
  }
};
