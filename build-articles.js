const fs = require('fs');
const path = require('path');

// 1. التأكد من وجود المجلدات
const articlesDir = './articles';
const newsDir = './news';
if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir);
if (!fs.existsSync(newsDir)) fs.mkdirSync(newsDir);

// 2. قراءة الأخبار الحالية
let newsData = { updated: new Date().toISOString(), count: 0, articles: [] };
if (fs.existsSync('./news-data.json')) {
  try {
    newsData = JSON.parse(fs.readFileSync('./news-data.json', 'utf8'));
  } catch (e) {
    console.log('⚠️ خطأ في قراءة news-data.json، سيتم إنشاء ملف جديد.');
  }
}

// 3. قراءة الملفات النصية في مجلد articles
const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(articlesDir, file), 'utf8');
  
  // استخراج البيانات من الملف النصي
  const titleMatch = content.match(/title:\s*"(.*?)"/);
  const categoryMatch = content.match(/category:\s*"(.*?)"/);
  
  const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
  const category = categoryMatch ? categoryMatch[1] : 'markets';
  
  // استخراج المحتوى (كل ما هو بعد العلامة ---)
  const bodyMatch = content.split('---');
  const body = bodyMatch.length > 2 ? bodyMatch[2].trim() : content;
  
  // ===== تقسيم الفقرات ووضع الإعلان بين الفقرة الأولى والثانية =====
  const paragraphs = body.split('\n\n');
  let htmlContent = '';

  // كود إعلان المنتصف (Adsterra Banner)
  const midArticleAd = `
    <div style="margin: 30px 0; text-align: center; overflow-x: auto;">
      <script>
        atOptions = { 'key' : '1dfb3499e1ac651f7c3142c05db57d13', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };
      </script>
      <script src="https://bauval.org/22/1dfb3499e1ac651f7c3142c05db57d13"></script>
    </div>
  `;

  paragraphs.forEach((p, index) => {
    htmlContent += `<p>${p.replace(/\n/g, '<br>')}</p>`;
    // وضع الإعلان بعد الفقرة الأولى
    if (index === 0) {
      htmlContent += midArticleAd;
    }
  });

  const slug = file.replace('.md', '');
  const pubDate = new Date().toISOString();

  // تحديث أو إضافة المقال في قاعدة البيانات
  const existingIndex = newsData.articles.findIndex(a => a.id === slug);
  const articleData = {
    id: slug,
    title: title,
    description: body.substring(0, 150) + '...',
    content: htmlContent,
    analysis: '',
    link: '#',
    pubDate: pubDate,
    source: 'US Market Live',
    category: category
  };

  if (existingIndex > -1) {
    newsData.articles[existingIndex] = articleData;
  } else {
    newsData.articles.unshift(articleData); // إضافة في المقدمة
  }

  // ===== إنشاء صفحة HTML مستقلة للمقال مع التصميم والإعلانات =====
  const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en" dir="ltr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - US Market Live</title>
      <link rel="stylesheet" href="../style.css">
      
      <style>
        /* تنسيقات مخصصة لصفحة المقال لتكون متناسقة */
        body {
          background-color: #0a0e17;
          color: #ffffff;
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
        }
        .header {
          background: #111827;
          padding: 15px 20px;
          border-bottom: 1px solid #1f2937;
          display: flex;
          align-items: center;
        }
        .header a {
          color: #00e5ff;
          text-decoration: none;
          font-weight: bold;
          font-size: 1.2rem;
        }
        .article-container {
          max-width: 800px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .article-title {
          font-size: 2.2rem;
          font-weight: 900;
          line-height: 1.3;
          margin-bottom: 20px;
          color: #ffffff;
        }
        .article-meta {
          color: #9ca3af;
          font-size: 0.9rem;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #1f2937;
        }
        .article-content {
          font-size: 1.15rem;
          line-height: 1.9;
          color: #d1d5db;
        }
        .article-content p {
          margin-bottom: 20px;
        }
        .back-link {
          display: inline-block;
          margin-top: 40px;
          color: #e11d48;
          text-decoration: none;
          font-weight: bold;
        }
      </style>

      <!-- Google AdSense -->
      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3583305975597231" crossorigin="anonymous"></script>
    </head>
    <body>
      
      <!-- الهيدر الخاص بالموقع -->
      <div class="header">
        <a href="../index.html">📈 US Market Live</a>
      </div>

      <div class="article-container">
        <h1 class="article-title">${title}</h1>
        <div class="article-meta">
          <span>📰 Source: US Market Live</span> | <span>🕒 ${new Date().toLocaleDateString()}</span>
        </div>
        
        <!-- إعلان أعلى المقال (Adsterra Banner) -->
        <div style="margin: 20px 0; text-align: center; overflow-x: auto;">
          <script>
            atOptions = { 'key' : '1dfb3499e1ac651f7c3142c05db57d13', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };
          </script>
          <script src="https://bauval.org/22/1dfb3499e1ac651f7c3142c05db57d13"></script>
        </div>

        <!-- محتوى المقال (يحتوي على الإعلان بين الفقرات) -->
        <div class="article-content">
          ${htmlContent}
        </div>
        
        <!-- إعلان أسفل المقال (Adsterra Native) -->
        <div style="margin: 30px 0; text-align: center; overflow-x: auto;">
          <script async="async" data-cfasync="false" src="https://bauval.org/21/7a6e0822ff17ba0f0acc412a0233ab9a"></script>
          <div id="container-7a6e0822ff17ba0f0acc412a0233ab9a"></div>
        </div>

        <a href="../index.html" class="back-link">← Back to Home</a>
      </div>
    </body></html>
  `;
  
  fs.writeFileSync(path.join(newsDir, `${slug}.html`), htmlTemplate);
  console.log(`✅ تم إنشاء مقال: ${title}`);
});

// 4. حفظ قاعدة البيانات
newsData.updated = new Date().toISOString();
newsData.count = newsData.articles.length;
fs.writeFileSync('./news-data.json', JSON.stringify(newsData, null, 2));
console.log(`🎉 تم تحديث الموقع بنجاح.`);
