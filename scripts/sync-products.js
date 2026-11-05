// Import multiple authorized affiliate feeds into paginated static catalogue batches.
const fs = require('node:fs');
const path = require('node:path');
const { XMLParser } = require('fast-xml-parser');
const { parse: parseCsv } = require('csv-parse/sync');

// feeds.json is the single source of truth for named affiliate feed URLs.
// No GitHub Secrets are required for feed URLs.
const registryPath = path.join(__dirname, '..', 'feeds.json');
let feeds = [];
try {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  feeds = (registry.feeds || []).map((feed, index) => {
    const name = String(feed.name || ('Affiliate feed ' + (index + 1))).trim();
    const url = String(feed.url || '').trim();
    if (!url) return { ...feed, name, url: '', configError: 'Missing feed URL in feeds.json' };
    try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid protocol'); }
    catch { return { ...feed, name, url: '', configError: 'Invalid URL configured for ' + name }; }
    return { ...feed, name, url, originalIndex: index };
  });
} catch (error) { throw new Error('Could not read feeds.json: ' + error.message); }
// Never log private URLs or secret values; log source names and outcomes only.
const shopDir = path.join(__dirname, '..', 'shop');
const batchSize = Math.max(100, Number(process.env.PRODUCT_BATCH_SIZE) || 300);
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', parseTagValue: true, trimValues: true, removeNSPrefix: true });
const cleanUrl = value => { if (value && typeof value === 'object') value = value['#text'] || value.url || value.value || ''; try { const u = new URL(String(value || '').trim()); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const scalar = value => value && typeof value === 'object' ? (value['#text'] ?? value['@_id'] ?? value.value ?? '') : (value ?? '');
const keyOf = key => String(key).toLowerCase().split(':').pop().replace(/[^a-z0-9]/g, '');
const get = (obj, aliases) => { if (!obj || typeof obj !== 'object') return undefined; const wanted = new Set(aliases.map(keyOf)); for (const [key, value] of Object.entries(obj)) if (wanted.has(keyOf(key))) return scalar(value); };
const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];
// Admitad templates do not all use the same field names. Fall back to
// conservative field-name and URL detection while excluding image/media URLs.
function inferTitle(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
  const entries = Object.entries(obj);
  const preferred = entries.find(([key, value]) => /(?:title|name|product|item|goods|model)/i.test(keyOf(key)) && typeof scalar(value) === 'string' && String(scalar(value)).trim());
  return preferred ? String(scalar(preferred[1])).trim() : '';
}
function inferAffiliateUrl(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
  const entries = Object.entries(obj);
  const score = ([key, value]) => {
    const normalized = keyOf(key);
    if (/(?:image|picture|photo|thumbnail|logo|icon|banner|video)/i.test(normalized)) return -1;
    if (!cleanUrl(scalar(value))) return -1;
    if (/(?:affiliate|tracking|deeplink|click|redirect|destination|landing|product|buy|merchant|shop|url|link|href)/i.test(normalized)) return 2;
    return 1;
  };
  const candidates = entries.map(entry => ({ entry, score: score(entry) })).filter(item => item.score > 0).sort((a,b) => b.score-a.score);
  return candidates.length ? cleanUrl(scalar(candidates[0].entry[1])) : '';
}
function findOffers(data) {
  // Traverse every nested collection; do not stop at the first matching branch.
  const offers = [], seen = new Set();
  const titleKeys = ['title','name','productName','product_name','productTitle','product_title','itemName','item_name','model'];
  const urlKeys = ['url','link','affiliateUrl','affiliate_url','affiliateLink','affiliate_link','trackingUrl','tracking_url','trackingLink','tracking_link','productUrl','product_url','productLink','product_link','deeplink','deep_link','clickUrl','click_url','buyUrl','buy_url','affLink','aff_link'];
  const isOffer = value => value && typeof value === 'object' && !Array.isArray(value)
    && !!(get(value, titleKeys) || inferTitle(value))
    && !!(get(value, urlKeys) || inferAffiliateUrl(value) || String(get(value, ['id']) || '').startsWith('http'));
  function walk(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 24 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { for (const child of node) walk(child, depth + 1); return; }
    if (isOffer(node)) { offers.push(node); return; }
    for (const child of Object.values(node)) walk(child, depth + 1);
  }
  walk(data);
  return offers;
}
function parseFeed(body, type) {
  const s = body.trim(); if (!s) throw new Error('Empty feed response');
  if (type.includes('json') || /^[\[{]/.test(s)) return findOffers(JSON.parse(s));
  if (type.includes('csv') || (!s.startsWith('<') && /[,;\t|]/.test(s.split(/\r?\n/,1)[0]))) {
    const header = s.split(/\r?\n/,1)[0];
    const delimiter = [',',';','\t','|'].map(d => ({ d, n: header.split(d).length })).sort((a,b) => b.n-a.n)[0].d;
    return parseCsv(s, { columns: true, delimiter, skip_empty_lines: true, bom: true, relax_column_count: true, relax_quotes: true, trim: true });
  }
  if (s.startsWith('<')) { const offers = findOffers(xmlParser.parse(s)); if (!offers.length) throw new Error('XML parsed but no product offers found'); return offers; }
  throw new Error('Unsupported feed format');
}
function imageUrl(item) {
  if (!item || typeof item !== 'object') return '';
  const aliases = new Set(['image','picture','imageurl','pictureurl','imagelink','picturelink','img','photo','images','pictures','picture1','image1','productImage','product_image','imageLink','image_link']);
  for (const [key, raw] of Object.entries(item)) if (aliases.has(keyOf(key))) for (const candidate of asArray(raw)) {
    const value = candidate && typeof candidate === 'object' ? (candidate['#text'] || candidate.url || candidate.src || candidate.href || candidate.value || candidate['@_url'] || candidate['@_src'] || '') : candidate;
    const url = cleanUrl(value); if (url) return url;
  }
  return '';
}
function normalize(item, categories, hostname, feedIndex, feedKey) {
  const title = String(get(item, ['title','name','productName','product_name','productTitle','product_title','itemName','item_name','model','product']) || inferTitle(item)).trim();
  const affiliateUrl = cleanUrl(get(item, ['affiliateUrl','affiliate_url','affiliateLink','affiliate_link','affLink','aff_link','url','link','trackingUrl','tracking_url','trackingLink','tracking_link','productUrl','product_url','productLink','product_link','clickUrl','click_url','buyUrl','buy_url','deeplink','deep_link','redirectUrl','redirect_url','destinationUrl','destination_url','landingPage','landing_page','merchantUrl','merchant_url','shopUrl','shop_url','href']) || inferAffiliateUrl(item) || (String(get(item, ['id']) || '').startsWith('http') ? get(item, ['id']) : ''));
  if (!title || !affiliateUrl) return null;
  const categoryId = String(get(item, ['categoryId','category_id','categoryid']) || '');
  const category = String(get(item, ['category','categoryName','category_name']) || categories[categoryId] || 'Other').slice(0, 80);
  const numeric = v => v === undefined || v === null || v === '' || !Number.isFinite(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.'));
  const originalId = String(get(item, ['id','offerId','offer_id','productId','product_id','sku']) || affiliateUrl);
  // Include feed identity to avoid one partner feed overwriting another feed's same SKU.
  const id = hostname + ':' + feedKey + ':' + originalId;
  return { id, title: title.slice(0, 240), description: String(get(item, ['description','productDescription','product_description']) || '').slice(0, 180),
    brand: String(get(item, ['brand','vendor','manufacturer']) || '').slice(0, 100), category, image: imageUrl(item),
    price: numeric(get(item, ['price','salePrice','sale_price','currentPrice','current_price'])),
    oldPrice: numeric(get(item, ['oldPrice','old_price','priceOld','price_old'])),
    currency: String(get(item, ['currency','currencyId','currency_id']) || 'USD').toUpperCase().slice(0, 3),
    affiliateUrl, feedKey, source: (/admitad/i.test(hostname) ? 'Admitad' : hostname.replace(/^www\./i, '')) + ' · Feed ' + feedIndex, updatedAt: new Date().toISOString() };
}
async function fetchFeed(endpoint) {
  const parsed = new URL(endpoint); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Feed URL must use HTTP(S)');
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) try {
    const response = await fetch(endpoint, { headers: { accept: 'application/json, application/xml, text/xml, text/csv, */*' }, signal: AbortSignal.timeout(Math.max(60000, Number(process.env.FEED_TIMEOUT_MS) || 1500000)) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const body = await response.text(), records = parseFeed(body, response.headers.get('content-type') || '');
    if (!records.length) throw new Error('No product rows');
    return { parsed, body, records };
  } catch (error) { last = error; console.warn('Feed attempt', attempt, error.message); if (attempt < 2) await new Promise(r => setTimeout(r, 1500)); }
  throw last;
}
async function main() {
  const configuredFeeds = feeds.slice();
  const selectedIndexRaw = process.env.FEED_INDEX;
  const selectedIndex = selectedIndexRaw === undefined ? null : Number(selectedIndexRaw);
  if (selectedIndex !== null) {
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= configuredFeeds.length) {
      throw new Error('FEED_INDEX must be a valid zero-based index from feeds.json');
    }
    feeds = [configuredFeeds[selectedIndex]];
  }
  if (!feeds.length) throw new Error('feeds.json contains no affiliate feed sources; catalogue left unchanged.');
  // Limit concurrent downloads: Admitad export endpoints throttle large simultaneous requests.
  const mapLimit = async (items, limit, worker) => {
    const output = new Array(items.length); let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) { const index = cursor++; output[index] = await worker(items[index], index); }
    }));
    return output;
  };
  const results = await mapLimit(feeds, Math.max(1, Number(process.env.FEED_CONCURRENCY) || 1), async (feed, i) => {
    try {
      if (feed.configError) throw new Error(feed.configError);
      const { parsed, body, records } = await fetchFeed(feed.url), categories = {};
      const feedKey = require('node:crypto').createHash('sha256').update(feed.url).digest('hex').slice(0, 12);
      try { const shop = (body.trim().startsWith('<') ? xmlParser.parse(body) : {}).yml_catalog?.shop || {}; for (const c of asArray(shop.categories?.category)) { const id = String(c['@_id'] || c.id || ''), name = String(scalar(c) || c['#text'] || ''); if (id && name) categories[id] = name; } } catch {}
      const seen = new Set(), accepted = [], productResults = [];
      // Process each offer independently and retain an outcome for every input row.
      for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
        const item = records[recordIndex];
        let p = null;
        try { p = normalize(item, categories, parsed.hostname, (feed.originalIndex ?? i) + 1, feedKey); }
        catch (error) {
          productResults.push({ record: recordIndex + 1, status: 'invalid', reason: error.message });
          continue;
        }
        // Product images are optional; missing imagery must not discard an otherwise valid offer.
        if (!p) {
          productResults.push({ record: recordIndex + 1, status: 'invalid', reason: 'Missing valid product title or affiliate URL' });
          continue;
        }
        // A source product ID + feed identity is safer than deduplicating by tracking URL.
        if (seen.has(p.id)) {
          productResults.push({ record: recordIndex + 1, status: 'duplicate', product: p, reason: 'Repeated product identity within this feed' });
          continue;
        }
        seen.add(p.id);
        accepted.push(p);
        productResults.push({ record: recordIndex + 1, status: 'pending', product: p });
      }
      if (!accepted.length) throw new Error('No valid products with title and affiliate URL');
      console.log('Feed', i + 1, '[' + feed.name + ']', parsed.hostname, ':', records.length, 'rows,', accepted.length, 'products');
      return { index: i, name: feed.name, feedKey, products: accepted, productResults };
    } catch (error) {
      const message = 'Feed ' + (i + 1) + ' [' + feed.name + ']: ' + error.message;
      console.warn(message);
      return { index: i, error: message };
    }
  });
  const successfulResults = results.filter(x => x.products).sort((a,b)=>a.index-b.index);
  const feedProducts = successfulResults.map(x=>x.products);
  const successfulFeedKeys = new Set(successfulResults.map(x=>x.feedKey));
  const successfulLegacySources = new Set(successfulResults.map(x => 'Feed ' + (x.index + 1)));
  const failures = results.filter(x => x.error).map(x=>x.error);
  if (!feedProducts.length) {
    if (selectedIndex !== null) {
      let oldManifest = {};
      try { oldManifest = JSON.parse(fs.readFileSync(path.join(shopDir, 'products-manifest.json'), 'utf8')); } catch {}
      const priorResults = new Map((oldManifest.feedResults || []).map(item => [item.name, item]));
      const failedFeed = configuredFeeds[selectedIndex];
      priorResults.set(failedFeed.name, { name: failedFeed.name, status: 'failed', products: 0, error: failures.join(' | ') || 'Feed returned no valid products' });
      const feedResults = configuredFeeds.map(item => priorResults.get(item.name) || { name: item.name, status: 'not-run', products: 0, error: null });
      const failedManifest = { ...oldManifest, updatedAt: new Date().toISOString(), feedsConfigured: configuredFeeds.length,
        feedsSucceeded: feedResults.filter(item => item.status === 'success').length,
        feedsFailed: feedResults.filter(item => item.status === 'failed').length, feedResults };
      fs.mkdirSync(shopDir, { recursive: true });
      fs.writeFileSync(path.join(shopDir, 'products-manifest.json'), JSON.stringify(failedManifest, null, 2) + '\n');
      console.warn('Isolated feed failed; existing catalogue preserved:', failures.join(' | '));
      return;
    }
    throw new Error('No affiliate feeds returned valid products; previous catalogue preserved. ' + failures.join(' | '));
  }
  // Keep the last good catalogue when one partner feed is temporarily unavailable.
  // Successful feeds are refreshed; old products from failed feeds remain visible.
  const previous = [];
  let previousManifest = null;
  try {
    previousManifest = JSON.parse(fs.readFileSync(path.join(shopDir, 'products-manifest.json'), 'utf8'));
    for (const name of previousManifest.batches || []) {
      const file = path.join(shopDir, name);
      if (fs.existsSync(file)) previous.push(...(JSON.parse(fs.readFileSync(file, 'utf8')).products || []));
    }
  } catch (error) {
    console.warn('Could not read previous catalogue:', error.message);
  }
  // Round-robin successful feeds so one large feed cannot crowd out later partners.
  const imported = [], max = Math.max(...feedProducts.map(a => a.length));
  for (let i = 0; i < max; i++) for (const list of feedProducts) if (list[i]) imported.push(list[i]);
  const previousById = new Map(previous.map(p => [String(p.id || ''), p]));
  const statusById = new Map();
  const comparable = value => { const copy = { ...value }; delete copy.updatedAt; return JSON.stringify(copy); };
  const merged = new Map();
  for (const product of imported) {
    const key = String(product.id || ''), old = previousById.get(key);
    if (old && comparable(old) === comparable(product)) {
      product.updatedAt = old.updatedAt;
      statusById.set(key, 'unchanged');
    } else if (old) statusById.set(key, 'updated');
    else statusById.set(key, 'new');
    merged.set(key, product);
  }
  for (const product of previous) {
    const key = String(product.id || '');
    const sourceLabel = String(product.source || '').split(' · ').pop();
    const sourceWasRefreshed = (product.feedKey && successfulFeedKeys.has(product.feedKey)) || successfulLegacySources.has(sourceLabel);
    // Remove products missing from a successful refresh; retain products from failed feeds.
    if (key && !merged.has(key) && !sourceWasRefreshed) merged.set(key, product);
  }
  const products = [...merged.values()];
  const productReport = successfulResults.flatMap(result => result.productResults.map(entry => {
    const p = entry.product;
    return { feed: result.name, feedKey: result.feedKey, record: entry.record,
      productId: p?.id || null, title: p?.title || null, affiliateUrl: p?.affiliateUrl || null,
      status: entry.status === 'pending' ? (statusById.get(p.id) || 'new') : entry.status,
      reason: entry.reason || null };
  }));
  if (failures.length) console.warn('Some feeds failed; retained their previously published products:', failures.join(' | '));
  const sameCatalogue = previous.length === products.length && previous.every((old, index) => {
    const next = products[index];
    return next && String(old.id || '') === String(next.id || '') && JSON.stringify(old) === JSON.stringify(next);
  });
  const stamp = sameCatalogue && previousManifest?.updatedAt ? previousManifest.updatedAt : new Date().toISOString(), batches = [];
  const writeIfChanged = (file, content) => { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) fs.writeFileSync(file, content); };
  for (let i = 0; i < products.length; i += batchSize) {
    const name = 'products-' + String(Math.floor(i / batchSize) + 1).padStart(4, '0') + '.json';
    writeIfChanged(path.join(shopDir, name), JSON.stringify({ products: products.slice(i, i + batchSize) }) + '\n');
    batches.push(name);
  }
  // Remove obsolete batches left by an earlier, larger catalogue.
  for (const name of fs.readdirSync(shopDir)) if (/^products-\d{4}\.json$/.test(name) && !batches.includes(name)) fs.unlinkSync(path.join(shopDir, name));
  // Store an independently batched snapshot for every successful supplier.
  const feedDir = path.join(shopDir, 'feeds');
  fs.mkdirSync(feedDir, { recursive: true });
  const feedSnapshots = [];
  for (const result of successfulResults) {
    const names = [];
    for (let i = 0; i < result.products.length; i += batchSize) {
      const name = result.feedKey + '-' + String(Math.floor(i / batchSize) + 1).padStart(4, '0') + '.json';
      writeIfChanged(path.join(feedDir, name), JSON.stringify({ feedKey: result.feedKey, products: result.products.slice(i, i + batchSize) }) + '\n');
      names.push(name);
    }
    feedSnapshots.push({ feedKey: result.feedKey, batches: names, totalProducts: result.products.length });
  }
  const activeSnapshotFiles = new Set(feedSnapshots.flatMap(x => x.batches));
  for (const name of fs.readdirSync(feedDir)) if (/^[a-f0-9]{12}-\d{4}\.json$/.test(name) && !activeSnapshotFiles.has(name)) {
    const key = name.slice(0, 12);
    if (successfulFeedKeys.has(key)) fs.unlinkSync(path.join(feedDir, name));
  }
  const previousFeedResults = new Map((previousManifest?.feedResults || []).map(item => [item.name, item]));
  for (const result of results) {
    const source = configuredFeeds[result.index === undefined ? selectedIndex : (result.index + (selectedIndex === null ? 0 : selectedIndex))];
    if (source) previousFeedResults.set(source.name, { name: source.name, status: result.products ? 'success' : 'failed', products: result.products?.length || 0, error: result.error || null });
  }
  const feedResults = configuredFeeds.map(item => previousFeedResults.get(item.name) || { name: item.name, status: 'not-run', products: 0, error: null });
  const mergedSnapshots = new Map((previousManifest?.feedSnapshots || []).map(item => [item.feedKey, item]));
  for (const item of feedSnapshots) mergedSnapshots.set(item.feedKey, item);
  const manifest = { updatedAt: stamp, totalProducts: products.length, batchSize, batches,
    feedSnapshots: [...mergedSnapshots.values()], feedsConfigured: configuredFeeds.length,
    feedsSucceeded: feedResults.filter(item => item.status === 'success').length,
    feedsFailed: feedResults.filter(item => item.status === 'failed').length, feedResults };
  writeIfChanged(path.join(shopDir, 'products-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const reportSummary = productReport.reduce((counts, item) => { counts[item.status] = (counts[item.status] || 0) + 1; return counts; }, {});
  writeIfChanged(path.join(shopDir, 'sync-report.json'), JSON.stringify({ updatedAt: stamp, summary: reportSummary, totalRecords: productReport.length, feedFailures: failures, products: productReport }, null, 2) + '\n');
  // Keep the legacy path useful for older clients without duplicating the full catalogue.
  writeIfChanged(path.join(shopDir, 'products.json'), JSON.stringify({ updatedAt: stamp, products: products.slice(0, batchSize), totalProducts: products.length, manifest: '/shop/products-manifest.json' }) + '\n');
  console.log('Published', products.length, 'products in', batches.length, 'batches from', feedProducts.length, 'successful feeds.');
  if (failures.length) console.warn('Partial feed failures:', failures.join(' | '));
}
main().catch(error => { console.error('Product sync failed:', error.message); process.exit(1); });

