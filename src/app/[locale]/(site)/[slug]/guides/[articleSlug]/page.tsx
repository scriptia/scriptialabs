import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ArticleBody } from '@/components/article';
import { TableOfContents } from '@/components/legal';
import { StoreBadges } from '@/components/product';
import { Container, Section, Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { articlesSegment } from '@/content/articles';
import { contentSite } from '@/content/site';
import { productThemeClassName } from '@/design/theme';
import { Link as LocaleLink, routing, type Locale } from '@/lib/i18n/routing';
import { blocksToText, countWords, parseMarkdown } from '@/lib/markdown/parse';
import { buildArticleSchema, buildBreadcrumbSchema, buildFaqPageSchema, buildMetadata, createJsonLd } from '@/lib/seo';
import { buildCanonicalPath } from '@/lib/seo/canonical';
import { getProductArticle, getProductPage, listProductArticleParams, listProductArticles } from '@/server/content/products';

// Reuses `slug` for the product for the same reason the legal route does: one
// dynamic folder name per directory level (ADR-009). See ADR-014.
type PageProps = Readonly<{ params: Promise<{ locale: string; slug: string; articleSlug: string }> }>;

// Published after the last deploy still renders, then caches — the publish
// script's revalidation lands in seconds, the hour is only a backstop.
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  const all = await listProductArticleParams();
  return all.filter((entry) => entry.locale === params.locale).map(({ slug, articleSlug }) => ({ slug, articleSlug }));
}

const articlePath = (productSlug: string, articleSlug: string) => `/${productSlug}/${articlesSegment}/${articleSlug}`;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug, articleSlug } = await params;
  const resolvedLocale = locale as Locale;

  const [article, product] = await Promise.all([getProductArticle(resolvedLocale, slug, articleSlug), getProductPage(resolvedLocale, slug)]);
  if (!article || !product) {
    // Never notFound() from generateMetadata — see the product route.
    return buildMetadata({ locale: resolvedLocale, noindex: true });
  }

  const path = articlePath(slug, article.slug);

  return buildMetadata({
    locale: resolvedLocale,
    title: `${article.title} | ${product.name}`,
    description: article.description,
    path,
    // Articles follow their product into search (ADR-014): one switch, not two.
    noindex: !product.indexable,
    appStoreId: product.store?.appStoreId,
    languages: Object.fromEntries([[resolvedLocale, path], ...article.alternates.map((alternate) => [alternate.locale, articlePath(slug, alternate.slug)])]),
    article: { publishedTime: article.publishedAt, modifiedTime: article.updatedAt }
  });
}

