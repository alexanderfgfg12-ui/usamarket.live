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

// ===== Gemini API =====
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function rewriteWithAI(article) {
  if (!GEMINI_API_KEY) return null;

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
      })
    });

    if (!res.ok) {
      console.error(`Gemini error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    return {
      headline: parsed.headline,
      summary: parsed.summary,
      analysis: parsed.analysis
    };
  } catch (err) {
    console.error(`AI rewrite failed: ${err.message}`);
    return null;
  }
}

// ===== جلب الأخبار =====
async function fetchAll() {
  const articles = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 5); // 5 لكل مصدر لتوفير API calls
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
      console.log(`✅ ${feed.source}: ${items.length}`);
    } catch (err) {
      console.error(`❌ ${feed.source}: ${err.message}`);
    }
  }

  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // إزالة التكرار
  const seen = new Set();
  const unique = articles.filter(a => {
    const key = a.originalTitle.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // إعادة الكتابة بالذكاء الاصطناعي (أول 25 خبر فقط)
  const top = unique.slice(0, 25);
  console.log(`\n🤖 Rewriting ${top.length} articles with AI...`);

  const rewritten = [];
  for (let i = 0; i < top.length; i++) {
    const a = top[i];
    const ai = await rewriteWithAI({
      title: a.originalTitle,
      description: a.originalDescription
    });

    rewritten.push({
      title: ai?.headline || a.originalTitle,
      description: ai?.summary || a.originalDescription.substring(0, 250),
      analysis: ai?.analysis || '',
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,
      category: a.category,
      slug: slugify(ai?.headline || a.originalTitle)
    });

    console.log(`  [${i + 1}/${top.length}] ${ai ? '✅' : '⚠️ '} ${(ai?.headline || a.originalTitle).substring(0, 60)}`);

    // تأخير بسيط لتفادي rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  const data = {
    updated: new Date().toISOString(),
    count: rewritten.length,
    articles: rewritten
  };

  fs.writeFileSync('news-data.json', JSON.stringify(data, null, 2));
  console.log(`\n✅ Saved ${rewritten.length} articles`);
}

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

fetchAll().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
