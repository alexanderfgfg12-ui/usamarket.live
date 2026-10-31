// Import Admitad CSV/XML/YML or normalized JSON product feeds into the public catalogue.
// Configure private feed URLs only as the GitHub Actions secret AFFILIATE_FEED_URLS.
const fs = require('node:fs');
const path = require('node:path');
const { XMLParser } = require('fast-xml-parser');
const { parse: parseCsv } = require('csv-parse/sync');

const raw = process.env.AFFILIATE_FEED_URLS || '';
const urls = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
const output = path.join(__dirname, '..', 'shop', 'products.json');
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', parseTagValue: true, trimValues: true });
const cleanUrl = value => {
  if (value && typeof value === 'object') value = value['#text'] || value.url || value.value || '';
  try { const u = new URL(String(value || '').trim()); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
};
const scalar = value => {
  if (value && typeof value === 'object') return value['#text'] ?? value['@_id'] ?? value.value ?? '';
  return value ?? '';
};
const keyOf = key => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
const get = (obj, aliases) => {
  if (!obj || typeof obj !== 'object') return undefined;
  const wanted = new Set(aliases.map(keyOf));
  for (const [key, value] of Object.entries(obj)) if (wanted.has(keyOf(key))) return scalar(value);
  return undefined;
};
const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];
function findOffers(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.products)) return data.products;
  if (data.products && typeof data.products === 'object') return asArray(data.products.product || data.products.offer || data.products.item);
  if (data.yml_catalog) return findOffers(data.yml_catalog.shop || data.yml_catalog);
  if (data.shop) return findOffers(data.shop);
  if (data.offers) return asArray(data.offers.offer || data.offers);
  if (data.items) return asArray(data.items.item || data.items);
  if (data.catalog) return findOffers(data.catalog);
  if (data.rss) return findOffers(data.rss.channel || data.rss);
  if (data.channel) return findOffers(data.channel);
  if (data.item) return asArray(data.item);
  if (data.offer) return asArray(data.offer);
  return [];
}
function parseFeed(text, contentType) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty feed response');
  if (contentType.includes('json') || /^[\[{]/.test(trimmed)) {
    const data = JSON.parse(trimmed);
    const offers = findOffers(data);
    if (!offers.length && Array.isArray(data.products)) return data.products;
    return offers;
  }
  if (contentType.includes('csv') || (!trimmed.startsWith('<') && trimmed.includes(','))) {
    return parseCsv(trimmed, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: true });
  }
  if (trimmed.startsWith('<')) {
    const data = xmlParser.parse(trimmed);
    const offers = findOffers(data);
    if (!offers.length) throw new Error('XML feed parsed, but no product offers were found');
    return offers;
  }
  throw new Error('Unsupported feed format; expected JSON, XML/YML, or CSV');
}
function normalize(item, index, categories, hostname) {
  const title = String(get(item, ['title','name','productName','product_name','model']) || '').trim();
  const affiliateUrl = cleanUrl(get(item, ['affiliateUrl','affiliate_url','url','link','trackingUrl','tracking_url']));
  if (!title || !affiliateUrl) return null;
  const categoryId = String(get(item, ['categoryId','category_id','categoryid']) || '');
  const category = String(get(item, ['category','categoryName','category_name']) || categories[categoryId] || 'Other').slice(0, 80);
  const image = cleanUrl(get(item, ['image','picture','imageUrl','image_url','pictureUrl','picture_url']));
  const priceRaw = get(item, ['price','salePrice','sale_price','currentPrice','current_price']);
  const oldRaw = get(item, ['oldPrice','old_price','priceOld','price_old']);
  const currency = String(get(item, ['currency','currencyId','currency_id']) || 'USD').toUpperCase().slice(0, 3);
  const numeric = v => v === undefined || v === null || v === '' || !Number.isFinite(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.'));
  const id = String(get(item, ['id','offerId','offer_id','productId','product_id','sku']) || affiliateUrl);
  return {
    id, title: title.slice(0, 240),
    description: String(get(item, ['description','productDescription','product_description']) || '').slice(0, 180),
    brand: String(get(item, ['brand','vendor','manufacturer']) || '').slice(0, 100),
    category, image, price: numeric(priceRaw), oldPrice: numeric(oldRaw),
    currency, affiliateUrl, source: 'Admitad',
    updatedAt: new Date().toISOString()
  };
}
async function fetchFeed(endpoint, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const parsed = new URL(endpoint);
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Feed URL must use HTTPS or HTTP');
      const response = await fetch(endpoint, {
        headers: { accept: 'application/json, application/xml, text/xml, text/csv, */*' },
        signal: AbortSignal.timeout(90000)
      });
      if (!response.ok) throw new Error('Feed request failed with HTTP ' + response.status + ' (' + parsed.hostname + ')');
      const body = await response.text();
      const records = parseFeed(body, response.headers.get('content-type') || '');
      if (!records.length) throw new Error('No products found in feed from ' + parsed.hostname);
      return { parsed, body, records };
    } catch (error) {
      lastError = error;
      console.warn('Feed attempt', attempt, 'of', attempts, 'failed:', error.message);
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
  throw lastError;
}
async function main() {
  if (!urls.length) throw new Error('AFFILIATE_FEED_URLS is not configured. Add the Admitad export URLs as a GitHub Actions secret; no catalogue was changed.');
  const collected = new Map();
  const failures = [];
  let successfulFeeds = 0;
  for (const endpoint of urls) {
    let feed;
    try {
      feed = await fetchFeed(endpoint);
    } catch (error) {
      let host = 'unknown host';
      try { host = new URL(endpoint).hostname; } catch {}
      failures.push(host + ': ' + error.message);
      console.warn('Skipping unavailable feed:', host, error.message);
      continue;
    }
    const { parsed, body, records } = feed;
    const categories = {};
    // Admitad YML commonly places category labels beside offers.
    try {
      const data = body.trim().startsWith('<') ? xmlParser.parse(body) : {};
      const shop = data.yml_catalog?.shop || data.shop || {};
      for (const c of asArray(shop.categories?.category)) {
        const id = String(c['@_id'] || c.id || '');
        const name = String(scalar(c) || c['#text'] || '');
        if (id && name) categories[id] = name;
      }
    } catch {}
    let accepted = 0;
    records.forEach((item, index) => {
      const product = normalize(item, index, categories, parsed.hostname);
      if (!product) return;
      collected.set(product.id, product);
      accepted++;
    });
    if (!accepted) {
      failures.push(parsed.hostname + ': no valid products with title and affiliate URL');
      console.warn('Feed contained no usable products:', parsed.hostname);
      continue;
    }
    successfulFeeds++;
    console.log('Parsed', records.length, 'rows; accepted', accepted, 'products from', parsed.hostname);
  }
  // Keep the static storefront payload lightweight; the full partner feed may contain tens of thousands of rows.
  const products = [...collected.values()].slice(0, 1000);
  if (!successfulFeeds || !products.length) {
    throw new Error('All affiliate feeds failed or contained no usable products; refusing to publish an empty catalogue. ' + failures.join(' | '));
  }
  fs.writeFileSync(output, JSON.stringify({ updatedAt: new Date().toISOString(), products }, null, 2) + '\n');
  console.log('Successfully saved', products.length, 'real Admitad products from', successfulFeeds, 'feed(s).');
  if (failures.length) console.warn('Some feeds were skipped; successful products were preserved:', failures.join(' | '));
}
main().catch(error => { console.error('Product sync failed:', error.message); process.exit(1); });
