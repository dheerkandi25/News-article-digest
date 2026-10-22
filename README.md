# News Article Digest

Personal RSS news digest: URL deduplication and a single local semantic relevance score, with optional AI-written previews. Built from [Thomas Bonnet's devto-digest](https://github.com/thomasbnt/your-devto-digest), upstream snapshot `d93eae95933a27b6fe98eb43e09d7ba85d8778bf`. MIT license and original tests preserved. Original dev.to entry point remains `app.js`; new RSS entry point is `news.js`.

## Start

Requires Node 24 and npm. Run `npm ci`, then `npm test`.

- `npm run news:demo`: offline fixture preview, no model/API/email. Its fake vectors only test plumbing.
- `npm run news:preview`: fetch real feeds, run local embeddings for every eligible article, rank by similarity, write output; no email.
- `npm run news:send`: same pipeline, then send email and update sent history.

Copy `.env.example` to `.env` and set `LLM_API_KEY` only if you enable optional AI previews with `llm.enabled: true`. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM and MAIL_TO for delivery. Never commit credentials. AI previews are disabled by default. A missing key or failed preview API uses RSS descriptions; output/report.json identifies preview mode. AI never changes selection, scores, or order. Embedding failure stops execution rather than silently pretending semantic filtering occurred.

## Configuration

Edit `news.config.json`: interests are natural-language topic descriptions. Every eligible article gets a local embedding of its title plus RSS description (title alone if no description). Its one relevance score is the maximum cosine similarity to any interest. Scores below embedding.threshold are rejected; survivors are sorted by similarity. Publication date breaks exact ties. Threshold 0.35 is an uncalibrated starting value, not a probability. Review examples before tuning it. Tags and engagement do not affect selection.

Optional AI previews: set llm.enabled to true and provide LLM_API_KEY. Only the already selected articles' IDs, titles, and descriptions are sent, in batches of 20. The model writes one-sentence metadata previews. Its output cannot change order or scores. Without AI, original RSS descriptions appear instead. OpenRouter can be configured through llm.baseUrl and llm.model. Defaults still point to Mistral.

Duplicate identity is a SHA-256 of the normalized URL: tracking parameters and fragments removed, other query parameters retained. Different URLs stay separate. No title deduplication.

Source feeds are examples; validate their availability in your environment. Entries without valid publication dates are rejected. Descriptions are stripped of HTML and capped at 1500 characters. No full article fetching or web search. AI produces metadata previews, not full article summaries. Only the top maxArticles entries reach the optional preview API.

## GitHub Actions

`.github/workflows/news.yml` runs daily at 07:23 UTC. Config chooses daily delivery or weekly delivery (`sendDay`: Sunday=0, Monday=1). It collects and saves a candidate pool even on non-send days. Manual mode defaults to preview; manual send bypasses due-day checks. Add the environment variables above as repository Actions secrets. Inspect preview/report artifacts before sending.

State, sent URL history, and embedding/model caches are restored from Actions cache. Cache can be evicted: sent history is best-effort, not durable. Concurrent runs are serialized. SMTP acceptance followed by a state-save failure can still cause a duplicate email on retry; exactly-once delivery is not guaranteed. A database/object store is the next upgrade if this becomes a reliable service. No email was sent during implementation.

## Files

- src/collect.js: RSS parsing and shared article schema
- src/filter.js: URL identity, age filters and unified semantic scoring
- src/embeddings.js: local quantized embedding model and content-keyed vector cache
- src/previews.js: optional AI previews with response validation; never ranks
- news.js: orchestration, preview, candidate pool, email, sent history
- docs/design-comparison.md: decisions and tradeoffs

Original app.js/config.json scripts still require dev.to credentials and are separate from the RSS commands.
