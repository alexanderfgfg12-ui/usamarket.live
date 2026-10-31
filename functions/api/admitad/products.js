const API = "https://api.admitad.com";

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=300, s-maxage=21600" : "no-store",
      "x-content-type-options": "nosniff",
      ...extra
    }
  });
}

function host(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function text(value) {
  return String(value ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();
}

function safeUrl(value) {
  try {
    const u = new URL(String(value || ""));
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch { return ""; }
}

function number(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function csvRows(source) {
  const header = source.split(/\r?\n/, 1)[0] || "";
  const separators = [",", ";", "|", "\t"];
  const separator = separators.sort((a, b) => header.split(b).length - header.split(a).length)[0];
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (c === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === separator && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

function parseCsv(source, campaign) {
  const rows = csvRows(source);
  if (rows.length < 2) return [];
  const keys = rows.shift().map(v => v.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  const pick = (obj, names) => {
    for (const name of names) {
      const i = keys.indexOf(name);
      if (i >= 0 && obj[i]) return obj[i].trim();
    }
    return "";
  };
  return rows.map((r, i) => ({
    id: pick(r, ["offerid", "id", "article", "sku"]) || String(i + 1),
    title: pick(r, ["name", "title"]),
    description: pick(r, ["description"]),
    brand: pick(r, ["vendor", "brand"]),
    category: pick(r, ["categoryname", "category", "producttype"]) || campaign,
    image: safeUrl(pick(r, ["picture", "image", "imagelink", "photourl"])),
    price: number(pick(r, ["price"])),
    oldPrice: number(pick(r, ["oldprice", "oldpricevalue"])),
    currency: (pick(r, ["currencyid", "currency"]) || "USD").slice(0, 3).toUpperCase(),
    affiliateUrl: safeUrl(pick(r, ["url", "link", "producturl", "urladdress"])),
    source: campaign
  })).filter(p => p.title && p.affiliateUrl);
}

function xmlValue(block, names) {
  for (const name of names) {
    const re = new RegExp("<(?:g:)?"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)</(?:g:)?"+name+">", "i");
    const match = block.match(re);
    if (match) return text(match[1]);
  }
  return "";
}

function parseXml(source, campaign) {
  const blocks = source.match(/<(?:item|offer|entry)\b[^>]*>[\s\S]*?<\/(?:item|offer|entry)>/gi) || [];
  return blocks.map((b, i) => {
    const priceRaw = xmlValue(b, ["price"]);
    return {
      id: xmlValue(b, ["id", "offer_id"]) || String(i + 1),
      title: xmlValue(b, ["title", "name"]),
      description: xmlValue(b, ["description"]),
      brand: xmlValue(b, ["brand", "vendor"]),
      category: xmlValue(b, ["product_type", "category", "category_name"]) || campaign,
      image: safeUrl(xmlValue(b, ["image_link", "picture", "image"])),
      price: number(priceRaw),
      oldPrice: number(xmlValue(b, ["oldprice", "old_price"])),
      currency: (priceRaw.match(/\b[A-Z]{3}\b/) || ["USD"])[0],
      affiliateUrl: safeUrl(xmlValue(b, ["link", "url"])),
      source: campaign
    };
  }).filter(p => p.title && p.affiliateUrl);
}

async function apiFetch(path, token) {
  const response = await fetch(API + path, {
    headers: { authorization: "Bearer " + token, accept: "application/json" },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error("Admitad API returned " + response.status);
  return response.json();
}

async function getToken(env) {
  const clientId = env.ADMITAD_CLIENT_ID;
  const clientSecret = env.ADMITAD_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Admitad credentials are not configured");
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "client_credentials",
    scope: "advcampaigns websites"
  });
  const response = await fetch(API + "/token/", {
    method: "POST",
    headers: {
      authorization: "Basic " + btoa(clientId + ":" + clientSecret),
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body,
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error("Admitad authorization failed (" + response.status + ")");
  const data = await response.json();
  if (!data.access_token) throw new Error("Admitad did not return an access token");
  return data.access_token;
}

async function loadProducts(env) {
  const token = await getToken(env);
  const spacesData = await apiFetch("/websites/v2/?status=active", token);
  const spaces = Array.isArray(spacesData) ? spacesData : (spacesData.results || []);
  const website = spaces.find(w => host(w.site_url) === "usamarket.live");
  if (!website) throw new Error("The usamarket.live ad space was not found in the Admitad account");

  const campaignData = await apiFetch(
    "/advcampaigns/website/" + encodeURIComponent(website.id) +
    "/?connection_status=active&has_tool=products&limit=100&offset=0&language=en",
    token
  );
  const campaigns = Array.isArray(campaignData) ? campaignData : (campaignData.results || []);
  const products = new Map();
  let feedCount = 0;

  for (const campaign of campaigns) {
    const feeds = Array.isArray(campaign.feeds_info) ? campaign.feeds_info : [];
    const links = [];
    for (const feed of feeds) {
      if (feed.csv_link) links.push({ url: feed.csv_link, type: "csv" });
      else if (feed.xml_link) links.push({ url: feed.xml_link, type: "xml" });
    }
    if (!links.length) {
      if (campaign.products_csv_link) links.push({ url: campaign.products_csv_link, type: "csv" });
      else if (campaign.products_xml_link) links.push({ url: campaign.products_xml_link, type: "xml" });
    }
    for (const feed of links.slice(0, 3)) {
      const feedUrl = safeUrl(feed.url);
      if (!feedUrl) continue;
      const response = await fetch(feedUrl, {
        headers: { accept: "text/csv, application/xml, text/xml, */*" },
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error("A product feed could not be downloaded (" + response.status + ")");
      const source = await response.text();
      const parsed = feed.type === "csv" ? parseCsv(source, campaign.name || "Admitad") : parseXml(source, campaign.name || "Admitad");
      feedCount++;
      for (const p of parsed) {
        const key = p.id + "|" + p.affiliateUrl;
        if (!products.has(key) && products.size < 5000) products.set(key, {
          ...p,
          id: String(p.id),
          title: p.title.slice(0, 240),
          description: p.description.slice(0, 1000),
          brand: p.brand.slice(0, 100),
          category: p.category.slice(0, 80),
          updatedAt: new Date().toISOString()
        });
      }
    }
  }
  if (!feedCount) throw new Error("No active product feeds are available for this ad space yet");
  return { updatedAt: new Date().toISOString(), products: [...products.values()] };
}

export async function onRequestGet({ request, env }) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/admitad/products", request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const catalogue = await loadProducts(env);
    const response = json(catalogue);
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    // Do not expose API response bodies, feed URLs, or credential-related details.
    const message = error.message.includes("No active product feeds")
      ? error.message
      : "The Admitad product catalogue is temporarily unavailable. Check the API permissions and product-feed access.";
    return json({ error: message, products: [] }, 503);
  }
}
