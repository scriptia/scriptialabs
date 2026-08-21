import { Grid } from '@/components/surfaces';
import { ProductCard, ProductStatusBadge } from '@/components/data';
import { Link as LocaleLink } from '@/lib/i18n/routing';
import { productAccentBackgroundClassName } from '@/design/theme';
import type { ProductCardView } from '@/server/content/product-view';

// The product card grid, rendered identically by the homepage and /products.
// It was duplicated in both routes; both now read the same view models from
// server/content/products, so the markup may as well be shared too — a card
// tweak that lands on one page and not the other is a bug nobody notices.

export type ProductCardGridProps = Readonly<{
  products: ProductCardView[];
  /** `common.productStatus.*`, resolved by the caller (a server component). */
  statusLabels: Record<string, string>;
}>;

// Only pre-launch states earn a badge. A `live` product's status is not news,
// and `draft`/`deprecated`/`archived` never reach a public listing.
const BADGED_STATUSES = new Set(['teaser', 'beta', 'alpha']);

export function ProductCardGrid({ products, statusLabels }: ProductCardGridProps) {
  return (
    <Grid cols={4} gap="lg">
      {products.map((product) => (
        <LocaleLink
          key={product.id}
          href={product.canonical}
          className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ProductCard
            title={
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${productAccentBackgroundClassName[product.accent]}`} />
                {product.name}
              </span>
            }
            description={product.cardDescription}
            badge={
              BADGED_STATUSES.has(product.status) ? (
                <ProductStatusBadge status={product.status}>{statusLabels[product.status]}</ProductStatusBadge>
              ) : undefined
            }
            className="h-full"
          />
        </LocaleLink>
      ))}
    </Grid>
  );
}
