import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { LegalDocumentView } from '@/components/legal';
import { Container, Section } from '@/components/surfaces';
import type { Locale } from '@/lib/i18n/routing';
import { productThemeClassName } from '@/design/theme';
import { buildMetadata } from '@/lib/seo';
import { getProductLegalDoc, getProductPage, listProductLegalParams } from '@/server/content/products';

// Next.js requires sibling dynamic segments at the same directory depth to
// share one param name, so this reuses `slug` (the same name as the parent
// product/legal/contact route — see ADR-008) rather than a distinct
// `productId`, even though here it only ever resolves to a product slug.
type PageProps = Readonly<{ params: Promise<{ locale: string; slug: string; legalSlug: string }> }>;

// Same reasoning as the parent route: a product published after the last deploy
// must serve its legal URLs immediately, without a rebuild. An App Store
// submission is rejected on a legal URL that does not resolve, so "it will be
// live after the next deploy" is not good enough.
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  return listProductLegalParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug, legalSlug } = await params;
  const resolvedLocale = locale as Locale;

  const document = await getProductLegalDoc(resolvedLocale, slug, legalSlug);
  if (!document) {
    // Same rule as the parent route: never notFound() from generateMetadata —
    // it renders the not-found UI but cannot set the status, which is a soft 404.
    return buildMetadata({ locale: resolvedLocale, noindex: true });
  }

  return buildMetadata({
    locale: resolvedLocale,
    title: document.title,
    description: document.description,
    path: `/${slug}/legal/${document.slug}`
  });
}

export default async function ProductLegalPage({ params }: PageProps) {
  const { locale, slug, legalSlug } = await params;
  const resolvedLocale = locale as Locale;

  const [document, product] = await Promise.all([getProductLegalDoc(resolvedLocale, slug, legalSlug), getProductPage(resolvedLocale, slug)]);

  // Both must resolve: the document carries the copy, the product carries the
  // accent theme. Either being absent means this URL should never have been
  // linked, so it is a real 404 rather than an untitled page.
  if (!document || !product) {
    notFound();
  }

  const tLegalCommon = await getTranslations({ locale: resolvedLocale, namespace: 'legal.common' });
  const lastUpdated = new Intl.DateTimeFormat(resolvedLocale, { dateStyle: 'long' }).format(new Date(document.lastUpdated));

  return (
    <div className={`${productThemeClassName[product.accent]} bg-background text-text-primary`}>
      <Section spacing="lg">
        <Container size="content">
          <LegalDocumentView
            title={document.title}
            description={document.description}
            lastUpdatedLabel={tLegalCommon('lastUpdated', { date: lastUpdated })}
            tocLabel={tLegalCommon('onThisPage')}
            sections={document.sections}
          />
        </Container>
      </Section>
    </div>
  );
}
