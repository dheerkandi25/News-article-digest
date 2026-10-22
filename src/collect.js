import Parser from 'rss-parser';
import { articleId, normalizeUrl } from './filter.js';
const text = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export function normalizeEntry(item, source) {
  const url = normalizeUrl(item.link);
  return {
    id: articleId(url), url, title: text(item.title).slice(0, 400), source: source.name,
    publishedAt: item.isoDate || item.pubDate || null,
    description: text(item.contentSnippet || item.summary || item.content).slice(0, 1500),
    tags: (item.categories || []).map(t => text(typeof t === 'string' ? t : t._)).filter(Boolean),
    author: text(item.creator || item.author || source.name),
    // Standard RSS has no comparable engagement fields. Never invent zeros.
    engagement: { views: null, comments: null, likes: null },
  };
}
export async function collectFeeds(sources) {
  const parser = new Parser();
  const articles = [], failures = [];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const xml = await response.text();
      if (xml.length > 5000000) throw Error('Feed exceeds 5 MB limit');
      const feed = await parser.parseString(xml);
      for (const item of feed.items) {
        try { articles.push(normalizeEntry(item, source)); }
        catch { failures.push({ source: source.name, reason: 'invalid-entry-url' }); }
      }
    } catch (error) { failures.push({ source: source.name, reason: error.message }); }
  }
  if (!articles.length) throw Error('No articles collected; inspect feed configuration and connectivity');
  return { articles, failures };
}
