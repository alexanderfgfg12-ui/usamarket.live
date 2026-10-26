const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const parser = new Parser({ timeout: 15000 });

// ===== مصادر الأخبار =====
const FEEDS = [
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC', category: 'markets' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch', category: 'markets' },
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance', category: 'stocks' },
  { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph', category: 'crypto' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk', category: 'crypto' }
];

// ===== إعدادات Gemini API =====
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash'; // تم التعديل لنموذج مستقر
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ===== إعادة الكتابة بالذكاء الاصطناعي (مقال كامل) =====
async function rewriteWithAI(article) {
  if (!GEMINI_API_KEY) {
    console.error('⚠️ GEMINI_API_KEY not set');
    return null;
  }

  const prompt = `You are a professional financial news editor. Write a detailed, original news article in English based on the following source text.

Requirements:
1. Write a compelling headline (max 80 characters).
2. Write a 2-3 sentence summary (max 280 characters).
3. Write a full article body (300-500 words) with 2-3 paragraphs. Do NOT copy the original text; rewrite and expand it in a professional journalistic tone.
4. Add a short "Market Analysis" paragraph (max 150 characters) explaining why this matters to investors.
5. Keep facts accurate. Return ONLY valid JSON in this exact format:

{"headline":"...","summary":"...","content":"<p>Paragraph 1...</p><p>Paragraph 2...</p>","analysis":"..."}

Original title: ${article.title}
Original text: ${article.description}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // زيادة الوقت للمقالات الطويلة

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500, // زيادة عدد الكلمات المسموح بها
          responseMimeType: 'application/json'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`   ❌ Gemini ${res.status}`);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`   ❌ ${err.message}`);
    return null;
  }
}

// ===== دالة إنشاء صفحة HTML للمقال =====
function generateArticleHTML(article) {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${article.title} - US Market Live</title>
<meta name="description" content="${article.description}">
<link rel="stylesheet" href="../style.css">
<!-- Google AdSense -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3583305975597231" crossorigin="anonymous"></script>
</head>
<body>
<header class="header">
  <div class="container header-inner">
    <a href="../index.html" class="logo">📈 US Market Live</a>
    <nav class="nav"><a href="../index.html" class="nav-link">← Back to Home</a></nav>
  </div>
</header>
<main class="container" style="padding: 40px 20px; max-width: 800px; margin: auto;">
  <h1>${article.title}</h1>
  <p style="color: #888; margin-bottom: 20px;">${article.pubDate} | Source: ${article.source}</p>
  
  <!-- إعلان أعلى المقال -->
  <div style="margin: 20px 0; text-align: center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-3583305975597231" data-ad-slot="ضع_رقم_الوحدة_هنا" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});<\/script>
  </div>

  <div class="article-content" style="line-height: 1.8; font-size: 1.1rem;">
    ${article.content || `<p>${article.description}</p>`}
  </div>

  ${article.analysis ? `<div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-top: 20px;"><strong>💡 Market Analysis:</strong> ${article.analysis}</div>` : ''}

  <!-- إعلان أسفل المقال -->
  <div style="margin: 30px 0; text-align: center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-3583305975597231" data-ad-slot="ضع_رقم_الوحدة_هنا" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});<\/script>
  </div>

  <p style="margin-top: 30px;"><a href="${article.link}" target="_blank" style="color: #e11d48; font-weight: bold;">Read Original Story at ${article.source} →</a></p>
</main>
<footer class="footer">
  <div class="container footer-bottom">
    <p>© ${new Date().getFullYear()} US Market Live — <a href="../privacy.html" style="color:#888">Privacy</a> | <a href="../about.html" style="color:#888">About</a> | <a href="../contact.html" style="color:#888">Contact</a></p>
  </div>
</footer>
</body>
</html>`;
}

// ===== جلب الأخبار =====
async function fetchAll() {
  console.log('🚀 Starting news fetch...\n');
  const articles = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 4); // تقليل العدد لتجنب تجاوز حدود API
      for (const item of items) {
        articles.push({
          originalTitle: item.title,
          link: item.link,
          originalDescription: (item.contentSnippet || item.content || '').substring(0, 800).trim(),
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

  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  const seen = new Set();
  const unique = articles.filter(a => {
    const key = a.originalTitle.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // معالجة 10 أخبار فقط بالذكاء الاصطناعي لتجنب الحظر وتجاوز الوقت
  const AI_LIMIT = 10;
  const top = unique.slice(0, AI_LIMIT);

  console.log(`\n🤖 Generating full articles for ${top.length} news...\n`);

  const rewritten = [];
  
  // إنشاء مجلد الأخبار إذا لم يكن موجوداً
  if (!fs.existsSync('news')) fs.mkdirSync('news');

  for (let i = 0; i < top.length; i++) {
    const a = top[i];
    const ai = await rewriteWithAI({
      title: a.originalTitle,
      description: a.originalDescription
    });

    // إنشاء رابط (Slug) من العنوان
    const rawTitle = ai?.headline || a.originalTitle;
    const slug = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const fileName = `news/${slug}.html`;

    const articleData = {
      id: slug,
      title: rawTitle,
      description: ai?.summary || a.originalDescription.substring(0, 250),
      content: ai?.content || `<p>${a.originalDescription}</p>`,
      analysis: ai?.analysis || '',
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,
      category: a.category
    };

    // 1. حفظ صفحة HTML للمقال
    fs.writeFileSync(fileName, generateArticleHTML(articleData));
    console.log(`  [${i + 1}/${top.length}] ✅ ${rawTitle.substring(0, 50)} -> ${fileName}`);

    // 2. إضافة الخبر للبيانات
    rewritten.push(articleData);

    await new Promise(r => setTimeout(r, 2000)); // تأخير ثانيتين بين كل طلب
  }

  // إضافة الأخبار المتبقية (بدون AI)
  const remaining = unique.slice(AI_LIMIT, AI_LIMIT + 20);
  for (const a of remaining) {
    rewritten.push({
      id: a.originalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
      title: a.originalTitle,
      description: a.originalDescription.substring(0, 250),
      content: `<p>${a.originalDescription}</p>`,
      analysis: '',
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,
      category: a.category
    });
  }

  const data = {
    updated: new Date().toISOString(),
    count: rewritten.length,
    articles: rewritten
  };

  fs.writeFileSync('news-data.json', JSON.stringify(data, null, 2));
  console.log(`\n✅ Saved ${rewritten.length} articles. Generated ${top.length} HTML pages.`);
}

fetchAll().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
