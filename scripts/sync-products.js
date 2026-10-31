// Import multiple authorized affiliate feeds into paginated static catalogue batches.
const fs = require('node:fs');
const path = require('node:path');
const { XMLParser } = require('fast-xml-parser');
const { parse: parseCsv } = require('csv-parse/sync');

const raw = process.env.AFFILIATE_FEED_URLS || '';
const urls = [...new Set(raw.split(/[\\s,]+/).map(s => s.trim()).filter(Boolean))];
const shopDir = path.join(__dirname, '..', 'shop');
const batchSize = Math.max(100, Number(process.env.PRODUCT_BATCH_SIZE) || 300);
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', parseTagValue: true, trimValues: true });
const cleanUrl = value => { if (value && typeof value === 'object') value = value['#text'] || value.url || value.value || ''; try { const u = new URL(String(value || '').trim()); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const scalar = value => value && typeof value === 'object' ? (value['#text'] ?? value['@_id'] ?? value.value ?? '') : (value ?? '');
const keyOf = key => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
const get = (obj, aliases) => { if (!obj || typeof obj !== 'object') return undefined; const wanted = new Set(aliases.map(keyOf)); for (const [key, value] of Object.entries(obj)) if (wanted.has(keyOf(key))) return scalar(value); };
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
function parseFeed(body, type) {
  const s = body.trim(); if (!s) throw new Error('Empty feed response');
  if (type.includes('json') || /^[\\[{]/.test(s)) return findOffers(JSON.parse(s));
  if (type.includes('csv') || (!s.startsWith('<') && s.includes(','))) return parseCsv(s, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: true });
  if (s.startsWith('<')) { const offers = findOffers(xmlParser.parse(s)); if (!offers.length) throw new Error('XML parsed but no product offers found'); return offers; }
  throw new Error('Unsupported feed format');
}
function imageUrl(item) {
  if (!item || typeof item !== 'object') return '';
  const aliases = new Set(['image','picture','imageurl','pictureurl','imagelink','picturelink','img','photo','images','pictures','picture1','image1']);
  for (const [key, raw] of Object.entries(item)) if (aliases.has(keyOf(key))) for (const candidate of asArray(raw)) {
    const value = candidate && typeof candidate === 'object' ? (candidate['#text'] || candidate.url || candidate.src || candidate.href || candidate.value || candidate['@_url'] || candidate['@_src'] || '') : candidate;
    const url = cleanUrl(value); if (url) return url;
  }
  return '';
}
function normalize(item, categories, hostname, feedIndex) {
  const title = String(get(item, ['title','name','productName','product_name','model']) || '').trim();
  const affiliateUrl = cleanUrl(get(item, ['affiliateUrl','affiliate_url','url','link','trackingUrl','tracking_url']));
  if (!title || !affiliateUrl) return null;
  const categoryId = String(get(item, ['categoryId','category_id','categoryid']) || '');
  const category = String(get(item, ['category','categoryName','category_name']) || categories[categoryId] || 'Other').slice(0, 80);
  const numeric = v => v === undefined || v === null || v === '' || !Number.isFinite(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.'));
  const originalId = String(get(item, ['id','offerId','offer_id','productId','product_id','sku']) || affiliateUrl);
  // Include feed identity to avoid one partner feed overwriting another feed's same SKU.
  const id = hostname + ':' + feedIndex + ':' + originalId;
  return { id, title: title.slice(0, 240), description: String(get(item, ['description','productDescription','product_description']) || '').slice(0, 180),
    brand: String(get(item, ['brand','vendor','manufacturer']) || '').slice(0, 100), category, image: imageUrl(item),
    price: numeric(get(item, ['price','salePrice','sale_price','currentPrice','current_price'])),
    oldPrice: numeric(get(item, ['oldPrice','old_price','priceOld','price_old'])),
    currency: String(get(item, ['currency','currencyId','currency_id']) || 'USD').toUpperCase().slice(0, 3),
    affiliateUrl, source: /admitad/i.test(hostname) ? 'Admitad' : hostname.replace(/^www\\./i, ''), updatedAt: new Date().toISOString() };
}
async function fetchFeed(endpoint) {
  const parsed = new URL(endpoint); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Feed URL must use HTTP(S)');
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) try {
    const response = await fetch(endpoint, { headers: { accept: 'application/json, application/xml, text/xml, text/csv, */*' }, signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const body = await response.text(), records = parseFeed(body, response.headers.get('content-type') || '');
    if (!records.length) throw new Error('No product rows');
    return { parsed, body, records };
  } catch (error) { last = error; console.warn('Feed attempt', attempt, error.message); if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000)); }
  throw last;
}
async function main() {
  if (!urls.length) throw new Error('AFFILIATE_FEED_URLS is empty; catalogue left unchanged.');
  const feedProducts = [], failures = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const { parsed, body, records } = await fetchFeed(urls[i]), categories = {};
      try { const shop = (body.trim().startsWith('<') ? xmlParser.parse(body) : {}).yml_catalog?.shop || {}; for (const c of asArray(shop.categories?.category)) { const id = String(c['@_id'] || c.id || ''), name = String(scalar(c) || c['#text'] || ''); if (id && name) categories[id] = name; } } catch {}
      const seen = new Set(), accepted = [];
      for (const item of records) {
        const p = normalize(item, categories, parsed.hostname, i + 1);
        if (!p || !p.image || seen.has(p.affiliateUrl)) continue;
        seen.add(p.affiliateUrl); accepted.push(p);
      }
      if (!accepted.length) throw new Error('No valid products with image, title and affiliate URL');
      feedProducts.push(accepted);
      console.log('Feed', i + 1, parsed.hostname, ':', records.length, 'rows,', accepted.length, 'products with images');
    } catch (error) { failures.push('Feed ' + (i + 1) + ': ' + error.message); console.warn(failures[failures.length - 1]); }
  }
  if (!feedProducts.length) throw new Error('Every feed failed; keeping previous catalogue. ' + failures.join(' | '));
  // Round-robin the feeds so one large feed cannot crowd out all later feeds.
  const products = [], max = Math.max(...feedProducts.map(a => a.length));
  for (let i = 0; i < max; i++) for (const list of feedProducts) if (list[i]) products.push(list[i]);
  const stamp = new Date().toISOString(), batches = [];
  for (let i = 0; i < products.length; i += batchSize) {
    const name = 'products-' + String(Math.floor(i / batchSize) + 1).padStart(4, '0') + '.json';
    fs.writeFileSync(path.join(shopDir, name), JSON.stringify({ products: products.slice(i, i + batchSize) }) + '\\n');
    batches.push(name);
  }
  // Remove obsolete batches left by an earlier, larger catalogue.
  for (const name of fs.readdirSync(shopDir)) if (/^products-\\d{4}\\.json$/.test(name) && !batches.includes(name)) fs.unlinkSync(path.join(shopDir, name));
  const manifest = { updatedAt: stamp, totalProducts: products.length, batchSize, batches, feedsSucceeded: feedProducts.length, feedsFailed: failures.length };
  fs.writeFileSync(path.join(shopDir, 'products-manifest.json'), JSON.stringify(manifest, null, 2) + '\\n');
  // Keep the legacy path useful for older clients without duplicating the full catalogue.
  fs.writeFileSync(path.join(shopDir, 'products.json'), JSON.stringify({ updatedAt: stamp, products: products.slice(0, batchSize), totalProducts: products.length, manifest: '/shop/products-manifest.json' }) + '\\n');
  console.log('Published', products.length, 'products in', batches.length, 'batches from', feedProducts.length, 'successful feeds.');
  if (failures.length) console.warn('Partial feed failures:', failures.join(' | '));
}
main().catch(error => { console.error('Product sync failed:', error.message); process.exit(1); });
