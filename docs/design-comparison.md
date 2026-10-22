# Current design: one relevance score

| Decision | Original devto-digest | Earlier prototype | Current implementation |
|---|---|---|---|
| Selection score | Engagement, age, rare matching tags | Mixed engagement, tags, semantic fallback, hosted AI ranking | Maximum local cosine similarity to any interest |
| Input text | Tags and article excerpts | Tags first; embeddings only without tags | Title plus RSS description for every article |
| Tags | Affect ranking | Affect eligibility and ranking | Display metadata only |
| Engagement | Likes + twice comments | Soft scoring or strict thresholds | No effect |
| Hosted AI | Summaries | Relevance ranking plus previews | Optional previews after selection; disabled by default |
| Duplicate identity | dev.to ID | Normalized URL | Normalized URL |
| Age | Window and score decay | Window and score decay | Eligibility window; newest breaks exact score ties |

RSS pipeline: collect → merge pool → URL/sent/date filters → embed every candidate → max similarity to interests → threshold → sort → select top N → optional previews → render/email.

AI preview failure falls back to RSS descriptions without changing selection or order. Preview text is based on metadata, not the full article. Local semantic filtering still requires the model, even when hosted AI is disabled.

A threshold of 0.35 needs calibration on human-labeled examples. Semantic relevance does not establish accuracy, writing quality, novelty, or importance. Broad interests can admit shallow articles. No fallback bypasses a failed embedding computation.

Original app.js retains its original behavior for comparison. Only news.js uses this simplified policy. Actions cache remains best-effort state; eviction can cause repeat emails. SMTP delivery followed by a failed state save can also cause a repeat.

Tests inject vectors for exact score/order checks and mock preview APIs to verify optional behavior. Live runs validate the model/feed integration, not semantic quality.
