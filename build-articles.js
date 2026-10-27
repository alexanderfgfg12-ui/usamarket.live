const fs = require('fs');
const path = require('path');

const articlesDir = './articles';
const newsDir = './news';
if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir);
if (!fs.existsSync(newsDir)) fs.mkdirSync(newsDir);

let newsData = { updated: new Date().toISOString(), count: 0, articles: [] };
if (fs.existsSync('./news-data.json')) {
  try {
    newsData = JSON.parse(fs.readFileSync('./news-data.json', 'utf8'));
  } catch (e) {
    console.log('⚠️ خطأ في قراءة news-data.json');
  }
}

const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(articlesDir, file), 'utf8');
  
  const titleMatch = content.match(/title:\s*"(.*?)"/);
  const categoryMatch = content.match(/category:\s*"(.*?)"/);
  
  const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
  const category = categoryMatch ? categoryMatch[1] : 'markets';
  
  const bodyMatch = content.split('---');
  const body = bodyMatch.length > 2 ? bodyMatch[2].trim() : content;
  
  const htmlContent = body.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

  const slug = file.replace('.md', '');
  const pubDate = new Date().toISOString();

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
    newsData.articles.unshift(articleData);
  }

  const htmlTemplate = `
    <!DOCTYPE html><html><head><title>${title}</title><link rel="stylesheet" href="../style.css"></head>
    <body style="background:#0a0e17; color:#fff;"><div class="container" style="padding:20px; max-width:800px; margin:auto;">
      <h1>${title}</h1>
      <div style="line-height:1.8; font-size:1.1rem;">${htmlContent}</div>
      <br><a href="../index.html" style="color:#e11d48;">← Back to Home</a>
    </div></body></html>
  `;
  fs.writeFileSync(path.join(newsDir, `${slug}.html`), htmlTemplate);
  console.log(`✅ تم نشر: ${title}`);
});

newsData.updated = new Date().toISOString();
newsData.count = newsData.articles.length;
fs.writeFileSync('./news-data.json', JSON.stringify(newsData, null, 2));
console.log(`🎉 تم التحديث بنجاح.`);
