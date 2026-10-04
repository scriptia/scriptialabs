// The per-product article vocabulary (ADR-014).
//
// Shared language between the schema, the ingest payload, the public routes and
// scripts/publish-articles.ts. Rows live in `product_articles`; this file only
// names the values.

export const articleStatuses = ['draft', 'published'] as const;

export type ArticleStatus = (typeof articleStatuses)[number];

// The URL segment under a product: /{locale}/{product}/guides/{articleSlug}.
// A contract, like productLegalDocumentSlugs — articles get linked from
// elsewhere and cited by answer engines, so it is not something to rename.
export const articlesSegment = 'guides';

// Lowercase kebab-case, the same rule product slugs follow.
export const articleSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ArticleFaqItem = { question: string; answer: string };
