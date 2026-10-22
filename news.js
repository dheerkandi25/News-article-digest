import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { collectFeeds } from './src/collect.js';
import { basicFilter, topicFilter, preliminaryRank } from './src/filter.js';
import { createEmbedder } from './src/embeddings.js';
import { rankArticles } from './src/rank.js';
import { renderDigest } from './render.js';
async function load(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
async function save(path, value) {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2)); await rename(`${path}.tmp`, path);
}
const fixture = process.argv.includes('--fixture');
const send = process.argv.includes('--send');
if (fixture && send) throw Error('Fixture mode cannot send email');
const cfg = await load('news.config.json');
if (!cfg || !cfg.interests?.length || !cfg.interestTags?.length || !['daily','weekly'].includes(cfg.frequency) || !(cfg.embedding.threshold >= 0 && cfg.embedding.threshold <= 1) || !(cfg.maxArticles > 0) || !(cfg.lookbackDays > 0) || !Number.isInteger(cfg.sendDay) || cfg.sendDay < 0 || cfg.sendDay > 6) throw Error('Invalid news configuration');
await mkdir('data', { recursive: true }); await mkdir('output', { recursive: true });
const state = await load('data/state.json', { sent: {}, candidates: {}, lastSentDay: null });
const today = new Date().toISOString().slice(0,10);
if (send && process.argv.includes('--if-due') && (state.lastSentDay === today || (cfg.frequency === 'weekly' && new Date().getUTCDay() !== cfg.sendDay))) {
  console.log('Digest not due; collecting candidates only.');
}
const collected = fixture ? { articles: await load('fixtures/articles.json'), failures: [] } : await collectFeeds(cfg.sources);
const pool = new Map(Object.values(state.candidates || {}).map(a => [a.id, a]));
for (const a of collected.articles) pool.set(a.id, a);
const basic = basicFilter([...pool.values()], cfg, state.sent);
if (!fixture) {
  state.candidates = Object.fromEntries(basic.accepted.map(a => [a.id,a]));
  await save('data/state.json', state);
}
const due = !(send && process.argv.includes('--if-due') && (state.lastSentDay === today || (cfg.frequency === 'weekly' && new Date().getUTCDay() !== cfg.sendDay)));
if (!due) process.exit(0);
const cache = await load('data/embeddings.json', {});
// Fixtures inject deterministic vectors to test plumbing, not semantic model quality.
const embed = fixture ? async () => [1, 0] : createEmbedder(cfg.embedding, cache);
const topic = await topicFilter(basic.accepted, cfg, embed);
await save('data/embeddings.json', cache);
const candidates = preliminaryRank(topic.accepted, cfg).slice(0, cfg.maxAICandidates);
let rankingMode = fixture ? 'fixture' : 'ai';
async function rankWithFallback() {
  try { return await rankArticles(candidates, cfg); }
  catch { rankingMode = 'deterministic-fallback'; console.warn('AI unavailable or invalid response; using preliminary ranking and RSS descriptions.'); return candidates.slice(0,cfg.maxArticles).map(a => ({ ...a, relevance: null, preview: a.description })); }
}
const ranked = fixture ? topic.accepted.slice(0,cfg.maxArticles).map(a => ({ ...a, preview: a.description, relevance: null })) : await rankWithFallback();
const rendered = renderDigest({
  title: fixture ? 'News digest — OFFLINE DEMO' : 'Your news digest — metadata previews', date: new Date(),
  forYou: ranked.map(a => ({ article: { id: a.id, title: a.title, url: a.url, description: a.description, tag_list: a.tags, user: { name: a.author || a.source } }, summary: a.preview })), discover: [],
});
await writeFile('output/preview.html', rendered.html);
await writeFile('output/preview.txt', rendered.text);
await save('output/report.json', { fixture, rankingMode, collected: collected.articles.length, failures: collected.failures, selected: ranked, rejected: [...basic.rejected, ...topic.rejected] });
if (send && ranked.length) {
  for (const key of ['SMTP_HOST','MAIL_FROM','MAIL_TO']) if (!process.env[key]) throw Error(`Missing ${key}`);
  const { default: nodemailer } = await import('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, connectionTimeout: 20000, socketTimeout: 30000,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
  try { await transport.sendMail({ from: process.env.MAIL_FROM, to: process.env.MAIL_TO, ...rendered }); }
  catch { throw Error('SMTP delivery failed; sent history unchanged'); }
  finally { transport.close(); }
  for (const a of ranked) { state.sent[a.id] = today; delete state.candidates[a.id]; }
  state.lastSentDay = today; await save('data/state.json', state);
}
console.log(`${fixture ? 'Offline fixture' : 'RSS'}: ${collected.articles.length} collected; ${basic.accepted.length} passed basic filters; ${topic.accepted.length} matched interests; ${ranked.length} selected. See output/report.json and output/preview.html.`);
