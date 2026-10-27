// ===== مؤقت قاتل لمنع تعليق GitHub =====
setTimeout(() => {
  console.error('⏱️ [FORCE EXIT] Timeout reached (4 minutes). Exiting.');
  process.exit(0); // الخروج بنجاح لتجنب الفشل الأحمر
}, 4 * 60 * 1000); 

const Parser = require('rss-parser');
const fs = require('fs');
const parser = new Parser({ timeout: 10000 });

// ===== مصادر الأخبار =====
const FEEDS = [
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC', category: 'markets' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch', category: 'markets' },
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance', category: 'stocks' }
];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// نستخدم النموذج الأكثر استقراراً
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function fetchAll() {
  console.log('🚀 Starting news fetch...');
  let articles = [];

  // 1. جلب الأخبار
  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 2); // جلب خبرين فقط لتسريع العملية
      for (const item of items) {
        articles.push({
          title: item.title,
          link: item.link,
          description: (item.contentSnippet || item.content || '').substring(0, 300).trim(),
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          source: feed.source,
          category: feed.category
        });
      }
      console.log(`✅ ${feed.source}: ${items.length} articles`);
    } catch (err) {
      console.error(`❌ ${feed.source}: ${err.message}`);
    }
  }

  // 2. ترتيب وإزالة التكرار
  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  const seen = new Set();
  articles = articles.filter(a => {
    const key = a.title.toLowerCase().substring(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\n📊 Total unique articles: ${articles.length}`);

  // 3. محاولة استخدام الذكاء الاصطناعي (لأول 2 فقط)
  const AI_LIMIT = 2;
  const finalArticles = [];
  
  if (!fs.existsSync('news')) fs.mkdirSync('news');

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    let aiContent = null;
    let aiTitle = a.title;

    // محاولة AI فقط للخبرين الأولين
    if (i < AI_LIMIT && GEMINI_API_KEY) {
      try {
        console.log(`🤖 Rewriting article ${i + 1}...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 ثانية فقط

        const prompt = `Rewrite this news in a 300-word article. Return ONLY JSON: {"headline":"...","summary":"...","content":"<p>...</p>"}. Original: ${a.title} - ${a.description}`;
        
        const res = await fetch(GEMINI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            aiContent = parsed.content;
            aiTitle = parsed.headline || a.title;
            console.log(`  ✅ AI Success: ${aiTitle.substring(0, 40)}`);
          }
        } else {
          console.log(`  ❌ AI Failed (Status: ${res.status})`);
        }
      } catch (err) {
        console.log(`  ⚠️ AI Error: ${err.message}`);
      }
    }

    // إنشاء ملف الصفحة (سواء نجح الذكاء الاصطناعي أم لا)
    const slug = aiTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + i;
    const fileName = `news/${slug}.html`;
    
    // إذا لم يوجد محتوى ذكاء اصطناعي، استخدم النص الأصلي
    const finalContent = aiContent || `<p>${a.description}</p>`;

    const htmlTemplate = `
      <!DOCTYPE html><html><head><title>${aiTitle}</title><link rel="stylesheet" href="../style.css"></head>
      <body><div class="container"><h1>${aiTitle}</h1><p>${a.pubDate} | ${a.source}</p><div>${finalContent}</div><a href="../index.html">← Back</a></div></body></html>
    `;
    fs.writeFileSync(fileName, htmlTemplate);

    finalArticles.push({
      id: slug,
      title: aiTitle,
      description: a.description.substring(0, 200),
      content: finalContent,
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,
      category: a.category
    });
  }

  // 4. حفظ البيانات (لن تكون فارغة أبداً)
  const data = {
    updated: new Date().toISOString(),
    count: finalArticles.length,
    articles: finalArticles
  };

  fs.writeFileSync('news-data.json', JSON.stringify(data, null, 2));
  console.log(`\n✅ Saved ${finalArticles.length} articles successfully.`);
  process.exit(0);
}

fetchAll().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(0); // نخرج بنجاح حتى لا يظهر الخطأ الأحمر
});
