# Product articles (SEO / GEO)

How to write and publish the guides that live under each app, e.g.
`https://www.idionlabs.com/es/pupdojo/guides/como-evitar-que-tu-cachorro-muerda`.
The architecture and the reasons behind it are in
[ADR-014](adr/ADR-014-product-articles.md). For the step-by-step runbook (first-time
setup, publishing, troubleshooting) see
[articulos-paso-a-paso.md](articulos-paso-a-paso.md).

## The rules

- **5–10 articles per app, not hundreds.** Each one answers one real question
  people search for. Mass-produced pages put the whole domain — including every
  app's legal pages, which App Review fetches — at risk.
- **Write per market, not per translation.** The Spanish article targets what
  Spanish speakers search; it can have a different slug and angle. Use the same
  `translationKey` only when it really is the same article.
- **Answer first.** The opening paragraph gives the answer in 2–3 sentences.
  Headings are questions. Steps are numbered. Use real numbers (ages, minutes,
  days) — that is what answer engines quote.
- **Ground it in the app.** Use the app's real content (its programs, lessons,
  features) and its ASO keywords. Never invent statistics, studies or quotes.
- **One natural link to the app** (`[Pupdojo](/pupdojo)`), not a sales page.
  The page already adds the store badge and a call to action.
- **A person reviews every article** before `status: published`.

## Where files go

```
content/articles/<product>/<locale>/<slug>.md
```

The file name is the URL slug (lowercase kebab-case). Start from
[`content/articles/_TEMPLATE.md`](../content/articles/_TEMPLATE.md). Files starting
with `_` are skipped.

Front matter: `title`, `description` (120–160 characters), `translationKey`,
`status` (`draft` | `published`), optional `targetQuery` and `keywords`. The body
is Markdown: `##`/`###` headings, paragraphs, `-` and `1.` lists, `>` quotes,
`**bold**`, `*italics*` and `[links](url)`. Nothing else renders — no HTML, no
images, no tables. A final `## FAQ` section (or `## Preguntas frecuentes` /
`## Preguntes freqüents`) with `### Question` + answer pairs becomes the page's
FAQ and its `FAQPage` structured data.

Site links can omit the locale: `/pupdojo` becomes `/es/pupdojo` on a Spanish page.

## Publishing

```
npx tsx scripts/publish-articles.ts pupdojo --dry-run   # validate + editorial warnings
npx tsx scripts/publish-articles.ts pupdojo             # publish to www.idionlabs.com
```

`--only <translationKey>` publishes one article; `--base-url http://localhost:3000`
targets a local server. The script needs `ARTICLE_INGEST_TOKEN` (in `.env.local`
or the environment), the same value as on Vercel.

Re-running is safe: unchanged articles stay unchanged (their `dateModified` does
not move). Removing a file does **not** unpublish its page — set
`status: draft` and publish again. Renaming a file renames the URL (the
`translationKey` keeps it the same article) and the old URL then 404s, so avoid
renaming an article once it has been published and indexed.

## When articles appear in search

Articles are public as soon as they are published, but they are `noindex` and
out of the sitemap and `/llms.txt` until the app's **Indexable** switch is on in
the panel — the same switch as the product page, normally flipped at launch.

## What the site does for each article

- `Article`, `BreadcrumbList` and (with an FAQ) `FAQPage` JSON-LD.
- `hreflang` only for the translations that exist; OpenGraph article dates.
- Smart App Banner on iOS, store badge and a link back to the app.
- A "Guides" list on the product page and a `/guides` index per locale.
- Sitemap entries with the real last-modified date, and an entry in `/llms.txt`.

## Measuring

Add the domain to Google Search Console and Bing Webmaster Tools (Bing feeds
ChatGPT search and Copilot) and submit `/sitemap.xml`. Check per-article
impressions and queries after 4–6 weeks; rewrite the articles that get
impressions but no clicks before writing new ones.
