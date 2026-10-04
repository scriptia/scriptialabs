import 'server-only';

// The public site's content API.
//
// Every public route calls these and nothing else. This used to dispatch between
// a code-registry adapter and a database one behind PUBLIC_CONTENT_SOURCE, while
// the migration was in flight; both are gone, so it is now a thin, named surface
// over the cached queries in server/queries/public-products.ts.
//
// Kept as its own module rather than importing the queries directly at each call
// site, because the name is the contract: a public route reads
// `listProductCards`, not "some Drizzle select", and the publication predicate
// stays in exactly one file (ADR-013).

export {
  getProductArticleFromDb as getProductArticle,
  getProductLegalDocFromDb as getProductLegalDoc,
  getProductPageFromDb as getProductPage,
  listProductArticlesFromDb as listProductArticles,
  listProductArticleUrlsFromDb as listProductArticleUrls,
  listProductCardsFromDb as listProductCards,
  listProductLegalUrlsFromDb as listProductLegalUrls,
  listProductSlugsFromDb as listProductSlugs
} from '@/server/queries/public-products';

export { listProductArticleParams, listProductLegalParams } from '@/server/queries/public-products';

export type { ArticleCardView, ArticleView, LegalDocView, ProductArticleUrlView, ProductCardView, ProductLegalUrlView, ProductPageView } from './product-view';
