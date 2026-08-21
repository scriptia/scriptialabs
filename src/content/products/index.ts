// The product lifecycle vocabulary.
//
// This file used to be the product REGISTRY — six hand-written products with
// their copy keys, links, features and accents — and it was the source the
// public site rendered from. That moved to the database (ADR-013); what is left
// is the status vocabulary, which is a shared language between the schema, the
// publish payload, the badges and the panel, and belongs in the content layer
// for the same reason `betStatuses` does.
//
// Stored as `text` in Postgres with this union applied via `$type`, not a PG
// enum (ADR-010), so adding a status is a one-line change here rather than an
// `ALTER TYPE` against live data.
//
//   draft      nothing public yet
//   teaser     a coming-soon page, live and linked but not submitted to search
//   alpha      in front of a few people
//   beta       in front of everyone who asks
//   live       shipped
//   deprecated still up, no longer worked on
//   archived   removed from the public site entirely
export const productStatuses = ['draft', 'teaser', 'alpha', 'beta', 'live', 'deprecated', 'archived'] as const;

export type ProductStatus = (typeof productStatuses)[number];

export function isProductStatus(value: string): value is ProductStatus {
  return (productStatuses as readonly string[]).includes(value);
}

// Pre-launch states earn a badge on a card; `live` is not news, and the rest
// never reach a public listing. Shared by ProductCardGrid and the panel.
export const badgedProductStatuses: readonly ProductStatus[] = ['teaser', 'alpha', 'beta'];
