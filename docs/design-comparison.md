# Original rules versus this project

| Decision | Original devto-digest | Initially proposed | Implemented choice |
|---|---|---|---|
| Collection | dev.to API | Multiple RSS feeds | RSS with common metadata schema; original app retained |
| Popularity | Likes + twice comments, gently reduced with age | Hard floors for views, comments, likes | Original soft score by default; strict floors configurable |
| Tags | Followed tags weighted by rarity | Match interest tags | Exact normalized matching, rarity bonus for preliminary ordering |
| Missing tags | No semantic fallback | Semantic relevance | Local embeddings on title + RSS description |
| AI role | Summarize selected articles using excerpts | Rank metadata | Rank filtered metadata and produce previews |
| AI outage | Use dev.to descriptions | Initially stop | Preserve original fallback behavior, visibly report fallback mode |
| Duplicate identity | dev.to article ID | Title similarity, later URL | Normalized URL hash as finally requested |
| Weekly memory | Daily saved candidate pool | Need multi-source memory | Daily pool plus sent URL history |
| Availability check | Recheck selected posts through dev.to API | Not decided | RSS presence only; no generic live-page check yet |
| Layout | Even card count, can drop odd last card | Not specified | Reuse safe email renderer; keep odd article counts |
| State storage | Actions cache | Not decided | Same for prototype; eviction and delivery retry risks documented |

Soft scoring avoids discarding fresh articles and avoids penalizing publishers that expose metrics compared with those that do not. Unknown metrics are not fabricated. Popularity is only a preliminary signal; final AI scores judge relevance. Broad tags can still cause false positives, and missing/misleading descriptions limit semantic accuracy.

## Questions to review with the owner

1. If all feeds use the tag “technology”, does exact tag matching help? We should inspect false negatives before broadening aliases.
2. A cosine threshold is not a confidence probability. Which 20 positive and negative examples should calibrate it?
3. Can cache eviction causing an occasional repeated digest be tolerated, or is durable state worth a storage dependency?
4. What should happen when a feed fails? Current behavior continues with other feeds and reports failures; a total failure stops the run.

## Validation boundaries

Unit tests use injected vectors to validate semantic routing. The offline fixture does not validate model quality, external feed access, hosted AI, SMTP, or GitHub scheduling. Those require separate integration checks and configured secrets.
