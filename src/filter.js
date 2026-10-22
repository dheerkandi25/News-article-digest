import { createHash } from 'node:crypto';
export function normalizeUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported article URL');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.href;
}
export const articleId = url => createHash('sha256').update(normalizeUrl(url)).digest('hex');
export function basicFilter(articles, cfg, sent = {}, now = Date.now()) {
  const seen = new Set(), accepted = [], rejected = [];
  for (const a of articles) {
    let reason;
    if (seen.has(a.id)) reason = 'duplicate-url';
    else if (sent[a.id]) reason = 'previously-sent';
    else if (!Number.isFinite(Date.parse(a.publishedAt))) reason = 'missing-date';
    else if (Date.parse(a.publishedAt) > now + 300000) reason = 'future-date';
    else if (now - Date.parse(a.publishedAt) > cfg.lookbackDays * 86400000) reason = 'too-old';
    else if (cfg.engagementMode !== 'soft') for (const [metric, minimum] of Object.entries(cfg.engagement)) {
      if (a.engagement[metric] !== null && a.engagement[metric] < minimum) {
        reason = `below-${metric}-threshold`; break;
      }
    }
    if (reason) rejected.push({ id: a.id, title: a.title, reason });
    else { seen.add(a.id); accepted.push(a); }
  }
  return { accepted, rejected };
}
export function tagMatches(tags, interestTags) {
  const normalize = x => x.toLowerCase().replace(/^#/, '').replace(/[^a-z0-9]/g, '');
  const interests = new Set(interestTags.map(normalize));
  return tags.some(tag => interests.has(normalize(tag)));
}
export function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; aa += a[i]*a[i]; bb += b[i]*b[i]; }
  return aa && bb ? dot / Math.sqrt(aa*bb) : 0;
}
export async function topicFilter(articles, cfg, embed) {
  const accepted = [], rejected = [];
  const needsEmbedding = articles.some(a => !a.tags.length);
  const interests = needsEmbedding ? await Promise.all(cfg.interests.map(embed)) : [];
  for (const a of articles) {
    if (a.tags.length) {
      if (tagMatches(a.tags, cfg.interestTags)) accepted.push({ ...a, matchMethod: 'tags' });
      else rejected.push({ id: a.id, title: a.title, reason: 'tags-not-matched' });
    } else {
      const vector = await embed(`${a.title}\n${a.description}`);
      const similarity = Math.max(...interests.map(v => cosine(v, vector)));
      if (similarity >= cfg.embedding.threshold) accepted.push({ ...a, matchMethod: 'semantic', similarity });
      else rejected.push({ id: a.id, title: a.title, reason: 'semantic-below-threshold', similarity });
    }
  }
  return { accepted, rejected };
}

// Adapted from upstream scoreArticle: likes + twice comments, with gentle age decay.
export function popularityScore(article, now = Date.now(), lookbackDays = 7) {
  const base = (article.engagement.likes ?? 0) + 2 * (article.engagement.comments ?? 0);
  const age = Math.max(0, (now - Date.parse(article.publishedAt)) / 86400000);
  return base * Math.max(0.5, 1 - 0.5 * age / lookbackDays);
}
export function preliminaryRank(articles, cfg) {
  const counts = new Map();
  for (const a of articles) for (const t of new Set(a.tags)) counts.set(t, (counts.get(t) || 0) + 1);
  return articles.map(a => ({ ...a, preliminaryScore: popularityScore(a, Date.now(), cfg.lookbackDays)
    + 2 * a.tags.filter(t => tagMatches([t], cfg.interestTags)).reduce((sum,t) => sum + Math.log(1 + articles.length / counts.get(t)), 0)
    + (a.similarity || 0) })).sort((a,b) => b.preliminaryScore-a.preliminaryScore || Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
