import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Container, Grid, Section, Stack } from '@/components/surfaces';
import { SectionHeading } from '@/components/display';
import { ProductCard, ProductStatusBadge } from '@/components/data';
import { ScrollReveal } from '@/components/motion';
import { Link as LocaleLink, type Locale } from '@/lib/i18n/routing';
import { productAccentBackgroundClassName } from '@/design/theme';
import { products } from '@/content/products';
import { productMessageKeyById } from '@/content/products/message-keys';
import { buildMetadata } from '@/lib/seo';

// A real destination for the "Products" nav item and every "Back to all
// products" CTA. Reuses the homepage `products` copy and the same card
// pattern rather than introducing a second source of product listing.
type PageProps = Readonly<{ params: Promise<{ locale: string }> }>;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'homepage' });
  return buildMetadata({
    locale: locale as Locale,
    title: t('products.title'),
    description: t('products.description'),
    path: '/products'
  });
}

export default async function ProductsPage({ params }: PageProps) {
  const { locale } = await params;
  const resolvedLocale = locale as Locale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'homepage' });
  const tCommon = await getTranslations({ locale: resolvedLocale, namespace: 'common' });

  const visibleProducts = products.filter((product) => product.status !== 'archived');

  return (
    <Section spacing="lg">
      <Container size="content">
        <ScrollReveal>
          <Stack gap="xl">
            <SectionHeading eyebrow={t('products.eyebrow')} title={t('products.title')} description={t('products.description')} />
            <Grid cols={4} gap="lg">
              {visibleProducts.map((product) => {
                const messageKey = productMessageKeyById[product.id];
                const showStatus = product.status === 'teaser' || product.status === 'beta' || product.status === 'alpha';

                return (
                  <LocaleLink
                    key={product.id}
                    href={product.links.canonical}
                    className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <ProductCard
                      title={
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${productAccentBackgroundClassName[product.accent]}`} />
                          {t(`products.items.${messageKey}.title`)}
                        </span>
                      }
                      description={t(`products.items.${messageKey}.description`)}
                      badge={showStatus ? <ProductStatusBadge status={product.status}>{tCommon(`productStatus.${product.status}`)}</ProductStatusBadge> : undefined}
                      className="h-full"
                    />
                  </LocaleLink>
                );
              })}
            </Grid>
          </Stack>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
