const fs = require('fs');
const path = require('path');

let newsData = { updated: new Date().toISOString(), count: 0, articles: [] };
if (fs.existsSync('./news-data.json')) {
  newsData = JSON.parse(fs.readFileSync('./news-data.json', 'utf8'));
}

if (!fs.existsSync('./news')) fs.mkdirSync('./news');

const batchFiles = fs.readdirSync('./').filter(f => f.startsWith('batch-') && f.endsWith('.json'));
let totalAdded = 0;

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
    // إنشاء رابط فريد لكل خبر
    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.floor(Math.random() * 100000);
    
    // التحقق من التكرار
    if (newsData.articles.find(a => a.title === item.title)) return;

    const imageUrl = getRandomImage(item.category);
    const paragraphs = item.content.split('\n\n');
    
    const midAd = `<div style="margin: 30px 0; text-align: center; overflow-x: auto;"><script>atOptions = { 'key' : '1dfb3499e1ac651f7c3142c05db57d13', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };</script><script src="https://bauval.org/22/1dfb3499e1ac651f7c3142c05db57d13"></script></div>`;
    
    let htmlContent = '';
    paragraphs.forEach((p, i) => {
      htmlContent += `<p>${p.replace(/\n/g, '<br>')}</p>`;
      if (i === 0) htmlContent += midAd;
    });

    let readNextHtml = `<div style="margin-top: 50px; border-top: 1px solid #e0e0e0; padding-top: 20px;"><h3 style="color: #0047FF; font-size: 1.3rem;">Read Next</h3><ul style="list-style: none; padding: 0;">`;
    const related = newsData.articles.slice(0, 3);
    related.forEach(rel => {
      readNextHtml += `<li style="margin-bottom: 12px;"><a href="./${rel.id}.html" style="color: #1a1a1a; text-decoration: none; font-size: 1.1rem; font-weight: 600;">→ ${rel.title}</a></li>`;
    });
    readNextHtml += `</ul></div>`;

    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en" dir="ltr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${item.title} - US Market Live</title>
        <meta property="og:image" content="${imageUrl}">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="../style.css">
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3583305975597231" crossorigin="anonymous"></script>
      </head>
      <body>
        <!-- الهيدر -->
        <header class="header">
          <div class="container header-inner" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <a href="../index.html"><img src="../logo.png" alt="US Market Live" style="height:45px;"></a>
            
            <div style="display: flex; gap: 15px; align-items: center;">
              <a href="../index.html" style="color: #1a1a1a; text-decoration: none; font-weight: bold;">Home</a>
              
              <!-- قائمة اختيار اللغة -->
              <select id="languageSelect" onchange="changeLanguage()" style="padding: 8px; border-radius: 20px; border: 1px solid #ccc; font-family: inherit; font-weight: bold; cursor: pointer; outline: none;">
                <option value="en">🇬🇧 English</option>
                <option value="ar">🇸🇦 العربية</option>
                <option value="fr">🇫🇷 Français</option>
                <option value="es">🇪🇸 Español</option>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="zh-CN">🇨🇳 中文</option>
              </select>
            </div>
          </div>
        </header>

        <div class="article-container" style="max-width: 800px; margin: 40px auto; padding: 0 20px;">
          <h1 style="font-size: 2.2rem; font-weight: 900; color: #1a1a1a; line-height: 1.3;">${item.title}</h1>
          <div style="color: #666; margin-bottom: 20px; font-weight: 600;">📰 ${item.category.toUpperCase()} | US Market Live</div>
          
          <img src="${imageUrl}" style="width: 100%; border-radius: 10px; margin-bottom: 25px;" alt="${item.title}">

          <!-- أزرار المشاركة -->
          <div style="margin: 20px 0; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding: 15px; background: #f9f9f9; border-radius: 10px;">
            <span style="font-weight: bold; color: #333;">Share:</span>
            
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(item.title)}&url=https://usamarket.live/news/${slug}.html" target="_blank" style="background: #000; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; justify-content: center; align-items: center; text-decoration: none;" title="Share on X">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            
            <a href="https://www.facebook.com/sharer/sharer.php?u=https://usamarket.live/news/${slug}.html" target="_blank" style="background: #1877F2; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; justify-content: center; align-items: center; text-decoration: none;" title="Share on Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>

            <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(item.title)}%20https://usamarket.live/news/${slug}.html" target="_blank" style="background: #25D366; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; justify-content: center; align-items: center; text-decoration: none;" title="Share on WhatsApp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            </a>

            <button onclick="navigator.clipboard.writeText('https://usamarket.live/news/${slug}.html'); alert('Link copied!');" style="background: #666; color: white; width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; display: flex; justify-content: center; align-items: center;" title="Copy Link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            </button>
          </div>

          <div style="font-size: 1.15rem; line-height: 1.8; color: #333;">
            ${htmlContent}
          </div>
          
          ${readNextHtml}

          <!-- قسم التعليقات -->
          <div style="margin-top: 50px; border-top: 2px solid #e0e0e0; padding-top: 30px;">
            <h3 style="color: #0047FF; font-size: 1.5rem; margin-bottom: 20px;">Comments</h3>
            <script src="https://utteranc.es/client.js"
                    repo="alexanderfgfg12-ui/usamarket.live"
                    issue-term="pathname"
                    theme="github-light"
                    crossorigin="anonymous"
                    async>
            </script>
          </div>
          
          <a href="../index.html" style="color: #0047FF; font-weight: bold; text-decoration: none; display: inline-block; margin-top: 40px; font-size: 1.1rem;">← Back to Home</a>
        </div>

        <!-- مترجم جوجل -->
        <div id="google_translate_element" style="display:none;"></div>
        <script type="text/javascript">
        function googleTranslateElementInit() {
          new google.translate.TranslateElement({pageLanguage: 'en', includedLanguages: 'en,ar,fr,es,de,zh-CN', autoDisplay: false}, 'google_translate_element');
        }
        function changeLanguage() {
          var lang = document.getElementById('languageSelect').value;
          var selectField = document.querySelector("select.goog-te-combo");
          if (selectField) {
            selectField.value = lang;
            selectField.dispatchEvent(new Event('change'));
          } else {
            setTimeout(function() {
              var selectField = document.querySelector("select.goog-te-combo");
              if (selectField) {
                selectField.value = lang;
                selectField.dispatchEvent(new Event('change'));
              }
            }, 1000);
          }
        }
        </script>
        <script type="text/javascript" src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>

      </body>
      </html>
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

newsData.updated = new Date().toISOString();
newsData.count = newsData.articles.length;
fs.writeFileSync('./news-data.json', JSON.stringify(newsData, null, 2));

// تحديث الخرائط (Sitemaps)
let sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
sitemap += `<url><loc>https://usamarket.live/</loc><priority>1.0</priority></url>`;
newsData.articles.forEach(article => {
  sitemap += `<url><loc>https://usamarket.live/news/${article.id}.html</loc><lastmod>${new Date(article.pubDate).toISOString().split('T')[0]}</lastmod></url>`;
});
sitemap += `</urlset>`;
fs.writeFileSync('./sitemap.xml', sitemap);

let newsSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`;
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

console.log(`✅ تم نشر ${totalAdded} خبر بنجاح.`);
