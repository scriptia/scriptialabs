import 'server-only';

import type { Locale } from '@/lib/i18n/routing';
import {
  getProductLegalDocFromCode,
  getProductPageFromCode,
  listProductCardsFromCode,
  listProductLegalParamsFromCode,
  listProductLegalUrlsFromCode,
  listProductSlugsFromCode
} from './from-code';
import {
  getProductLegalDocFromDb,
  getProductPageFromDb,
  listProductCardsFromDb,
  listProductLegalUrlsFromDb,
  listProductSlugsFromDb
} from '@/server/queries/public-products';
import type { LegalDocView, ProductCardView, ProductLegalUrlView, ProductPageView } from './product-view';
import { publicContentSource } from './source';

// The public site's content API. Every public route calls these and nothing
// else — not the product registry, not the message files, not the database.
//
// While PUBLIC_CONTENT_SOURCE exists this dispatches between the two adapters;
// afterwards the `code` branch and this indirection both go away and these
// become thin re-exports of the database queries.

const useDb = publicContentSource === 'db';

/** Every published product, ordered, for the homepage, /products and the navbar. */
export function listProductCards(locale: Locale): Promise<ProductCardView[]> {
  return useDb ? listProductCardsFromDb(locale) : listProductCardsFromCode(locale);
}

/** Slugs for generateStaticParams. */
export function listProductSlugs(): Promise<string[]> {
  return useDb ? listProductSlugsFromDb() : Promise.resolve(listProductSlugsFromCode());
}

/**
 * One product page, or null when there is no published product at that slug.
 * Null is what the route turns into a real 404 — see the note in
 * docs/deployment.md about why that status is checked on every deploy.
 */
export function getProductPage(locale: Locale, slug: string): Promise<ProductPageView | null> {
  return useDb ? getProductPageFromDb(locale, slug) : getProductPageFromCode(locale, slug);
}

/** One product-legal document, or null. */
export function getProductLegalDoc(locale: Locale, slug: string, legalSlug: string): Promise<LegalDocView | null> {
  return useDb ? getProductLegalDocFromDb(locale, slug, legalSlug) : getProductLegalDocFromCode(locale, slug, legalSlug);
}

/** Every product-legal URL, for the sitemap. */
export function listProductLegalUrls(): Promise<ProductLegalUrlView[]> {
  return useDb ? listProductLegalUrlsFromDb() : Promise.resolve(listProductLegalUrlsFromCode());
}

/** Every (product, legal) param pair, for generateStaticParams. */
export async function listProductLegalParams(): Promise<Array<{ slug: string; legalSlug: string }>> {
  if (!useDb) return listProductLegalParamsFromCode();
  const urls = await listProductLegalUrlsFromDb();
  return urls.map(({ productSlug, docSlug }) => ({ slug: productSlug, legalSlug: docSlug }));
}

export type { LegalDocView, ProductCardView, ProductLegalUrlView, ProductPageView };
