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
  
  // تحويل النص إلى فقرات HTML
  const htmlContent = body.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

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

  // إنشاء صفحة HTML مستقلة للمقال (مع الإعلانات والتصميم)
  const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en" dir="ltr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - US Market Live</title>
      <link rel="stylesheet" href="../style.css">
      
      <!-- Google AdSense -->
      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3583305975597231" crossorigin="anonymous"></script>
    </head>
    <body style="background:#0a0e17; color:#fff;">
      
      <!-- شريط علوي للعودة -->
      <div style="padding: 15px; border-bottom: 1px solid #333; background: #111;">
        <a href="../index.html" style="color: #00e5ff; text-decoration: none; font-weight: bold;">← Back to US Market Live</a>
      </div>

      <div class="container" style="padding:20px; max-width:800px; margin:auto;">
        <h1 style="color: #fff;">${title}</h1>
        
        <!-- إعلان أعلى المقال (Adsterra Banner) -->
        <div style="margin: 20px 0; text-align: center; overflow-x: auto;">
          <script>
            atOptions = { 'key' : '1dfb3499e1ac651f7c3142c05db57d13', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };
          </script>
          <script src="https://bauval.org/22/1dfb3499e1ac651f7c3142c05db57d13"></script>
        </div>

        <!-- محتوى المقال -->
        <div style="line-height:1.8; font-size:1.1rem; color: #ddd;">${htmlContent}</div>
        
        <!-- إعلان أسفل المقال (Adsterra Native) -->
        <div style="margin: 30px 0; text-align: center; overflow-x: auto;">
          <script async="async" data-cfasync="false" src="https://bauval.org/21/7a6e0822ff17ba0f0acc412a0233ab9a"></script>
          <div id="container-7a6e0822ff17ba0f0acc412a0233ab9a"></div>
        </div>

        <br><a href="../index.html" style="color:#e11d48; font-weight: bold;">← Back to Home</a>
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
