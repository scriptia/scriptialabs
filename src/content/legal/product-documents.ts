// The per-product legal document vocabulary.
//
// What survives of src/content/legal/product-legal.ts, which used to be the
// registry of which documents each product shipped and which sections each one
// contained. Those are rows now (`product_legal_documents` /
// `product_legal_sections`, ADR-013). The KEYS remain shared language: the
// schema types a column with them, the publish payload validates against them,
// the job descriptor hands them to a run, and product-agent's `legal` stage
// writes them into its output.

export const productLegalDocumentKeys = ['privacy', 'terms', 'cookies', 'aiPolicy', 'contact', 'dataDeletion', 'accountDeletion', 'acceptableUse'] as const;

export type ProductLegalDocumentKey = (typeof productLegalDocumentKeys)[number];

// Labels default to the document key. `termsEula` exists because a terms
// document that doubles as an app store EULA has to say so in the link text,
// while the plain company-wide terms must not.
export const productLegalLabelKeys = [...productLegalDocumentKeys, 'termsEula'] as const;

export type ProductLegalLabelKey = (typeof productLegalLabelKeys)[number];

// docKey -> URL segment: /{locale}/{productSlug}/legal/{slug}.
//
// Only `aiPolicy` differs from its own kebab-case, but this is a map rather than
// a transform because it is a CONTRACT — product-agent writes these URLs into
// legal documents and into App Store Connect, and an app store holds them for
// years. A slug is not something to re-derive from a naming convention that
// might change.
export const productLegalDocumentSlugs: Record<ProductLegalDocumentKey, string> = {
  privacy: 'privacy',
  terms: 'terms',
  cookies: 'cookies',
  aiPolicy: 'ai-policy',
  contact: 'contact',
  dataDeletion: 'data-deletion',
  accountDeletion: 'account-deletion',
  acceptableUse: 'acceptable-use'
};

export function isProductLegalDocumentKey(value: string): value is ProductLegalDocumentKey {
  return (productLegalDocumentKeys as readonly string[]).includes(value);
}
