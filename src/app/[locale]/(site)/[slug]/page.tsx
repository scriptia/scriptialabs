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
import { products, getProductBySlug, type ProductRecord } from '@/content/products';
import { productMessageKeyById } from '@/content/products/message-keys';
import { legalDocuments, getLegalDocumentEntryBySlug, type LegalDocumentKey } from '@/content/legal';
import { productLegalDocuments } from '@/content/legal/product-legal';
import { contactFormCategories } from '@/content/contact';
import { canonicalRoutes } from '@/lib/routing/routes';
import { Link as LocaleLink } from '@/lib/i18n/routing';
import { buildMetadata, buildSoftwareApplicationSchema, createJsonLd } from '@/lib/seo';
import { buildCanonicalPath } from '@/lib/seo/canonical';

// Products, legal documents, and the contact page share one flat top-level
// slug namespace (`/scriptia`, `/privacy`, `/contact`, …) — Next.js doesn't
// allow two dynamic routes at the same URL depth even across different
// route groups, so this single route resolves against every content source
// rather than being split up. See ADR-008.
type PageProps = Readonly<{ params: Promise<{ locale: string; slug: string }> }>;

const CONTACT_SLUG = canonicalRoutes.contact.slice(1);
const publishedProducts = products.filter((product) => product.status !== 'archived');

export function generateStaticParams() {
  return [{ slug: CONTACT_SLUG }, ...publishedProducts.map((product) => ({ slug: product.slug })), ...Object.values(legalDocuments).map((document) => ({ slug: document.slug }))];
}