export default async function ProductArticlePage({ params }: PageProps) {
  const { locale, slug, articleSlug } = await params;
  const resolvedLocale = locale as Locale;

  const [article, product, siblings] = await Promise.all([
    getProductArticle(resolvedLocale, slug, articleSlug),
    getProductPage(resolvedLocale, slug),
    listProductArticles(resolvedLocale, slug)
  ]);

  if (!article || !product) {
    notFound();
  }

  const t = await getTranslations({ locale: resolvedLocale, namespace: 'articles' });
  const tCommon = await getTranslations({ locale: resolvedLocale, namespace: 'common' });

  const blocks = parseMarkdown(article.body);
  const headings = blocks.filter((block) => block.type === 'heading' && block.level === 2) as Array<{ id: string; text: string }>;
  const showToc = headings.length >= 3;

  const url = buildCanonicalPath(resolvedLocale, articlePath(slug, article.slug));
  const productUrl = buildCanonicalPath(resolvedLocale, product.canonical);
  const guidesUrl = buildCanonicalPath(resolvedLocale, `${product.canonical}/${articlesSegment}`);
  const updated = new Intl.DateTimeFormat(resolvedLocale, { dateStyle: 'long' }).format(new Date(article.updatedAt));

  const schemas = [
    buildArticleSchema({
      headline: article.title,
      description: article.description,
      url,
      inLanguage: resolvedLocale,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      wordCount: countWords(blocksToText(blocks)),
      publisherName: contentSite.name,
      publisherUrl: contentSite.url,
      about: { name: product.name, url: productUrl }
    }),
    buildBreadcrumbSchema([
      { name: product.name, url: productUrl },
      { name: t('guidesTitle'), url: guidesUrl },
      { name: article.title, url }
    ]),
    ...(article.faq.length > 0 ? [buildFaqPageSchema(article.faq)] : [])
  ];

  const store = product.store;
  const more = siblings.filter((sibling) => sibling.slug !== article.slug).slice(0, 4);

  return (
    <div className={`${productThemeClassName[product.accent]} bg-background text-text-primary`}>
      {schemas.map((schema, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: createJsonLd(schema) }} />
      ))}

      <Section spacing="lg">
        <Container size="content">
          <div className={showToc ? 'grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start' : 'grid gap-10'}>
            {showToc ? <TableOfContents label={t('onThisPage')} items={headings.map((heading) => ({ id: heading.id, label: heading.text }))} /> : null}

            <article className="grid max-w-reading gap-10">
              <Stack gap="sm">
                <nav aria-label="Breadcrumb" className="text-body-small text-text-tertiary">
                  <LocaleLink href={product.canonical} className="hover:text-text-primary">
                    {product.name}
                  </LocaleLink>
                  <span aria-hidden="true"> / </span>
                  <LocaleLink href={`${product.canonical}/${articlesSegment}`} className="hover:text-text-primary">
                    {t('guidesTitle')}
                  </LocaleLink>
                </nav>
                <Heading level={1}>{article.title}</Heading>
                <Body size="large" className="text-text-secondary">
                  {article.description}
                </Body>
                <Body size="small" className="text-text-tertiary">
                  {t('byline', { product: product.name })} · <time dateTime={article.updatedAt}>{t('updated', { date: updated })}</time>
                </Body>
              </Stack>

              <ArticleBody markdown={article.body} locale={resolvedLocale} locales={routing.locales} siteUrl={contentSite.url} />

              {/* Rendered open, not in an accordion: answers hidden behind a
                  click are the ones crawlers and answer engines weigh least. */}
              {article.faq.length > 0 ? (
                <section id="faq" className="grid scroll-mt-24 gap-6">
                  <Heading level={2}>{t('faqTitle')}</Heading>
                  <dl className="grid gap-6">
                    {article.faq.map((item) => (
                      <div key={item.question} className="grid gap-2">
                        <dt className="font-display text-h3 font-medium leading-[1.14] text-text-primary">{item.question}</dt>
                        <dd className="font-sans text-body leading-[1.65] text-text-secondary">{item.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

              <aside className="grid gap-4 rounded-2xl border border-border bg-background-muted p-6">
                <Heading level={3}>{t('ctaTitle', { product: product.name })}</Heading>
                <Body>{product.tagline}</Body>
                <div className="flex flex-wrap items-center gap-4">
                  <StoreBadges
                    locale={resolvedLocale}
                    appStoreUrl={store?.appStoreUrl}
                    playStoreUrl={store?.playStoreUrl}
                    labels={{ appStore: tCommon('storeBadges.appStore'), googlePlay: tCommon('storeBadges.googlePlay') }}
                    size="md"
                  />
                  <LocaleLink href={product.canonical} className="text-body-small font-medium text-brand underline-offset-4 hover:underline">
                    {t('ctaLink', { product: product.name })} →
                  </LocaleLink>
                </div>
              </aside>

              {more.length > 0 ? (
                <nav aria-label={t('moreGuides', { product: product.name })} className="grid gap-4">
                  <Heading level={3}>{t('moreGuides', { product: product.name })}</Heading>
                  <ul className="grid gap-3">
                    {more.map((sibling) => (
                      <li key={sibling.slug}>
                        <LocaleLink href={articlePath(slug, sibling.slug)} className="text-body font-medium text-text-primary underline-offset-4 hover:underline">
                          {sibling.title}
                        </LocaleLink>
                        <Body size="small">{sibling.description}</Body>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
            </article>
          </div>
        </Container>
      </Section>
    </div>
  );
}
