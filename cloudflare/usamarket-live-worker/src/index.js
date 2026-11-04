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


const VIDEO_CATEGORIES = {
  economy: { en: "US economy Federal Reserve economics", ar: "الاقتصاد الأمريكي الاحتياطي الفيدرالي التضخم" },
  investing: { en: "investing stock market financial education", ar: "تعلم الاستثمار الأسهم الأسواق المالية" },
  ai: { en: "artificial intelligence technology official", ar: "الذكاء الاصطناعي التكنولوجيا" },
  crypto: { en: "cryptocurrency blockchain financial technology", ar: "العملات الرقمية البلوكشين" },
  business: { en: "American business entrepreneurship companies", ar: "الأعمال ريادة الأعمال الشركات" },
  education: { en: "science education NASA technology", ar: "العلوم التعليم ناسا التكنولوجيا" }
};
async function searchVideos(request, env) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!env.YOUTUBE_API_KEY) return json({ error: "youtube_api_key_missing", message: "YouTube API key is not configured on the server." }, 503);
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") === "ar" ? "ar" : "en";
  const category = clean(url.searchParams.get("category") || "all").toLowerCase();
  if (category !== "all" && !VIDEO_CATEGORIES[category]) return json({ error: "invalid_category" }, 400);
  const q = clean(url.searchParams.get("q")).slice(0, 100);
  const pageToken = clean(url.searchParams.get("pageToken")).slice(0, 500);
  const cacheKey = "videos:v1:" + lang + ":" + category;
  if (!q && !pageToken && env.VIDEOS_KV) {
    try {
      const cached = await env.VIDEOS_KV.get(cacheKey, "json");
      if (cached && Array.isArray(cached.videos) && cached.videos.length) {
        return json({ videos: cached.videos, nextPageToken: null, totalResults: cached.totalResults || cached.videos.length, lang, category, cached: true, refreshedAt: cached.fetchedAt },
          200, { "cache-control": "public, max-age=300, s-maxage=900" });
      }
    } catch (_) {}
  }
  const baseQuery = category === "all"
    ? (lang === "ar" ? "الاقتصاد التكنولوجيا العلوم الاستثمار" : "US economy technology investing science")
    : VIDEO_CATEGORIES[category][lang];
  const params = new URLSearchParams({
    part: "snippet", type: "video", maxResults: "50", safeSearch: "strict",
    order: "relevance", videoEmbeddable: "true", videoSyndicated: "true",
    regionCode: lang === "ar" ? "MA" : "US", relevanceLanguage: lang,
    q: [baseQuery, q].filter(Boolean).join(" ")
  });
  if (pageToken) params.set("pageToken", pageToken);
  try {
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), {
      headers: { "x-goog-api-key": env.YOUTUBE_API_KEY }, signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (!response.ok) return json({ error: data?.error?.errors?.[0]?.reason || "youtube_api_error", message: "YouTube video search is temporarily unavailable." }, response.status === 403 ? 502 : response.status);
    const videos = (data.items || []).map(item => ({
      id: item.id?.videoId, title: clean(item.snippet?.title),
      description: clean(item.snippet?.description).slice(0, 360),
      channel: clean(item.snippet?.channelTitle), publishedAt: item.snippet?.publishedAt || "",
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ""
    })).filter(item => /^[A-Za-z0-9_-]{11}$/.test(item.id || "") && item.title);
    if (env.VIDEOS_KV && !q && !pageToken && videos.length) {
      try {
        await env.VIDEOS_KV.put(cacheKey, JSON.stringify({
          videos, totalResults: data.pageInfo?.totalResults || videos.length,
          fetchedAt: new Date().toISOString()
        }), { expirationTtl: 172800 });
      } catch (_) {}
    }
    return json({ videos, nextPageToken: data.nextPageToken || null, totalResults: data.pageInfo?.totalResults || 0, lang, category },
      200, { "cache-control": "public, max-age=900, s-maxage=1800" });
  } catch (_) { return json({ error: "youtube_unavailable", message: "Unable to reach YouTube right now." }, 502); }
}

async function refreshVideoLibrary(env) {
  const apiKey = env.YOUTUBE_API_KEY || env.youtube_api_key;
  if (!apiKey) throw new Error("youtube_api_key_missing");
  if (!env.VIDEOS_KV) throw new Error("videos_kv_binding_missing");
  const categories = ["all", ...Object.keys(VIDEO_CATEGORIES)];
  const results = [];
  for (const lang of ["en", "ar"]) {
    for (const category of categories) {
      const baseQuery = category === "all"
        ? (lang === "ar" ? "الاقتصاد التكنولوجيا العلوم الاستثمار" : "US economy technology investing science")
        : VIDEO_CATEGORIES[category][lang];
      const params = new URLSearchParams({
        part: "snippet", type: "video", maxResults: "50", safeSearch: "strict",
        order: "date", videoEmbeddable: "true", videoSyndicated: "true",
        regionCode: lang === "ar" ? "MA" : "US", relevanceLanguage: lang,
        q: baseQuery
      });
      const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), {
        headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(12000)
      });
      const data = await response.json();
      if (!response.ok) {
        results.push({ lang, category, ok: false, reason: data?.error?.errors?.[0]?.reason || "youtube_api_error" });
        continue;
      }
      const videos = (data.items || []).map(item => ({
        id: item.id?.videoId, title: clean(item.snippet?.title),
        description: clean(item.snippet?.description).slice(0, 360),
        channel: clean(item.snippet?.channelTitle), publishedAt: item.snippet?.publishedAt || "",
        thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ""
      })).filter(item => /^[A-Za-z0-9_-]{11}$/.test(item.id || "") && item.title);
      const unique = [...new Map(videos.map(v => [v.id, v])).values()];
      await env.VIDEOS_KV.put("videos:v1:" + lang + ":" + category, JSON.stringify({
        videos: unique, totalResults: data.pageInfo?.totalResults || unique.length,
        fetchedAt: new Date().toISOString()
      }), { expirationTtl: 172800 });
      results.push({ lang, category, ok: true, count: unique.length });
    }
  }
  return results;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshVideoLibrary(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/api/health") {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "method_not_allowed" }, 405);
      return json({ service: "usamarket-live", status: "worker-runtime-active", assets: Boolean(env.ASSETS) });
    }
    if (url.pathname === "/api/videos") return searchVideos(request, env);
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
    if (request.method === "GET" && /^\/shop\/p\/[^/]+\.html$/.test(url.pathname)) {
      const staticProductPage = await env.ASSETS.fetch(request);
      if (staticProductPage.status !== 404) return staticProductPage;
      const productPage = new URL("/shop/product.html", url);
      productPage.search = url.search;
      return env.ASSETS.fetch(new Request(productPage, request));
    }
    return env.ASSETS.fetch(request);
  }
};
