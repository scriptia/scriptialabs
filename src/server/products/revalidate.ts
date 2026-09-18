import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';

import { PRODUCTS_TAG, productLegalTag, productTag } from '@/server/queries/public-products';

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

  if (options.listing !== false) {
    revalidateTag(PRODUCTS_TAG);
    revalidatePath('/sitemap.xml');
  }
}

/**
 * Purge every product surface. For changes with no single slug — a reorder, a
 * bulk import — and as the manual "Revalidate now" escape hatch in the panel.
 */
export function revalidateAllProducts(): void {
  revalidateTag(PRODUCTS_TAG);
  revalidatePath('/sitemap.xml');
}
