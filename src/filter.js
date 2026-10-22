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
    if (reason) rejected.push({ id: a.id, title: a.title, reason });
    else { seen.add(a.id); accepted.push(a); }
  }
  return { accepted, rejected };
}
export function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; aa += a[i]*a[i]; bb += b[i]*b[i]; }
  return aa && bb ? dot / Math.sqrt(aa*bb) : 0;
}
// Every article uses the same score, regardless of tags or engagement.
export async function topicFilter(articles, cfg, embed) {
  const accepted = [], rejected = [];
  if (!articles.length) return { accepted, rejected };
  const interests = [];
  for (const interest of cfg.interests) interests.push(await embed(interest));
  for (const article of articles) {
    const text = [article.title, article.description].filter(Boolean).join('\n');
    const vector = await embed(text);
    const similarities = interests.map(interest => cosine(interest, vector));
    const similarity = Math.max(...similarities);
    const matchedInterest = cfg.interests[similarities.indexOf(similarity)];
    if (similarity >= cfg.embedding.threshold) {
      accepted.push({ ...article, matchMethod: 'semantic', similarity, matchedInterest });
    } else {
      rejected.push({ id: article.id, title: article.title, reason: 'semantic-below-threshold', similarity, matchedInterest });
    }
  }
  accepted.sort((a,b) => b.similarity - a.similarity
    || Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
    || a.id.localeCompare(b.id));
  return { accepted, rejected };
}
