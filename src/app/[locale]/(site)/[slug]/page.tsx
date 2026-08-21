import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { Body, Heading } from '@/components/typography';
import { Container, Grid, Section, Stack } from '@/components/surfaces';
import { Accordion, SectionHeading, Timeline } from '@/components/display';
import { FeatureCard, ProductStatusBadge } from '@/components/data';
import { LegalDocumentView } from '@/components/legal';
import { ContactForm } from '@/components/forms';
import { ScrollReveal } from '@/components/motion';
import { GlobalCTA } from '@/components/layout';
import { ProductHero } from '@/components/product';
import { productAccentTextClassName, productThemeClassName } from '@/design/theme';
import type { Locale } from '@/lib/i18n/routing';
import { contentSite } from '@/content/site';
import { legalDocuments, getLegalDocumentEntryBySlug, type LegalDocumentKey } from '@/content/legal';
import { contactFormCategories } from '@/content/contact';
import { canonicalRoutes } from '@/lib/routing/routes';
import { Link as LocaleLink } from '@/lib/i18n/routing';
import { buildMetadata, buildSoftwareApplicationSchema, createJsonLd } from '@/lib/seo';
import { buildCanonicalPath } from '@/lib/seo/canonical';
import { getProductPage, listProductSlugs, type ProductPageView } from '@/server/content/products';

// Products, legal documents, and the contact page share one flat top-level
// slug namespace (`/scriptia`, `/privacy`, `/contact`, …) — Next.js doesn't
// allow two dynamic routes at the same URL depth even across different
// route groups, so this single route resolves against every content source
// rather than being split up. See ADR-008.
type PageProps = Readonly<{ params: Promise<{ locale: string; slug: string }> }>;

const CONTACT_SLUG = canonicalRoutes.contact.slice(1);

// Products published after the last deploy still render: this route prerenders
// what exists at build time and serves anything else on first request, then
// caches it. That is what makes "publish in the panel, page live in seconds"
// true without a rebuild. A slug with no published product still 404s, because
// getProductPage applies the publication predicate.
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await listProductSlugs();
  return [{ slug: CONTACT_SLUG }, ...slugs.map((slug) => ({ slug })), ...Object.values(legalDocuments).map((document) => ({ slug: document.slug }))];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = locale as Locale;

  const product = await getProductPage(resolvedLocale, slug);
  if (product) {
    return buildMetadata({
      locale: resolvedLocale,
      title: product.seoTitle,
      description: product.seoDescription,
      path: product.canonical,
      noindex: !product.indexable
    });
  }

  const legalEntry = getLegalDocumentEntryBySlug(slug);
  if (legalEntry) {
    const t = await getTranslations({ locale: resolvedLocale, namespace: `legal.${legalEntry.key}` });
    return buildMetadata({
      locale: resolvedLocale,
      title: t('title'),
      description: t('description'),
      path: `/${legalEntry.document.slug}`
    });
  }

  if (slug === CONTACT_SLUG) {
    const t = await getTranslations({ locale: resolvedLocale, namespace: 'contact' });
    return buildMetadata({
      locale: resolvedLocale,
      title: t('title'),
      description: t('description'),
      path: canonicalRoutes.contact
    });
  }

  // Deliberately not notFound() here. Calling it from generateMetadata renders
  // the not-found UI but cannot set the response status, so every unmatched
  // slug was served as a soft 404 (HTTP 200). Returning noindex metadata lets
  // SlugPage's own notFound() below produce the real 404.
  return buildMetadata({ locale: resolvedLocale, noindex: true });
}

export default async function SlugPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const resolvedLocale = locale as Locale;

  const product = await getProductPage(resolvedLocale, slug);
  if (product) {
    return <ProductPageView_ locale={resolvedLocale} product={product} />;
  }

  const legalEntry = getLegalDocumentEntryBySlug(slug);
  if (legalEntry) {
    return <LegalPageView locale={resolvedLocale} documentKey={legalEntry.key} document={legalEntry.document} />;
  }

  if (slug === CONTACT_SLUG) {
    return <ContactPageView locale={resolvedLocale} />;
  }

  notFound();
}

async function ContactPageView({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'contact' });

  return (
    <Section spacing="lg">
      <Container size="reading">
        <ScrollReveal>
          <Stack gap="xl">
            <Stack gap="sm">
              <Heading level={1}>{t('title')}</Heading>
              <Body size="large" className="text-text-secondary">
                {t('description')}
              </Body>
            </Stack>
            <ContactForm
              labels={{
                name: t('form.name'),
                namePlaceholder: t('form.namePlaceholder'),
                email: t('form.email'),
                emailPlaceholder: t('form.emailPlaceholder'),
                category: t('form.category'),
                message: t('form.message'),
                messagePlaceholder: t('form.messagePlaceholder'),
                submit: t('form.submit'),
                submitting: t('form.submitting'),
                successTitle: t('form.successTitle'),
                successDescription: t('form.successDescription')
              }}
              categories={contactFormCategories.map((category) => ({ value: category, label: t(`form.categories.${category}`) }))}
            />
          </Stack>
        </ScrollReveal>
      </Container>
    </Section>
  );
}

async function LegalPageView({
  locale,
  documentKey,
  document
}: {
  locale: Locale;
  documentKey: LegalDocumentKey;
  document: (typeof legalDocuments)[LegalDocumentKey];
}) {
  const t = await getTranslations({ locale, namespace: `legal.${documentKey}` });
  const tLegalCommon = await getTranslations({ locale, namespace: 'legal.common' });
  const lastUpdated = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(document.lastUpdated));

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

