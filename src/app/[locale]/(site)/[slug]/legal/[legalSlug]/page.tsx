import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { LegalDocumentView } from '@/components/legal';
import { Container, Section } from '@/components/surfaces';
import type { Locale } from '@/lib/i18n/routing';
import { getProductBySlug } from '@/content/products';
import { productMessageKeyById } from '@/content/products/message-keys';
import { productLegalDocuments, getProductLegalEntry } from '@/content/legal/product-legal';
import { buildMetadata } from '@/lib/seo';

// Next.js requires sibling dynamic segments at the same directory depth to
// share one param name, so this reuses `slug` (the same name as the parent
// product/legal/contact route — see ADR-008) rather than a distinct
// `productId`, even though here it only ever resolves to a product slug.
type PageProps = Readonly<{ params: Promise<{ locale: string; slug: string; legalSlug: string }> }>;

export function generateStaticParams() {
  return Object.entries(productLegalDocuments).flatMap(([slug, documents]) => Object.values(documents).map((document) => ({ slug, legalSlug: document.slug })));
}

function resolveProductLegalEntry(slug: string, legalSlug: string) {
  const product = getProductBySlug(slug);
  if (!product || !productLegalDocuments[product.id]) {
    notFound();
  }

  const entry = getProductLegalEntry(product.id, legalSlug);
  if (!entry) {
    notFound();
  }

  return { product, key: entry.key, document: entry.document, messageKey: productMessageKeyById[product.id] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug, legalSlug } = await params;
  const { product, key, document, messageKey } = resolveProductLegalEntry(slug, legalSlug);
  const t = await getTranslations({ locale: locale as Locale, namespace: `productLegal.${messageKey}.${key}` });

  return buildMetadata({
    locale: locale as Locale,
    title: t('title'),
    description: t('description'),
    path: `${product.links.canonical}/legal/${document.slug}`
  });
}

export default async function ProductLegalPage({ params }: PageProps) {
  const { locale, slug, legalSlug } = await params;
  const resolvedLocale = locale as Locale;
  const { key, document, messageKey } = resolveProductLegalEntry(slug, legalSlug);

  const t = await getTranslations({ locale: resolvedLocale, namespace: `productLegal.${messageKey}.${key}` });
  const tLegalCommon = await getTranslations({ locale: resolvedLocale, namespace: 'legal.common' });
  const lastUpdated = new Intl.DateTimeFormat(resolvedLocale, { dateStyle: 'long' }).format(new Date(document.lastUpdated));

  return (
    <Section spacing="lg">
      <Container size="content">
        <LegalDocumentView
          title={t('title')}
          description={t('description')}
          lastUpdatedLabel={tLegalCommon('lastUpdated', { date: lastUpdated })}
          tocLabel={tLegalCommon('onThisPage')}
          sections={document.sections.map((sectionId) => ({
            id: sectionId,
            title: t(`sections.${sectionId}.title`),
            body: t.raw(`sections.${sectionId}.body`) as string[]
          }))}
        />
      </Container>
    </Section>
  );
}
