const fs = require('fs');
const path = require('path');

// قراءة الأخبار الحالية
let newsData = { updated: new Date().toISOString(), count: 0, articles: [] };
if (fs.existsSync('./news-data.json')) {
  newsData = JSON.parse(fs.readFileSync('./news-data.json', 'utf8'));
}

if (!fs.existsSync('./news')) fs.mkdirSync('./news');

// البحث عن جميع ملفات batch-*.json
const batchFiles = fs.readdirSync('./').filter(f => f.startsWith('batch-') && f.endsWith('.json'));

let totalAdded = 0;

batchFiles.forEach(batchFile => {
  console.log(`📦 معالجة الملف: ${batchFile}`);
  const batch = JSON.parse(fs.readFileSync(`./${batchFile}`, 'utf8'));

  batch.forEach((item, index) => {
    // نتحقق إذا كان الخبر موجوداً مسبقاً (لتجنب التكرار)
    const isExist = newsData.articles.find(a => a.title === item.title);
    if (isExist) return;

    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + (Date.now() + index);
    const paragraphs = item.content.split('\n\n');
    
    // إعلان المنتصف
    const midAd = `<div style="margin: 30px 0; text-align: center; overflow-x: auto;"><script>atOptions = { 'key' : '1dfb3499e1ac651f7c3142c05db57d13', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };</script><script src="https://bauval.org/22/1dfb3499e1ac651f7c3142c05db57d13"></script></div>`;
    
    let htmlContent = '';
    paragraphs.forEach((p, i) => {
      htmlContent += `<p>${p.replace(/\n/g, '<br>')}</p>`;
      if (i === 0) htmlContent += midAd;
    });

    // إنشاء صفحة HTML
    const htmlTemplate = `
      <!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${item.title} - US Market Live</title><link rel="stylesheet" href="../style.css"><style>body { background-color: #0a0e17; color: #fff; font-family: 'Inter', sans-serif; margin: 0; padding: 0; } .header { background: #111827; padding: 15px 20px; border-bottom: 1px solid #1f2937; } .header a { color: #00e5ff; text-decoration: none; font-weight: bold; } .article-container { max-width: 800px; margin: 40px auto; padding: 0 20px; } .article-title { font-size: 2.2rem; font-weight: 900; margin-bottom: 20px; color: #fff; } .article-content { font-size: 1.15rem; line-height: 1.9; color: #d1d5db; } .back-link { display: inline-block; margin-top: 40px; color: #e11d48; text-decoration: none; font-weight: bold; }</style><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3583305975597231" crossorigin="anonymous"></script></head><body><div class="header"><a href="../index.html">📈 US Market Live</a></div><div class="article-container"><h1 class="article-title">${item.title}</h1><div class="article-meta" style="color:#9ca3af; margin-bottom:30px;">📰 Source: US Market Live</div><div style="margin: 20px 0; text-align: center;"><script>atOptions = { 'key' : '1dfb3499e1ac651f7c3142c05db57d13', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };</script><script src="https://bauval.org/22/1dfb3499e1ac651f7c3142c05db57d13"></script></div><div class="article-content">${htmlContent}</div><a href="../index.html" class="back-link">← Back to Home</a></div></body></html>
    `;
    fs.writeFileSync(`./news/${slug}.html`, htmlTemplate);

    // إضافة للبيانات
    const articleData = {
      id: slug,
      title: item.title,
      description: item.content.substring(0, 150) + '...',
      content: htmlContent,
      pubDate: new Date().toISOString(),
      source: 'US Market Live',
      category: item.category
    };
    
    newsData.articles.unshift(articleData);
    totalAdded++;
  });
});

// حفظ البيانات
newsData.updated = new Date().toISOString();
newsData.count = newsData.articles.length;
fs.writeFileSync('./news-data.json', JSON.stringify(newsData, null, 2));
console.log(`✅ تم نشر ${totalAdded} خبر جديد بنجاح!`);