// Named with a trailing underscore because `ProductPageView` is the view-model
// type imported above.
async function ProductPageView_({ locale, product }: { locale: Locale; product: ProductPageView }) {
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  const eyebrowClass = productAccentTextClassName[product.accent];
  const statusLabel = tCommon(`productStatus.${product.status}`);

  const schema = buildSoftwareApplicationSchema({
    name: product.name,
    description: product.seoDescription,
    url: buildCanonicalPath(locale, product.canonical),
    publisherName: contentSite.name,
    publisherUrl: contentSite.url
  });

  const themeClass = productThemeClassName[product.accent];
  // `live` = the running app (only Scriptia today); when absent the CTAs send
  // people to the in-domain products index instead of off-site.
  const liveUrl = product.liveUrl;
  const productsHref = `/${locale}/products`;
  const page = product.page;

  return (
    <div className={`${themeClass} bg-background text-text-primary`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createJsonLd(schema) }} />

      {/* Hero */}
      <ProductHero
        eyebrow={contentSite.name}
        title={product.heroTitle}
        description={product.heroDescription}
        accent={product.accent}
        status={product.status}
        statusLabel={statusLabel}
        primary={
          liveUrl
            ? { label: page.cta?.primary ?? '', href: liveUrl, external: true }
            : { label: page.cta?.primary ?? '', href: productsHref }
        }
        secondary={liveUrl ? { label: page.cta?.secondary ?? '', href: '#overview' } : undefined}
      />

      {/* Product overview */}
      {page.overview ? (
        <Section spacing="md" id="overview" className="scroll-mt-24">
          <Container size="reading">
            <ScrollReveal>
              <Stack gap="md">
                <div className={`text-caption font-medium uppercase tracking-[0.1em] ${eyebrowClass}`}>{page.overview.title}</div>
                <Body size="large">{page.overview.body}</Body>
                {page.brandCta ? (
                  <LocaleLink
                    href={`${product.canonical}/brand`}
                    className="w-fit text-body-small font-medium text-brand underline-offset-4 transition-colors hover:underline"
                  >
                    {page.brandCta} →
                  </LocaleLink>
                ) : null}
              </Stack>
            </ScrollReveal>
          </Container>
        </Section>
      ) : null}

      {/* Key capabilities */}
      {product.features.length > 0 ? (
        <Section spacing="md" className="bg-background-muted">
          <Container size="content">
            <ScrollReveal>
              <Stack gap="xl">
                <SectionHeading eyebrow={product.name} title={page.capabilitiesTitle ?? ''} />
                <Grid cols={3} gap="lg">
                  {product.features.map((feature) => (
                    <FeatureCard key={feature.key} title={feature.title} description={feature.description} />
                  ))}
                </Grid>
              </Stack>
            </ScrollReveal>
          </Container>
        </Section>
      ) : null}

      {/* How it works */}
      {page.howItWorks ? (
        <Section spacing="md">
          <Container size="content">
            <ScrollReveal>
              <Stack gap="xl">
                <SectionHeading eyebrow={page.howItWorks.title} title={page.howItWorks.title} description={page.howItWorks.description} />
                <Timeline steps={page.howItWorks.steps.map((step) => ({ title: step.title, description: step.description }))} />
              </Stack>
            </ScrollReveal>
          </Container>
        </Section>
      ) : null}

      {/* Why it exists */}
      {page.why ? (
        <Section spacing="md" className="bg-background-muted">
          <Container size="reading">
            <ScrollReveal>
              <Stack gap="md">
                <div className={`text-caption font-medium uppercase tracking-[0.1em] ${eyebrowClass}`}>{page.why.title}</div>
                <Body size="large">{page.why.body}</Body>
              </Stack>
            </ScrollReveal>
          </Container>
        </Section>
      ) : null}

      {/* Current status */}
      {page.statusBlock ? (
        <Section spacing="sm">
          <Container size="reading">
            <ScrollReveal>
              <Stack gap="sm">
                <div className="flex items-center gap-3">
                  <Heading level={3}>{page.statusBlock.title}</Heading>
                  <ProductStatusBadge status={product.status}>{statusLabel}</ProductStatusBadge>
                </div>
                <Body>{page.statusBlock.body}</Body>
              </Stack>
            </ScrollReveal>
          </Container>
        </Section>
      ) : null}

      {/* FAQ */}
      {page.faq && page.faq.items.length > 0 ? (
        <Section spacing="md" id="faq" className="scroll-mt-24">
          <Container size="content">
            <ScrollReveal>
              <Stack gap="xl">
                <SectionHeading title={page.faq.title} />
                <Accordion items={page.faq.items.map((item) => ({ title: item.question, content: item.answer }))} />
              </Stack>
            </ScrollReveal>
          </Container>
        </Section>
      ) : null}

      {/* Legal — only for products that have shipped their own legal docs; see ADR-009 */}
      {product.legalLinks.length > 0 ? (
        <Section spacing="sm">
          <Container size="reading">
            <Stack gap="sm">
              <div className="text-caption font-medium uppercase tracking-[0.1em] text-text-tertiary">{tCommon('legalLinksTitle')}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {product.legalLinks.map((document) => (
                  <LocaleLink
                    key={document.docKey}
                    href={`${product.canonical}/legal/${document.slug}`}
                    className="text-body-small text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
                  >
                    {tCommon(`legalDocLabels.${document.labelKey}`)}
                  </LocaleLink>
                ))}
              </div>
            </Stack>
          </Container>
        </Section>
      ) : null}

      {/* Call to Action */}
      {page.cta ? (
        <GlobalCTA
          title={page.cta.title}
          description={page.cta.description}
          primary={liveUrl ? { label: page.cta.primary, href: liveUrl, external: true } : { label: page.cta.primary, href: productsHref }}
          secondary={liveUrl && page.cta.secondary ? { label: page.cta.secondary, href: productsHref } : undefined}
        />
      ) : null}
    </div>
  );
}
