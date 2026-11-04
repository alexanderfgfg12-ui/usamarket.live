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



const CINEMA_CATALOG_KEY = "cinema:v1:catalog";
// GitHub-hosted static catalogue mode: only well-known public media hosts are
// accepted by default. Add other reviewed hosts through CINEMA_MEDIA_HOSTS.
const CINEMA_DEFAULT_MEDIA_HOSTS = ["archive.org", "upload.wikimedia.org"];
function cinemaHostAllowed(host, configured) {
  const h = String(host || "").toLowerCase();
  return configured.has(h) || CINEMA_DEFAULT_MEDIA_HOSTS.some(root => h === root || h.endsWith("." + root));
}
function cinemaSafeItem(item, allowedHosts) {
  if (!item || item.active !== true || item.rightsStatus !== "verified") return null;
  const playback = clean(item.playbackUrl);
  const evidence = safeHttpUrl(item.rightsEvidence);
  const license = clean(item.license);
  if (!playback || !license || !evidence) return null;
  let media;
  try { media = new URL(playback); } catch (_) { return null; }
  if (media.protocol !== "https:" || !cinemaHostAllowed(media.hostname, allowedHosts)) return null;
  const id = clean(item.id).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) return null;
  return {
    id, title: clean(item.title).slice(0,160),
    year: Number.isInteger(Number(item.year)) ? Number(item.year) : null,
    category: ["film","series","documentary"].includes(item.category) ? item.category : "film",
    description: clean(item.description).slice(0,1200),
    poster: safeHttpUrl(item.poster),
    duration: clean(item.duration).slice(0,40),
    playbackUrl: media.href,
    license, rightsEvidence: evidence
  };
}
async function getCinemaCatalog(request, env) {
  if (request.method !== "GET") return json({error:"method_not_allowed"},405);
  const configuredHosts = new Set(clean(env.CINEMA_MEDIA_HOSTS).toLowerCase().split(",").map(x=>x.trim()).filter(Boolean));
  // Prefer the existing KV catalogue when populated; otherwise read the
  // version-controlled JSON file served by the Worker static-assets binding.
  let data = env.VIDEOS_KV ? await env.VIDEOS_KV.get(CINEMA_CATALOG_KEY,"json").catch(()=>null) : null;
  let source = "kv";
  if (!Array.isArray(data?.items) || data.items.length === 0) {
    source = "github-static";
    if (env.ASSETS) {
      try {
        const assetUrl = new URL("/cinema/catalog.json", request.url);
        const response = await env.ASSETS.fetch(new Request(assetUrl, {headers:{accept:"application/json"}}));
        if (response.ok) data = await response.json();
      } catch (_) {}
    }
  }
  const items = (Array.isArray(data?.items)?data.items:[])
    .map(item=>cinemaSafeItem(item,configuredHosts)).filter(Boolean);
  const id = clean(new URL(request.url).searchParams.get("id")).toLowerCase();
  if (id) {
    const item = items.find(x=>x.id===id);
    return item ? json({item,source},200,{"cache-control":"public, max-age=180, s-maxage=300"})
      : json({error:"title_not_found"},404);
  }
  return json({items,count:items.length,source},200,{"cache-control":"public, max-age=180, s-maxage=300"});
}

