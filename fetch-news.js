'use strict';

// Publishes short, attributed RSS summaries and links readers to the original publisher.
// It intentionally does NOT republish full articles, AI-rewrite source material, or copy feed images.
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({ timeout: 10000 });
const FEEDS = [
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC', category: 'markets' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch', category: 'markets' },
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance', category: 'stocks' }
];

function plainText(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}
function safePublisherUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch (_) { return null; }
}
function safeDate(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function fetchAll() {
  const collected = [];
  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of (parsed.items || []).slice(0, 10)) {
        const link = safePublisherUrl(item.link);
        const title = plainText(item.title);
        const description = 'Open the original publisher report for the full story and context.';
        if (!link || !title) continue;
        collected.push({
          title: title.slice(0, 180),
          description,
          link,
          pubDate: safeDate(item.isoDate || item.pubDate),
          source: feed.source,
          category: feed.category
        });
      }
    } catch (error) {
      console.error('Feed unavailable:', feed.source, error.message);
    }
  }

  const seen = new Set();
  const articles = collected
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .filter(item => {
      const key = item.link;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const directory = path.join(process.cwd(), 'news');
  fs.mkdirSync(directory, { recursive: true });
  const published = [];

  for (const item of articles) {
    const slugBase = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'market-update';
    const slug = slugBase + '-' + Buffer.from(item.link).toString('hex').slice(0, 10);
    const fileName = path.join(directory, slug + '.html');
    const title = escapeHtml(item.title);
    const summary = escapeHtml(item.description);
    const source = escapeHtml(item.source);
    const date = escapeHtml(item.pubDate);
    const publisherLink = escapeHtml(item.link);

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | US Market Live</title>
<meta name="description" content="${summary}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://usamarket.live/news/${slug}.html">
<link rel="stylesheet" href="../style.css">
</head><body><main class="container" style="max-width:820px;margin:40px auto;padding:20px">
<p><strong>News summary · ${source}</strong></p><h1>${title}</h1><p><time datetime="${date}">${date}</time></p>
<p>${summary}</p>
<p>This page provides a brief attributed summary. The original reporting, full article and any related media remain with the publisher.</p>
<p><a href="${publisherLink}" target="_blank" rel="noopener noreferrer">Read the original report at ${source}</a></p>
<p><a href="/">Return to US Market Live</a></p></main></body></html>`;
    fs.writeFileSync(fileName, html, 'utf8');
    published.push({ id: slug, title: item.title, description: item.description, link: item.link, pubDate: item.pubDate, source: item.source, category: item.category });
  }

  fs.writeFileSync('news-data.json', JSON.stringify({
    updated: new Date().toISOString(),
    count: published.length,
    articles: published
  }, null, 2), 'utf8');
  console.log('Published attributed summaries:', published.length);
}

fetchAll().catch(error => {
  console.error('News publishing failed:', error);
  process.exitCode = 1;
});
