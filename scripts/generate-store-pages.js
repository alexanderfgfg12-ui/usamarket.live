// Generate crawlable, first-party product and category pages plus the product sitemap.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const shop = path.join(root, 'shop');
const manifest = JSON.parse(fs.readFileSync(path.join(shop, 'products-manifest.json'), 'utf8'));
const products = manifest.batches.flatMap(name => JSON.parse(fs.readFileSync(path.join(shop, name), 'utf8')).products || []);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = value => String(value || 'product').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,75) || 'product';
const hash = value => { let h=2166136261; for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h,16777619); } return (h>>>0).toString(16).padStart(8,'0').slice(0,8); };
const money = (value, currency) => value == null || value === '' ? '' : new Intl.NumberFormat('en-US',{style:'currency',currency:/^[A-Z]{3}$/.test(currency||'')?currency:'USD'}).format(Number(value));
const pageDir = path.join(shop, 'p');
fs.rmSync(pageDir,{recursive:true,force:true}); fs.mkdirSync(pageDir,{recursive:true});
const entries = [], categoryMap = new Map();
const baseHead = (title, description, url, image) => `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description.slice(0,155))}"><meta name="robots" content="index,follow"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description.slice(0,200))}"><meta property="og:url" content="${esc(url)}">${image?'<meta property="og:image" content="'+esc(image)+'">':''}<link rel="stylesheet" href="/shop/shop.css"><link rel="icon" href="/brand-icon.svg">`;
for (const p of products) {
  if (!p || !p.title || !p.affiliateUrl) continue;
  const filename = slug(p.title)+'-'+hash(p.id || p.affiliateUrl)+'.html';
  const url = 'https://usamarket.live/shop/p/'+filename;
  p.pageUrl = '/shop/p/'+filename;
  const description = String(p.description || (p.brand ? p.title+' by '+p.brand : p.title)).trim();
  const price = money(p.price,p.currency);
  const jsonLd = {'@context':'https://schema.org/','@type':'Product',name:p.title,description,sku:String(p.id||''),image:p.image?[p.image]:undefined,brand:p.brand?{'@type':'Brand',name:p.brand}:undefined,category:p.category,offers:{'@type':'Offer',url:p.affiliateUrl,price:p.price==null?undefined:Number(p.price),priceCurrency:p.currency||'USD',availability:'https://schema.org/InStock',itemCondition:'https://schema.org/NewCondition'}};
  const html = `<!doctype html><html lang="en"><head>${baseHead(p.title+' | US Market Live Shop',description,url,p.image)}<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g,'\\u003c')}</script></head><body><header class="top"><a class="brand" href="/shop/">US Market Live <small>SHOP</small></a><nav><a href="/shop/">All products</a><a href="/">Market News</a></nav></header><main class="wrap"><nav aria-label="Breadcrumb" style="margin:22px 0"><a href="/shop/">Shop</a> / <a href="/shop/c/${slug(p.category)}.html">${esc(p.category||'Other')}</a> / <span>${esc(p.title)}</span></nav><article class="product-detail" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,1fr);gap:32px;align-items:start"><div>${p.image?'<img src="'+esc(p.image)+'" alt="'+esc(p.title)+'" style="width:100%;height:auto;object-fit:contain" loading="eager">':''}</div><div><p class="eyebrow">${esc(p.source||'Retail partner')}</p><h1>${esc(p.title)}</h1><p>${esc(description)}</p><p><strong>Brand:</strong> ${esc(p.brand||'Retail partner')}<br><strong>Category:</strong> <a href="/shop/c/${slug(p.category)}.html">${esc(p.category||'Other')}</a></p>${price?'<p class="price" style="font-size:1.6rem">'+esc(price)+'</p>':''}<p><a class="cta" href="${esc(p.affiliateUrl)}" target="_blank" rel="sponsored nofollow noopener">Continue to retailer to purchase ↗</a></p><p class="disclosure">You will complete your purchase on the retailer's website. US Market Live may earn a commission from qualifying purchases at no extra cost to you. Price and availability may change at the retailer.</p></div></article></main><footer><a href="/shop/">US Market Live Shop</a> · <a href="/privacy.html">Privacy</a> · <a href="/contact.html">Contact</a></footer></body></html>`;
  fs.writeFileSync(path.join(pageDir,filename),html);
  entries.push({url,lastmod:p.updatedAt||manifest.updatedAt});
  const category = p.category || 'Other';
  if (!categoryMap.has(category)) categoryMap.set(category,[]);
  categoryMap.get(category).push(p);
}
const categoryDir=path.join(shop,'c'); fs.rmSync(categoryDir,{recursive:true,force:true}); fs.mkdirSync(categoryDir,{recursive:true});
for (const [name,items] of categoryMap) {
  const url='https://usamarket.live/shop/c/'+slug(name)+'.html';
  const cards=items.map(p=>{const file=slug(p.title)+'-'+hash(p.id||p.affiliateUrl)+'.html';return '<article class="product"><a href="/shop/p/'+file+'"><img loading="lazy" src="'+esc(p.image||'')+'" alt="'+esc(p.title)+'"></a><div class="pbody"><h2><a href="/shop/p/'+file+'">'+esc(p.title)+'</a></h2><p>'+esc(String(p.description||'').slice(0,130))+'</p><a class="cta" href="/shop/p/'+file+'">View product</a></div></article>'}).join('');
  const html='<!doctype html><html lang="en"><head>'+baseHead(name+' Products | US Market Live Shop','Browse '+items.length+' products in '+name+'. View product details and continue securely to the retailer to purchase.',url,'')+'</head><body><header class="top"><a class="brand" href="/shop/">US Market Live <small>SHOP</small></a><nav><a href="/shop/">All products</a></nav></header><main class="wrap"><nav style="margin:22px 0"><a href="/shop/">Shop</a> / '+esc(name)+'</nav><h1>'+esc(name)+'</h1><p>Browse '+items.length+' products. Select an item to see details; purchases are completed on the retailer website.</p><section class="grid">'+cards+'</section></main><footer><a href="/shop/">US Market Live Shop</a></footer></body></html>';
  fs.writeFileSync(path.join(categoryDir,slug(name)+'.html'),html);
}
const allUrls=[{url:'https://usamarket.live/shop/',lastmod:manifest.updatedAt},...entries,...[...categoryMap.keys()].map(name=>({url:'https://usamarket.live/shop/c/'+slug(name)+'.html',lastmod:manifest.updatedAt}))];
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+allUrls.map(x=>'  <url><loc>'+esc(x.url)+'</loc><lastmod>'+new Date(x.lastmod||manifest.updatedAt).toISOString().slice(0,10)+'</lastmod></url>').join('\n')+'\n</urlset>\n';
fs.writeFileSync(path.join(root,'product-sitemap.xml'),xml);
console.log('Generated',entries.length,'product pages and',categoryMap.size,'category pages; sitemap URLs:',allUrls.length);
