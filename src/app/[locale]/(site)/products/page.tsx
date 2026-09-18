import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Container, Section, Stack } from '@/components/surfaces';
import { SectionHeading } from '@/components/display';
import { ProductCardGrid } from '@/components/product';
import { ScrollReveal } from '@/components/motion';
import { type Locale } from '@/lib/i18n/routing';
import { productStatuses } from '@/content/products';
import { buildMetadata } from '@/lib/seo';
import { listProductCards } from '@/server/content/products';

// A real destination for the "Products" nav item and every "Back to all
// products" CTA. Reuses the homepage `products` copy and the same card
// component rather than introducing a second source of product listing.
type PageProps = Readonly<{ params: Promise<{ locale: string }> }>;

export const revalidate = 3600;

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

  const visibleProducts = await listProductCards(resolvedLocale);
  const statusLabels = Object.fromEntries(productStatuses.map((status) => [status, tCommon(`productStatus.${status}`)]));

  return (
    <Section spacing="lg">
      <Container size="content">
        <ScrollReveal>
          <Stack gap="xl">
            <SectionHeading eyebrow={t('products.eyebrow')} title={t('products.title')} description={t('products.description')} />
            <ProductCardGrid products={visibleProducts} statusLabels={statusLabels} />
          </Stack>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
