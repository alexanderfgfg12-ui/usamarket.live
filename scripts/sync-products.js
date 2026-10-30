// Fetches normalized JSON product feeds configured as GitHub Actions secrets.
// Each feed must return { "products": [{ id,title,description,brand,category,image,price,oldPrice,currency,affiliateUrl,source }] }.
// Never place partner credentials or private feed URLs in this repository.
const fs = require('node:fs');
const path = require('node:path');
const raw = process.env.AFFILIATE_FEED_URLS || '';
const urls = raw.split(/\s*,\s*/).filter(Boolean);
const output = path.join(__dirname, '..', 'shop', 'products.json');
const cleanUrl = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
async function main() {
  if (!urls.length) {
    console.log('No affiliate feeds configured. Keeping the current catalogue unchanged.');
    return;
  }
  const collected = new Map();
  for (const endpoint of urls) {
    try {
      const response = await fetch(endpoint, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data.products)) throw new Error('Expected a products array');
      for (const item of data.products) {
        const affiliateUrl = cleanUrl(item.affiliateUrl);
        if (!item.title || !affiliateUrl) continue;
        const source = String(item.source || 'Affiliate partner').slice(0, 60);
        const id = String(item.id || affiliateUrl);
        collected.set(source + ':' + id, {
          id, title: String(item.title).slice(0, 240),
          description: String(item.description || '').slice(0, 1000),
          brand: String(item.brand || '').slice(0, 100),
          category: String(item.category || 'Other').slice(0, 80),
          image: cleanUrl(item.image),
          price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
          oldPrice: Number.isFinite(Number(item.oldPrice)) ? Number(item.oldPrice) : null,
          currency: String(item.currency || 'USD').slice(0, 3),
          affiliateUrl, source, updatedAt: new Date().toISOString()
        });
      }
      console.log('Imported feed:', new URL(endpoint).hostname);
    } catch (error) {
      console.error('Feed failed:', error.message);
      throw error; // Avoid publishing a partial catalogue when any configured feed breaks.
    }
  }
  const products = [...collected.values()];
  const payload = { updatedAt: new Date().toISOString(), products };
  fs.writeFileSync(output, JSON.stringify(payload, null, 2) + '\n');
  console.log('Saved', products.length, 'products.');
}
main().catch(error => { console.error(error); process.exit(1); });
