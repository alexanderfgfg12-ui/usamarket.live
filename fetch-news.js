const Parser = require('rss-parser');
const fs = require('fs');
const parser = new Parser({ timeout: 15000 });

const FEEDS = [
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC', category: 'economy' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch', category: 'stocks' },
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance', category: 'stocks' },
  { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', source: 'CNBC Markets', category: 'stocks' },
  { url: 'https://www.investing.com/rss/news_25.rss', source: 'Investing.com', category: 'economy' },
  { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph', category: 'crypto' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk', category: 'crypto' },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', source: 'WSJ Markets', category: 'stocks' }
];

async function fetchAll() {
  const articles = [];
  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 8);
      for (const item of items) {
        articles.push({
          title: item.title,
          link: item.link,
          description: (item.contentSnippet || item.content || '').substring(0, 250).trim(),
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

  const seen = new Set();
  const unique = articles.filter(a => {
    const key = a.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const data = {
    updated: new Date().toISOString(),
    count: unique.length,
    articles: unique.slice(0, 60)
  };

  fs.writeFileSync('news-data.json', JSON.stringify(data, null, 2));
  console.log(`✅ Saved ${unique.length} articles`);
}

fetchAll().catch(err => {
  console.error('❌', err);
  process.exit(1);
});