function resolveProduct(slug: string): ProductRecord | undefined {
  const product = getProductBySlug(slug);
  return product && product.status !== 'archived' ? product : undefined;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = locale as Locale;

  const product = resolveProduct(slug);
  if (product) {
    const messageKey = productMessageKeyById[product.id];
    const t = await getTranslations({ locale: resolvedLocale, namespace: `products.${messageKey}` });
    return buildMetadata({
      locale: resolvedLocale,
      title: t('seo.title'),
      description: t('seo.description'),
      path: product.links.canonical,
      noindex: !product.seo.indexable
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

  notFound();
}

export default async function SlugPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const resolvedLocale = locale as Locale;

  const product = resolveProduct(slug);
  if (product) {
    return <ProductPageView locale={resolvedLocale} product={product} />;
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

async function ProductPageView({ locale, product }: { locale: Locale; product: ProductRecord }) {
  const messageKey = productMessageKeyById[product.id];
  const t = await getTranslations({ locale, namespace: `products.${messageKey}` });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  const eyebrowClass = productAccentTextClassName[product.accent];
  const statusLabel = tCommon(`productStatus.${product.status}`);

  const schema = buildSoftwareApplicationSchema({
    name: t('name'),
    description: t('seo.description'),
    url: buildCanonicalPath(locale, product.links.canonical),
    publisherName: contentSite.name,
    publisherUrl: contentSite.url
  });

  const featureKeyPrefix = `products.${messageKey}.`;
  const stepKeys = ['1', '2', '3'] as const;
  const faqKeys = ['1', '2', '3', '4'] as const;
  const themeClass = productThemeClassName[product.accent];
  // `live` = the running app (only Scriptia today); when absent the CTAs send
  // people to the in-domain products index instead of off-site.
  const liveUrl = product.links.live;
  const productsHref = `/${locale}/products`;

  return (
    <div className={`${themeClass} bg-background text-text-primary`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createJsonLd(schema) }} />

      {/* Hero */}
      <ProductHero
        eyebrow={contentSite.name}
        title={t('hero.title')}
        description={t('hero.description')}
        accent={product.accent}
        status={product.status}
        statusLabel={statusLabel}
        primary={
          liveUrl
            ? { label: t('page.cta.primary'), href: liveUrl, external: true }
            : { label: t('page.cta.primary'), href: productsHref }
        }
        secondary={liveUrl ? { label: t('page.cta.secondary'), href: '#overview' } : undefined}
      />

      {/* Product overview */}
      <Section spacing="md" id="overview" className="scroll-mt-24">
        <Container size="reading">
          <ScrollReveal>
            <Stack gap="md">
              <div className={`text-caption font-medium uppercase tracking-[0.1em] ${eyebrowClass}`}>{t('page.overview.title')}</div>
              <Body size="large">{t('page.overview.body')}</Body>
              {product.id === 'scriptia' ? (
                <LocaleLink
                  href={`${product.links.canonical}/brand`}
                  className="w-fit text-body-small font-medium text-brand underline-offset-4 transition-colors hover:underline"
                >
                  {t('page.brandCta')} →
                </LocaleLink>
              ) : null}
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* Key capabilities */}
      {product.features.length > 0 ? (
        <Section spacing="md" className="bg-background-muted">
          <Container size="content">
            <ScrollReveal>
              <Stack gap="xl">
                <SectionHeading eyebrow={t('name')} title={t('page.capabilities.title')} />
                <Grid cols={3} gap="lg">
                  {product.features.map((feature) => {
                    const relativeTitleKey = feature.titleKey.replace(featureKeyPrefix, '');
                    const relativeDescriptionKey = feature.descriptionKey.replace(featureKeyPrefix, '');
                    return <FeatureCard key={feature.titleKey} title={t(relativeTitleKey)} description={t(relativeDescriptionKey)} />;
                  })}
                </Grid>
              </Stack>
            </ScrollReveal>
          </Container>
        </Section>
      ) : null}

      {/* How it works */}
      <Section spacing="md">
        <Container size="content">
          <ScrollReveal>
            <Stack gap="xl">
              <SectionHeading eyebrow={t('page.howItWorks.title')} title={t('page.howItWorks.title')} description={t('page.howItWorks.description')} />
              <Timeline
                steps={stepKeys.map((key) => ({
                  title: t(`page.howItWorks.steps.${key}.title`),
                  description: t(`page.howItWorks.steps.${key}.description`)
                }))}
              />
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* Why it exists */}
      <Section spacing="md" className="bg-background-muted">
        <Container size="reading">
          <ScrollReveal>
            <Stack gap="md">
              <div className={`text-caption font-medium uppercase tracking-[0.1em] ${eyebrowClass}`}>{t('page.why.title')}</div>
              <Body size="large">{t('page.why.body')}</Body>
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* Current status */}
      <Section spacing="sm">
        <Container size="reading">
          <ScrollReveal>
            <Stack gap="sm">
              <div className="flex items-center gap-3">
                <Heading level={3}>{t('page.status.title')}</Heading>
                <ProductStatusBadge status={product.status}>{statusLabel}</ProductStatusBadge>
              </div>
              <Body>{t('page.status.body')}</Body>
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* FAQ */}
      <Section spacing="md" id="faq" className="scroll-mt-24">
        <Container size="content">
          <ScrollReveal>
            <Stack gap="xl">
              <SectionHeading title={t('page.faq.title')} />
              <Accordion
                items={faqKeys.map((key) => ({
                  title: t(`page.faq.items.${key}.question`),
                  content: t(`page.faq.items.${key}.answer`)
                }))}
              />
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* Legal — only for products that have shipped their own legal docs; see ADR-009 */}
      {productLegalDocuments[product.id] ? (
        <Section spacing="sm">
          <Container size="reading">
            <Stack gap="sm">
              <div className="text-caption font-medium uppercase tracking-[0.1em] text-text-tertiary">{tCommon('legalLinksTitle')}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {Object.entries(productLegalDocuments[product.id]!).map(([key, document]) => (
                  <LocaleLink
                    key={key}
                    href={`${product.links.canonical}/legal/${document.slug}`}
                    className="text-body-small text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
                  >
                    {tCommon(`legalDocLabels.${key}`)}
                  </LocaleLink>
                ))}
              </div>
            </Stack>
          </Container>
        </Section>
      ) : null}

      {/* Call to Action */}
      <GlobalCTA
        title={t('page.cta.title')}
        description={t('page.cta.description')}
        primary={
          liveUrl
            ? { label: t('page.cta.primary'), href: liveUrl, external: true }
            : { label: t('page.cta.primary'), href: productsHref }
        }
        secondary={liveUrl && t.has('page.cta.secondary') ? { label: t('page.cta.secondary'), href: productsHref } : undefined}
      />
    </div>
  );
}
