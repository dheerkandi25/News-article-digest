# News Article Digest

Personal RSS news digest: URL deduplication, engagement scoring, tag matching, local semantic filtering, and AI ranking of metadata. Built from [Thomas Bonnet's devto-digest](https://github.com/thomasbnt/your-devto-digest), upstream snapshot `d93eae95933a27b6fe98eb43e09d7ba85d8778bf`. MIT license and original tests preserved. Original dev.to entry point remains `app.js`; new RSS entry point is `news.js`.

## Start

Requires Node 24 and npm. Run `npm ci`, then `npm test`.

- `npm run news:demo`: offline fixture preview, no model/API/email. Its fake vectors only test plumbing.
- `npm run news:preview`: fetch real feeds, run local embeddings when tags are absent, rank metadata, write output; no email.
- `npm run news:send`: same pipeline, then send email and update sent history.

Copy `.env.example` to `.env` and set `LLM_API_KEY` for AI ranking. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM and MAIL_TO for delivery. Never commit credentials. A failed/missing ranking API falls back to deterministic ranking and original descriptions; output/report.json identifies the ranking mode. Embedding failure stops execution rather than silently pretending semantic filtering occurred.

## Configuration

Edit `news.config.json`: interests are natural-language topic descriptions; interestTags are exact normalized tag aliases. Tags present but unmatched are rejected. Only entries without tags use local cosine similarity against each interest embedding. Threshold 0.35 is a starting value, not a calibrated probability. Inspect report.json and tune with relevant and irrelevant examples.

Default engagementMode is `soft`: popularity = (likes + 2*comments) * recency adjustment. Views are retained but excluded from scoring because cross-publisher views are not comparable. Set engagementMode to `strict` to require each known metric to meet views 1000/comments 10/likes 500. Unknown metrics do not fail thresholds. Standard RSS normalization currently supplies no engagement metrics; adding publisher-specific adapters is needed to populate them.

Duplicate identity is a SHA-256 of the normalized URL: tracking parameters and fragments removed, other query parameters retained. Different URLs stay separate. No title deduplication.

Source feeds are examples; validate their availability in your environment. Entries without valid publication dates are rejected. Descriptions are stripped of HTML and capped at 1500 characters. No full article fetching or web search. AI produces metadata previews, not full article summaries. At most 100 candidates reach AI in batches of 20; this bound is configurable. AI scores across batches are approximate, not a globally optimized ranking.

## GitHub Actions

`.github/workflows/news.yml` runs daily at 07:23 UTC. Config chooses daily delivery or weekly delivery (`sendDay`: Sunday=0, Monday=1). It collects and saves a candidate pool even on non-send days. Manual mode defaults to preview; manual send bypasses due-day checks. Add the environment variables above as repository Actions secrets. Inspect preview/report artifacts before sending.

State, sent URL history, and embedding/model caches are restored from Actions cache. Cache can be evicted: sent history is best-effort, not durable. Concurrent runs are serialized. SMTP acceptance followed by a state-save failure can still cause a duplicate email on retry; exactly-once delivery is not guaranteed. A database/object store is the next upgrade if this becomes a reliable service. No email was sent during implementation.

## Files

- src/collect.js: RSS parsing and shared article schema
- src/filter.js: URL identity, age/engagement filters, tag/semantic matching, preliminary scoring
- src/embeddings.js: local quantized embedding model and content-keyed vector cache
- src/rank.js: hosted AI metadata ranking with response validation
- news.js: orchestration, preview, candidate pool, email, sent history
- docs/design-comparison.md: decisions and tradeoffs

Original app.js/config.json scripts still require dev.to credentials and are separate from the RSS commands.
