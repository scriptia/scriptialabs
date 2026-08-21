import type { ProductLegalLabelKey } from '@/content/legal/product-legal';
import type { ProductStatus } from '@/content/products';
import type { ProductAccent } from '@/design/theme';

// The shape every public route renders from, with one locale already resolved
// to plain strings. Both adapters — from-code.ts (registry + message files) and
// queries/public-products.ts (database rows) — return exactly this, so the
// routes never branch on where the content came from.
//
// That is the whole trick behind proving the migration is safe: because the JSX
// is identical and only the data source differs, any difference in the rendered
// HTML is a defect in an adapter, and verify-product-parity.mjs can compare the
// two builds byte for byte with no whitelist.

/** Everything a product card needs, on the homepage, /products and the navbar. */
export type ProductCardView = {
  /** Stable React key. The product slug; unique by construction. */
  id: string;
  slug: string;
  status: ProductStatus;
  accent: ProductAccent;
  /** In-domain path for this product, e.g. `/scriptia`. */
  canonical: string;
  name: string;
  /** Longer blurb, for homepage and /products cards. */
  cardDescription: string;
  /** One-liner, for the navbar's product dropdown. */
  tagline: string;
  /** The running app on its own domain. Only ever the product page's CTA. */
  liveUrl?: string;
  /** Off-site marketing page. Replaces `canonical` in nav and footer links. */
  externalUrl?: string;
  indexable: boolean;
};

export type ProductFeatureView = {
  key: string;
  title: string;
  description: string;
};

export type ProductStepView = { title: string; description: string };
export type ProductFaqView = { question: string; answer: string };

/**
 * The `page.*` block. Every field optional: a machine-published product ships
 * without most of it, and the renderer skips a section it has no copy for
 * rather than printing a heading over an empty body.
 */
export type ProductPageSectionsView = {
  overview?: { title: string; body: string };
  capabilitiesTitle?: string;
  howItWorks?: { title: string; description: string; steps: ProductStepView[] };
  why?: { title: string; body: string };
  statusBlock?: { title: string; body: string };
  faq?: { title: string; items: ProductFaqView[] };
  cta?: { title: string; description: string; primary: string; secondary?: string };
  brandCta?: string;
};

/** A link to one of this product's legal documents, as rendered on its page. */
export type ProductLegalLinkView = {
  docKey: string;
  slug: string;
  /** Overrides the `common.legalDocLabels.*` key used for the link text. */
  labelKey: ProductLegalLabelKey | string;
};

export type ProductPageView = ProductCardView & {
  heroTitle: string;
  heroDescription: string;
  seoTitle: string;
  seoDescription: string;
  badges: string[];
  features: ProductFeatureView[];
  page: ProductPageSectionsView;
  legalLinks: ProductLegalLinkView[];
};

export type LegalSectionView = {
  id: string;
  title: string;
  body: string[];
};

export type LegalDocView = {
  docKey: string;
  slug: string;
  /** ISO `YYYY-MM-DD`, formatted for display by the route. */
  lastUpdated: string;
  title: string;
  description: string;
  sections: LegalSectionView[];
};

/** One product-legal URL, for the sitemap and the link checker. */
export type ProductLegalUrlView = {
  productSlug: string;
  docSlug: string;
  indexable: boolean;
};
