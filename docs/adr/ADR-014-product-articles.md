# ADR-014 — Per-product articles for SEO and GEO

**Status:** accepted
**Builds on:** ADR-008 (routing), ADR-011 (ingest API), ADR-013 (database-backed public content)

## Context

Every shipped app has a product page and a set of legal documents on this site,
and nothing else. A product page ranks for the product's own name and little more;
people do not search for "Pupdojo", they search for "how to stop a puppy biting".
The same holds for answer engines (ChatGPT, Perplexity, Claude, Google's AI
Overviews): they cite pages that answer a question directly, and we have none.

We want a small number of genuinely useful articles per app — five to ten, not
hundreds — in each language we serve, written from the app's real content and its
ASO keyword research, reviewed by a person, and published the same way legal
documents are: through one audited write route into Postgres, read by the public
site through one query module.

## Decision

### 1. Articles live under their product

`/{locale}/{product}/guides/{articleSlug}`, with an index at
`/{locale}/{product}/guides`. Nested inside the existing `[slug]` folder for the
same reason ADR-009's legal routes are: Next.js allows one dynamic folder per
directory level. Being under the product also means every article accrues to the
product's URL and links back to it, and no article slug can collide with the flat
top-level namespace ADR-008 protects.

A studio-wide `/blog` is deliberately out of scope; `canonicalRoutes.blog` stays
unbuilt and out of the sitemap until it exists.

### 2. One row per article per locale — not a LocalizedText row

Legal documents are translations: one fact, three languages, one row with
`{ en, es, ca }` columns. Articles are not. What a Spanish dog owner searches for
is not the translation of what an American one does, so each locale's article is
written for its own query, may have a different slug, may not exist at all in
another locale, and is published independently.

`product_articles` therefore holds one row per `(product, locale, slug)`. A
`translation_key` groups the rows that are the same article in different
languages; `hreflang` alternates are emitted only for translations that actually
exist, never for the full locale matrix the rest of the site uses.

The body is Markdown, stored as text and rendered server-side by a deliberately
small renderer (`src/lib/markdown`): headings, paragraphs, lists, quotes, bold,
italics and links. No raw HTML passes through, so an article cannot inject markup
or scripts; anything the renderer does not understand is rendered as text. FAQ
pairs are a separate structured column because they feed `FAQPage` JSON-LD.

### 3. One write route: `POST /api/ingest/articles`

Same shape as ADR-011/013: bearer token, zod validation, upsert, audit row, tag
revalidation. It takes every article for one product in one call and is
idempotent: an article whose content checksum is unchanged keeps its
`updatedAt`, so `dateModified` and the sitemap's `lastmod` only move when the
words do. An article absent from the payload is **not** deleted — unpublishing is
explicit (`status: "draft"`), because a partial payload from an older checkout
must never take pages down.

It authenticates with its own token, `ARTICLE_INGEST_TOKEN`, not
`PRODUCT_INGEST_TOKEN`: writing an article cannot change a product page, and the
two should rotate independently — the reasoning `.env.example` already applies to
every other token. It does not need a `pipeline_runs` row: articles are written
by a person (or a Skill a person drives), not by a product-agent run.

The client is `scripts/publish-articles.ts`, which reads
`content/articles/{product}/{locale}/*.md` (front matter + body) from this repo,
so every published word is also in git history.

### 4. Indexing follows the product

An article page is `noindex` and absent from the sitemap whenever its product is
not `indexable` — the same single column that already gates the product page
(ADR-013). Publishing articles for an app that has not launched is fine; they go
live to search when the app does, with no second switch to forget.

### 5. GEO: being quotable by answer engines

- **Structured data** on every article: `Article` (with `about` pointing at the
  app's `SoftwareApplication`), `BreadcrumbList`, and `FAQPage` when it has FAQs.
  The product page also emits `FAQPage` for its own FAQ.
- **`/llms.txt`**: a plain-text map of the studio, each indexable app and its
  articles, with one-line descriptions — the emerging convention for pointing
  language models at the pages worth reading.
- **`robots.txt`** names the AI crawlers explicitly (OpenAI, Anthropic,
  Perplexity, Google-Extended, Applebot-Extended) and allows them. `*` already
  allowed them; naming them makes the decision visible and reviewable.
- **Writing rules**, enforced by review and by the `seo-article` Skill, not by
  code: answer first, question-shaped headings, concrete numbered steps, real
  facts from the app's own content, a dated byline, and one natural link to the
  app. These are what answer engines quote.
- The Smart App Banner and `SoftwareApplication` schema on product pages already
  exist and are reused on article pages.

## Alternatives considered

- **Reuse the legal tables.** Rejected: legal rows are one-document-three-
  languages with sections as rows; forcing per-locale articles into that shape
  either duplicates rows or fakes translations.
- **A headless CMS.** Rejected for now: another system with its own auth and
  cache, for 5–10 articles per app. The ingest route keeps one publication path.
- **MDX compiled at build time.** Rejected: it brings back the
  commit-and-rebuild publishing ADR-013 removed, and arbitrary components in
  content are exactly what the small renderer is meant to rule out.
- **Generating hundreds of pages per app.** Rejected on purpose. Google's
  scaled-content-abuse policy penalises the whole domain, and the domain carries
  every app's legal pages, which App Review fetches.

## Consequences

- New table `product_articles`; applied with `npm run db:push`.
- New env var `ARTICLE_INGEST_TOKEN` on Vercel and wherever the publish script
  runs. Unset → the route answers 503, like every other token here.
- Article pages are ISR like legal pages (`dynamicParams`, one-hour backstop,
  tag purge on publish), so a published article is live in seconds.
- `docs/content-articles.md` documents the authoring workflow; the
  `skills/seo-article` Skill drafts articles for review.
