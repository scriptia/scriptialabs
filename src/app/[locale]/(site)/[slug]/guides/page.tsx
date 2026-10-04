import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { Container, Section, Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { articlesSegment } from '@/content/articles';
import { productThemeClassName } from '@/design/theme';
import { Link as LocaleLink, type Locale } from '@/lib/i18n/routing';
import { buildBreadcrumbSchema, buildMetadata, createJsonLd } from '@/lib/seo';
import { buildCanonicalPath } from '@/lib/seo/canonical';
import { getProductPage, listProductArticleUrls, listProductArticles } from '@/server/content/products';

// A product's guides index (ADR-014). Exists per locale only when that locale
// has at least one published article — an empty index is a thin page.
type PageProps = Readonly<{ params: Promise<{ locale: string; slug: string }> }>;

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  const urls = await listProductArticleUrls();
  const slugs = new Set(urls.filter((url) => url.locale === params.locale).map((url) => url.productSlug));
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = locale as Locale;

  const [product, articles, urls] = await Promise.all([getProductPage(resolvedLocale, slug), listProductArticles(resolvedLocale, slug), listProductArticleUrls()]);
  if (!product || articles.length === 0) {
    return buildMetadata({ locale: resolvedLocale, noindex: true });
  }

  const t = await getTranslations({ locale: resolvedLocale, namespace: 'articles' });
  const path = `${product.canonical}/${articlesSegment}`;
  const localesWithArticles = new Set(urls.filter((url) => url.productSlug === slug).map((url) => url.locale as Locale));

  return buildMetadata({
    locale: resolvedLocale,
    title: t('indexTitle', { product: product.name }),
    description: t('indexDescription', { product: product.name }),
    path,
    noindex: !product.indexable,
    appStoreId: product.store?.appStoreId,
    languages: Object.fromEntries([...localesWithArticles].map((alternate) => [alternate, path]))
  });
}

export default async function ProductGuidesPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const resolvedLocale = locale as Locale;

  const [product, articles] = await Promise.all([getProductPage(resolvedLocale, slug), listProductArticles(resolvedLocale, slug)]);
  if (!product || articles.length === 0) {
    notFound();
  }

  const t = await getTranslations({ locale: resolvedLocale, namespace: 'articles' });
  const breadcrumb = buildBreadcrumbSchema([
    { name: product.name, url: buildCanonicalPath(resolvedLocale, product.canonical) },
    { name: t('guidesTitle'), url: buildCanonicalPath(resolvedLocale, `${product.canonical}/${articlesSegment}`) }
  ]);

  return (
    <div className={`${productThemeClassName[product.accent]} bg-background text-text-primary`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createJsonLd(breadcrumb) }} />
      <Section spacing="lg">
        <Container size="reading">
          <Stack gap="xl">
            <Stack gap="sm">
              <LocaleLink href={product.canonical} className="text-body-small text-text-tertiary hover:text-text-primary">
                ← {product.name}
              </LocaleLink>
              <Heading level={1}>{t('indexTitle', { product: product.name })}</Heading>
              <Body size="large">{t('indexDescription', { product: product.name })}</Body>
            </Stack>
            <ul className="grid gap-8">
              {articles.map((article) => (
                <li key={article.slug} className="grid gap-2">
                  <Heading level={2} className="text-h3">
                    <LocaleLink href={`${product.canonical}/${articlesSegment}/${article.slug}`} className="underline-offset-4 hover:underline">
                      {article.title}
                    </LocaleLink>
                  </Heading>
                  <Body>{article.description}</Body>
                  <LocaleLink href={`${product.canonical}/${articlesSegment}/${article.slug}`} className="w-fit text-body-small font-medium text-brand underline-offset-4 hover:underline">
                    {t('readGuide')} →
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </Stack>
        </Container>
      </Section>
    </div>
  );
}