const NEWS_FEEDS = {
 en: [
  "https://news.google.com/rss/search?q=US+stock+market+OR+Wall+Street+OR+Federal+Reserve&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=technology+OR+artificial+intelligence+OR+semiconductors&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=cryptocurrency+OR+Bitcoin+OR+business+earnings&hl=en-US&gl=US&ceid=US:en"
 ],
 ar: [
  "https://news.google.com/rss/search?q=%D8%A7%D9%84%D8%A3%D8%B3%D9%88%D8%A7%D9%82+OR+%D8%A7%D9%84%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF+OR+%D9%88%D9%88%D9%84+%D8%B3%D8%AA%D8%B1%D9%8A%D8%AA&hl=ar&gl=MA&ceid=MA:ar",
  "https://news.google.com/rss/search?q=%D8%A7%D9%84%D8%AA%D9%83%D9%86%D9%88%D9%84%D9%88%D8%AC%D9%8A%D8%A7+OR+%D8%A7%D9%84%D8%B0%D9%83%D8%A7%D8%A1+%D8%A7%D9%84%D8%A7%D8%B5%D8%B7%D9%86%D8%A7%D8%B9%D9%8A&hl=ar&gl=MA&ceid=MA:ar",
  "https://news.google.com/rss/search?q=%D8%A8%D9%8A%D8%AA%D9%83%D9%88%D9%8A%D9%86+OR+%D8%A7%D9%84%D8%B9%D9%85%D9%84%D8%A7%D8%AA+%D8%A7%D9%84%D8%B1%D9%82%D9%85%D9%8A%D8%A9+OR+%D8%A7%D9%84%D8%A3%D8%B9%D9%85%D8%A7%D9%84&hl=ar&gl=MA&ceid=MA:ar"
 ]
};
const NEWS_IMAGES = {
 markets:"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
 economy:"https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80",
 technology:"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
 crypto:"https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80",
 business:"https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80"
};
function newsDecode(v) {
 return String(v||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).trim();
}
function newsTag(s,t) { const m=s.match(new RegExp("<"+t+"\\b[^>]*>([\\s\\S]*?)<\\/"+t+">","i")); return m?newsDecode(m[1]):""; }
function newsCategory(t,d) {
 const s=(t+" "+d).toLowerCase();
 if(/bitcoin|crypto|blockchain|بيتكوين|العملات الرقمية/.test(s)) return "crypto";
 if(/artificial intelligence|\bai\b|chip|semiconductor|technology|ذكاء اصطناعي|تكنولوجيا|الرقائق/.test(s)) return "technology";
 if(/federal reserve|inflation|jobs report|economy|rates|التضخم|اقتصاد|الفيدرالي|الفائدة/.test(s)) return "economy";
 if(/business|earnings|company|retail|أرباح|شركة|الأعمال/.test(s)) return "business";
 return "markets";
}
function newsId(t,l) { let h=2166136261; for(const c of(l||t)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return "live-"+(h>>>0).toString(36); }
function parseNewsRss(xml,lang) {
 const out=[],blocks=xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)||[];
 for(const b of blocks.slice(0,30)) {
  const title=newsTag(b,"title").replace(/\s+-\s+[^-]+$/,"").trim();
  const raw=newsTag(b,"description")||newsTag(b,"summary");
  const description=clean(raw.replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ")).slice(0,420);
  const href=newsTag(b,"link")||(b.match(/<link\b[^>]*href=["']([^"']+)/i)||[])[1]||"";
  const link=safeHttpUrl(href), date=new Date(newsTag(b,"pubDate")||newsTag(b,"published")||newsTag(b,"updated"));
  if(!title||!link||!description||!Number.isFinite(date.getTime())) continue;
  const category=newsCategory(title,description), id=newsId(title,link);
  const path=(lang==="ar"?"/ar/news/live/":"/news/live/")+id;
  const media=b.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*(?:url|href)=["']([^"']+)["']/i);
  out.push({id,title,description,source:newsTag(b,"source")||"Google News",pubDate:date.toISOString(),category,image:safeHttpUrl(media&&media[1])||NEWS_IMAGES[category],link,lang,path});
 }
 return out;
}
async function refreshNewsLibrary(env) {
 if(!env.VIDEOS_KV) throw new Error("news_kv_binding_missing");
 const status={startedAt:new Date().toISOString(),languages:{}};
 for(const lang of ["en","ar"]) {
  const old=await env.VIDEOS_KV.get("news:v1:"+lang,"json").catch(()=>null);
  const feedResults=await Promise.all(NEWS_FEEDS[lang].map(async feed=>{
   try { const r=await fetch(feed,{headers:{accept:"application/rss+xml, application/xml, text/xml"},signal:AbortSignal.timeout(12000)}); if(!r.ok)return []; return parseNewsRss(await r.text(),lang); } catch(_) { return []; }
  }));
  const found=feedResults.flat(),feedsOk=feedResults.filter(items=>items.length>0).length;
  if(!found.length&&!old?.articles?.length){status.languages[lang]={ok:false,count:0};continue;}
  const unique=new Map();
  for(const a of [...found,...(old?.articles||[])]) { const k=a.title.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,""); if(!unique.has(k))unique.set(k,a); }
  const articles=[...unique.values()].sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate)).slice(0,100);
  await env.VIDEOS_KV.put("news:v1:"+lang,JSON.stringify({updatedAt:new Date().toISOString(),count:articles.length,articles}),{expirationTtl:345600});
  status.languages[lang]={ok:true,feeds:feedsOk,count:articles.length};
 }
 status.completedAt=new Date().toISOString();
 await env.VIDEOS_KV.put("news:v1:status",JSON.stringify(status),{expirationTtl:604800});
 return status;
}
async function getNews(request,env) {
 if(request.method!=="GET") return json({error:"method_not_allowed"},405);
 const lang=new URL(request.url).searchParams.get("lang")==="ar"?"ar":"en";
 let data=await env.VIDEOS_KV.get("news:v1:"+lang,"json").catch(()=>null);
 if(!data?.articles?.length){await refreshNewsLibrary(env).catch(()=>{});data=await env.VIDEOS_KV.get("news:v1:"+lang,"json").catch(()=>null);}
 return json({lang,updatedAt:data?.updatedAt||null,count:data?.count||0,articles:data?.articles||[]},200,{"cache-control":"public, max-age=180, s-maxage=300"});
}
const newsHtmlEscape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function renderLiveNewsPage(id,lang,env) {
 const data=await env.VIDEOS_KV.get("news:v1:"+lang,"json").catch(()=>null);
 const a=data?.articles?.find(x=>x.id===id);
 if(!a) return new Response("Article not found",{status:404});
 const ar=lang==="ar",title=newsHtmlEscape(a.title),desc=newsHtmlEscape(a.description),source=newsHtmlEscape(a.source);
 const date=new Date(a.pubDate).toISOString(),image=newsHtmlEscape(a.image),canonical="https://usamarket.live"+a.path;
 const home=ar?"الرئيسية":"Home",sourceLabel=ar?"المصدر الأصلي":"Original source";
 const note=ar?"ملخص موجز مستند إلى المعلومات المنشورة لدى المصدر المذكور. يرجى الرجوع إلى المصدر للاطلاع على التغطية الكاملة والتحديثات.":"A concise news brief based on information published by the cited source. Visit the original report for full coverage and updates.";
 const schema=JSON.stringify({"@context":"https://schema.org","@type":"NewsArticle",headline:a.title,datePublished:date,dateModified:date,image:[a.image],inLanguage:lang,mainEntityOfPage:canonical,publisher:{"@type":"Organization",name:"US Market Live",url:"https://usamarket.live/"}}).replace(/</g,"\\u003c");
 const page='<!doctype html><html lang="'+lang+'" dir="'+(ar?"rtl":"ltr")+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' | US Market Live</title><meta name="description" content="'+desc.slice(0,155)+'"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="'+canonical+'"><meta property="og:type" content="article"><meta property="og:title" content="'+title+'"><meta property="og:description" content="'+desc+'"><meta property="og:image" content="'+image+'"><meta property="og:url" content="'+canonical+'"><script type="application/ld+json">'+schema+'</script><style>body{margin:0;background:#f5f7fa;color:#172033;font:17px/1.8 Arial,sans-serif}.top{padding:18px max(20px,calc((100% - 850px)/2));background:white}.top a,.foot a{color:#1747a6;text-decoration:none;font-weight:bold}.wrap{max-width:850px;margin:36px auto;padding:24px;background:white;border-radius:16px}.wrap h1{font-size:clamp(28px,5vw,42px);line-height:1.3}.hero{width:100%;max-height:440px;object-fit:cover;border-radius:14px}.meta,.foot{color:#667085;font-size:14px}.summary{font-size:19px}.source{display:inline-block;padding:12px 18px;background:#1747a6;color:white;border-radius:8px;text-decoration:none}.note{padding:16px;background:#f1f5f9;border-radius:10px;color:#475467;font-size:14px}.foot{border-top:1px solid #eee;margin-top:30px;padding-top:18px}</style></head><body><header class="top"><a href="'+(ar?"/ar/":"/")+'">US Market Live · '+home+'</a></header><main class="wrap"><h1>'+title+'</h1><p class="meta">'+source+' · <time datetime="'+date+'">'+new Date(date).toLocaleString(ar?"ar-MA":"en-US")+'</time></p><img class="hero" src="'+image+'" alt="'+title+'"><p class="summary">'+desc+'</p><div style="margin:28px 0;text-align:center;overflow:auto;min-height:90px"><script>atOptions={key:"1dfb3499e1ac651f7c3142c05db57d13",format:"iframe",height:90,width:728,params:{}};</script><script src="https://bauval.org/22/1dfb3499e1ac651f7c3142c05db57d13"></script></div><p class="note">'+note+'</p><p><a class="source" href="'+newsHtmlEscape(a.link)+'" target="_blank" rel="noopener noreferrer">'+sourceLabel+' ↗</a></p><div class="foot"><a href="'+(ar?"/ar/":"/")+'">'+home+'</a> · <a href="'+(ar?"/ar/":"/")+'#latest">'+(ar?"أحدث الأخبار":"Latest news")+'</a> · <a href="'+(ar?"/":"/ar/")+'">'+(ar?"English":"العربية")+'</a><p>© '+new Date().getFullYear()+' US Market Live</p></div></main></body></html>';
 return new Response(page,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300"}});
}
async function liveNewsSitemap(env) {
 const [en,ar]=await Promise.all(["en","ar"].map(l=>env.VIDEOS_KV.get("news:v1:"+l,"json").catch(()=>null)));
 const cutoff=Date.now()-48*3600000;
 const list=[...(en?.articles||[]),...(ar?.articles||[])].filter(a=>{const t=new Date(a.pubDate).getTime();return Number.isFinite(t)&&t<=Date.now()&&t>=cutoff;});
 const entries=list.map(a=>'<url><loc>https://usamarket.live'+newsHtmlEscape(a.path)+'</loc><news:news><news:publication><news:name>US Market Live</news:name><news:language>'+a.lang+'</news:language></news:publication><news:publication_date>'+new Date(a.pubDate).toISOString()+'</news:publication_date><news:title>'+newsHtmlEscape(a.title)+'</news:title></news:news></url>').join("");
 return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">'+entries+'</urlset>',{headers:{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age=300"}});
}

export default {
  async scheduled(event, env, ctx) {
    if (event.cron === "17 4 * * *") ctx.waitUntil(refreshVideoLibrary(env));
    if (event.cron === "0 */3 * * *") ctx.waitUntil(refreshNewsLibrary(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/api/health") {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "method_not_allowed" }, 405);
      return json({ service: "usamarket-live", status: "worker-runtime-active", assets: Boolean(env.ASSETS) });
    }
    if (url.pathname === "/api/videos") return searchVideos(request, env);
    if (url.pathname === "/api/news") return getNews(request, env);
    if (url.pathname === "/api/cinema/catalog") return getCinemaCatalog(request, env);
    if (url.pathname === "/news-sitemap-live.xml") return liveNewsSitemap(env);
    const liveArticle = url.pathname.match(/^\/(ar\/)?news\/live\/([a-z0-9-]+)\/?$/i);
    if (request.method === "GET" && liveArticle) return renderLiveNewsPage(liveArticle[2], liveArticle[1] ? "ar" : "en", env);
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
