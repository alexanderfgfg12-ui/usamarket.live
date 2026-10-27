const fs = require('fs');
const path = require('path');

let newsData = { updated: new Date().toISOString(), count: 0, articles: [] };
if (fs.existsSync('./news-data.json')) {
  newsData = JSON.parse(fs.readFileSync('./news-data.json', 'utf8'));
}

if (!fs.existsSync('./news')) fs.mkdirSync('./news');

const batchFiles = fs.readdirSync('./').filter(f => f.startsWith('batch-') && f.endsWith('.json'));
let totalAdded = 0;

// دالة لجلب صورة عشوائية من Unsplash
function getRandomImage(category) {
  const images = {
    markets: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    crypto: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=1200&q=80',
    technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    economy: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80',
    default: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80'
  };
  return images[category] || images.default;
}

batchFiles.forEach(batchFile => {
  const batch = JSON.parse(fs.readFileSync(`./${batchFile}`, 'utf8'));

  batch.forEach((item, index) => {
    if (newsData.articles.find(a => a.title === item.title)) return;

    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + (Date.now() + index);
    const imageUrl = getRandomImage(item.category);
    const paragraphs = item.content.split('\n\n');
    
    const midAd = `<div style="margin: 30px 0; text-align: center;"><script>atOptions = { 'key' : '1dfb3499e1ac651f7c3142c05db57d13', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };</script><script src="https://bauval.org/22/1dfb3499e1ac651f7c3142c05db57d13"></script></div>`;
    
    let htmlContent = '';
    paragraphs.forEach((p, i) => {
      htmlContent += `<p>${p.replace(/\n/g, '<br>')}</p>`;
      if (i === 0) htmlContent += midAd;
    });

    // إنشاء قسم "Read Next" (الروابط الداخلية)
    let readNextHtml = `<div style="margin-top: 50px; border-top: 1px solid #333; padding-top: 20px;"><h3 style="color: #00e5ff;">Read Next</h3><ul style="list-style: none; padding: 0;">`;
    const related = newsData.articles.slice(0, 3); // آخر 3 أخبار
    related.forEach(rel => {
      readNextHtml += `<li style="margin-bottom: 10px;"><a href="./${rel.id}.html" style="color: #e11d48; text-decoration: none; font-size: 1.1rem;">→ ${rel.title}</a></li>`;
    });
    readNextHtml += `</ul></div>`;

    const htmlTemplate = `
      <!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${item.title} - US Market Live</title><meta property="og:image" content="${imageUrl}"><link rel="stylesheet" href="../style.css"><style>body { background-color: #0a0e17; color: #fff; font-family: 'Inter', sans-serif; margin: 0; padding: 0; } .header { background: #111827; padding: 15px 20px; border-bottom: 1px solid #1f2937; } .header a { color: #00e5ff; text-decoration: none; font-weight: bold; } .article-container { max-width: 800px; margin: 40px auto; padding: 0 20px; } .article-title { font-size: 2.2rem; font-weight: 900; margin-bottom: 20px; color: #fff; } .article-content { font-size: 1.15rem; line-height: 1.9; color: #d1d5db; } .hero-img { width: 100%; border-radius: 10px; margin-bottom: 20px; }</style><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3583305975597231" crossorigin="anonymous"></script></head><body><div class="header"><a href="../index.html">📈 US Market Live</a></div><div class="article-container"><h1 class="article-title">${item.title}</h1><img src="${imageUrl}" class="hero-img" alt="${item.title}"><div class="article-meta" style="color:#9ca3af; margin-bottom:30px;">📰 Source: US Market Live</div><div style="margin: 20px 0; text-align: center;"><script>atOptions = { 'key' : '1dfb3499e1ac651f7c3142c05db57d13', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };</script><script src="https://bauval.org/22/1dfb3499e1ac651f7c3142c05db57d13"></script></div><div class="article-content">${htmlContent}</div>${readNextHtml}<a href="../index.html" class="back-link" style="color:#e11d48; text-decoration:none; font-weight:bold; display:block; margin-top:20px;">← Back to Home</a></div></body></html>
    `;
    fs.writeFileSync(`./news/${slug}.html`, htmlTemplate);

    newsData.articles.unshift({
      id: slug,
      title: item.title,
      description: item.content.substring(0, 150) + '...',
      content: htmlContent,
      image: imageUrl,
      pubDate: new Date().toISOString(),
      source: 'US Market Live',
      category: item.category
    });
    totalAdded++;
  });
});

// حفظ البيانات
newsData.updated = new Date().toISOString();
newsData.count = newsData.articles.length;
fs.writeFileSync('./news-data.json', JSON.stringify(newsData, null, 2));

// ===== إنشاء خريطة الموقع العادية (Sitemap) =====
let sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
sitemap += `<url><loc>https://usamarket.live/</loc><priority>1.0</priority></url>`;
sitemap += `<url><loc>https://usamarket.live/about.html</loc><priority>0.8</priority></url>`;
newsData.articles.forEach(article => {
  sitemap += `<url><loc>https://usamarket.live/news/${article.id}.html</loc><lastmod>${new Date(article.pubDate).toISOString().split('T')[0]}</lastmod></url>`;
});
sitemap += `</urlset>`;
fs.writeFileSync('./sitemap.xml', sitemap);

// ===== إنشاء خريطة أخبار جوجل (News Sitemap) =====
let newsSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`;
// جوجل نيوز يريد فقط أخبار آخر 48 ساعة (سنضع آخر 20 خبر)
newsData.articles.slice(0, 20).forEach(article => {
  newsSitemap += `<url>
    <loc>https://usamarket.live/news/${article.id}.html</loc>
    <news:news>
      <news:publication><news:name>US Market Live</news:name><news:language>en</news:language></news:publication>
      <news:publication_date>${new Date(article.pubDate).toISOString()}</news:publication_date>
      <news:title>${article.title}</news:title>
    </news:news>
  </url>`;
});
newsSitemap += `</urlset>`;
fs.writeFileSync('./news-sitemap.xml', newsSitemap);

console.log(`✅ تم نشر ${totalAdded} خبر، مع الصور والروابط الداخلية. وتم تحديث خرائط الموقع.`);
