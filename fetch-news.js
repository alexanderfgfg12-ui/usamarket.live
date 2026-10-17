const Parser = require('rss-parser');
const fs = require('fs');
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
const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ===== إعادة الكتابة بالذكاء الاصطناعي مع timeout =====
async function rewriteWithAI(article) {
  if (!GEMINI_API_KEY) {
    console.error('⚠️ GEMINI_API_KEY not set');
    return null;
  }

  const prompt = `You are a financial news editor. Rewrite the following news article in clear, professional English for a US market-focused audience.

Requirements:
1. Write a NEW compelling headline (max 80 characters)
2. Write a 2-3 sentence summary (max 280 characters) explaining the news
3. Add ONE sentence of analysis (max 150 characters) explaining why this matters to investors
4. Keep facts accurate, do not invent data
5. Return ONLY valid JSON in this exact format, nothing else:

{"headline":"...","summary":"...","analysis":"..."}

Original title: ${article.title}
Original description: ${article.description}`;

  try {
    // Timeout 15 ثانية لكل طلب
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
          responseMimeType: 'application/json'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`   ❌ Gemini ${res.status}: ${errText.substring(0, 150)}`);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('   ⚠️ Empty response from Gemini');
      return null;
    }

    // إزالة علامات markdown إن وُجدت
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      headline: parsed.headline || article.title,
      summary: parsed.summary || article.description.substring(0, 250),
      analysis: parsed.analysis || ''
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('   ⏱️ Timeout (15s)');
    } else {
      console.error(`   ❌ ${err.message}`);
    }
    return null;
  }
}

// ===== جلب الأخبار =====
async function fetchAll() {
  console.log('🚀 Starting news fetch...\n');
  const articles = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 6);
      for (const item of items) {
        articles.push({
          originalTitle: item.title,
          link: item.link,
          originalDescription: (item.contentSnippet || item.content || '').substring(0, 400).trim(),
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

  console.log(`\n📊 Total fetched: ${articles.length}`);

  // ترتيب حسب الأحدث
  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // إزالة التكرار
  const seen = new Set();
  const unique = articles.filter(a => {
    const key = a.originalTitle.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`📝 Unique articles: ${unique.length}`);

  // عدد الأخبار التي نعالجها بالذكاء الاصطناعي
  const AI_LIMIT = 20;
  const top = unique.slice(0, AI_LIMIT);

  console.log(`\n🤖 Rewriting ${top.length} articles with Gemini...\n`);

  const rewritten = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < top.length; i++) {
    const a = top[i];
    const ai = await rewriteWithAI({
      title: a.originalTitle,
      description: a.originalDescription
    });

    if (ai) {
      successCount++;
      console.log(`  [${i + 1}/${top.length}] ✅ ${ai.headline.substring(0, 60)}`);
    } else {
      failCount++;
      console.log(`  [${i + 1}/${top.length}] ⚠️  Using original`);
    }

    rewritten.push({
      title: ai?.headline || a.originalTitle,
      description: ai?.summary || a.originalDescription.substring(0, 250),
      analysis: ai?.analysis || '',
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,
      category: a.category
    });

    // تأخير بسيط بين الطلبات لتفادي rate limit
    await new Promise(r => setTimeout(r, 400));
  }

  // إضافة الأخبار المتبقية (بدون AI)
  const remaining = unique.slice(AI_LIMIT, AI_LIMIT + 20);
  for (const a of remaining) {
    rewritten.push({
      title: a.originalTitle,
      description: a.originalDescription.substring(0, 250),
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
    aiProcessed: successCount,
    articles: rewritten
  };

  fs.writeFileSync('news-data.json', JSON.stringify(data, null, 2));

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Saved ${rewritten.length} articles total`);
  console.log(`🤖 AI processed: ${successCount}`);
  console.log(`⚠️  Fallback to original: ${failCount}`);
  console.log(`${'='.repeat(50)}\n`);
}

fetchAll().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
