import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';

import { PRODUCT_ARTICLES_TAG, PRODUCTS_TAG, productArticlesTag, productLegalTag, productTag } from '@/server/queries/public-products';

// Every write that can change what the public site shows ends here.
//
// Tags, not paths: the public surface is a 3 locales x N products x M documents
// matrix, and enumerating it path by path is how one gets missed. Each cached
// query in queries/public-products.ts declares its tags, so purging the tag
// invalidates every locale of every page that read it, in one call.
//
// The one exception is the sitemap. Route handlers are not tag-aware, so it has
// to be purged by path.

export type RevalidateProductOptions = {
  /**
   * Whether the listing surfaces (navbar, footer, homepage, /products, sitemap)
   * need purging too. Default true.
   *
   * Pass false only for an edit that cannot change how the product appears in a
   * listing — body copy, a legal section. A name, status, slug or publication
   * change must purge the listing, or the card and the page disagree.
   */
  listing?: boolean;
};

export function revalidateProduct(slug: string, options: RevalidateProductOptions = {}): void {
  revalidateTag(productTag(slug));
  revalidateTag(productLegalTag(slug));
  revalidateTag(productArticlesTag(slug));

  if (options.listing !== false) {
    revalidateTag(PRODUCTS_TAG);
    revalidatePath('/sitemap.xml');
    revalidatePath('/llms.txt');
  }
}

/**
 * Purge one product's articles (ADR-014): the article pages, the guides index,
 * the product page's guides list, and the two machine-readable listings. Does
 * not touch the product's own listing caches — an article cannot change a card.
 */
export function revalidateProductArticles(slug: string): void {
  revalidateTag(productArticlesTag(slug));
  revalidateTag(PRODUCT_ARTICLES_TAG);
  revalidatePath('/sitemap.xml');
  revalidatePath('/llms.txt');
}

/**
 * Purge every product surface. For changes with no single slug — a reorder, a
 * bulk import — and as the manual "Revalidate now" escape hatch in the panel.
 */
export function revalidateAllProducts(): void {
  revalidateTag(PRODUCTS_TAG);
  revalidatePath('/sitemap.xml');
  revalidatePath('/llms.txt');
}
