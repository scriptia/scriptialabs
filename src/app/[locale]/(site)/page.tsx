import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/primitives';
import { Body, Display, Heading } from '@/components/typography';
import { Container, Grid, Section, Stack } from '@/components/surfaces';
import { SectionHeading } from '@/components/display';
import { FeatureCard, ProductCard, ProductStatusBadge } from '@/components/data';
import { FadeUp, ScrollReveal } from '@/components/motion';
import { GlobalCTA } from '@/components/layout';
import { Link as LocaleLink, type Locale } from '@/lib/i18n/routing';
import { productAccentBackgroundClassName } from '@/design/theme';
import { contentSite } from '@/content/site';
import { products } from '@/content/products';
import { productMessageKeyById } from '@/content/products/message-keys';
import { buildMetadata, buildOrganizationSchema, createJsonLd } from '@/lib/seo';

type PageProps = Readonly<{ params: Promise<{ locale: string }> }>;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'homepage' });

  return buildMetadata({
    locale: locale as Locale,
    title: `${contentSite.name} — Software & AI Lab`,
    description: t('hero.description'),
    path: '/'
  });
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  const resolvedLocale = locale as Locale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'homepage' });
  const tCommon = await getTranslations({ locale: resolvedLocale, namespace: 'common' });

  const organizationSchema = buildOrganizationSchema({
    name: contentSite.name,
    url: contentSite.url
  });

  const visibleProducts = products.filter((product) => product.status !== 'archived');

  const philosophyKeys = ['craftsmanship', 'purposefulAi', 'longTerm', 'discipline'] as const;
  const whyKeys = ['builders', 'practicalAi', 'oneTeam'] as const;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createJsonLd(organizationSchema) }} />

      {/* 1. Hero */}
      <Section spacing="lg" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,hsl(var(--color-brand)/0.14),transparent_70%)]"
        />
        <Container size="hero">
          <FadeUp>
            <Stack gap="lg" align="center" className="text-center">
              <div className="text-caption font-medium uppercase tracking-[0.14em] text-text-tertiary">{t('hero.eyebrow')}</div>
              <Display level="xl" className="max-w-[20ch]">
                {t('hero.title')}
              </Display>
              <Body size="large" className="max-w-reading text-text-secondary">
                {t('hero.description')}
              </Body>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button size="lg" asChild>
                  <a href="#products">{t('hero.primaryCta')}</a>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <a href="#philosophy">{t('hero.secondaryCta')}</a>
                </Button>
              </div>
            </Stack>
          </FadeUp>
        </Container>
      </Section>

      {/* 2. Who We Are */}
      <Section spacing="md">
        <Container size="reading">
          <ScrollReveal>
            <Stack gap="md">
              <div className="text-caption font-medium uppercase tracking-[0.1em] text-text-tertiary">{t('whoWeAre.eyebrow')}</div>
              <Heading level={2}>{t('whoWeAre.title')}</Heading>
              <Body size="large">{t('whoWeAre.body')}</Body>
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* 3. Products */}
      <Section spacing="md" id="products" className="scroll-mt-24 bg-background-muted">
        <Container size="content">
          <ScrollReveal>
            <Stack gap="xl">
              <SectionHeading eyebrow={t('products.eyebrow')} title={t('products.title')} description={t('products.description')} />
              <Grid cols={3} gap="lg">
                {visibleProducts.map((product) => {
                  const messageKey = productMessageKeyById[product.id];
                  const href = product.links.external ?? product.links.canonical;
                  const showStatus = product.status === 'teaser' || product.status === 'beta' || product.status === 'alpha';

                  const card = (
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
                  );

                  return product.links.external ? (
                    <a key={product.id} href={product.links.external} target="_blank" rel="noreferrer" className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg">
                      {card}
                    </a>
                  ) : (
                    <LocaleLink key={product.id} href={href} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg">
                      {card}
                    </LocaleLink>
                  );
                })}
              </Grid>
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* 4. Our Philosophy */}
      <Section spacing="md" id="philosophy" className="scroll-mt-24">
        <Container size="content">
          <ScrollReveal>
            <Stack gap="xl">
              <SectionHeading eyebrow={t('philosophy.eyebrow')} title={t('philosophy.title')} description={t('philosophy.description')} />
              <Grid cols={4} gap="md">
                {philosophyKeys.map((key) => (
                  <FeatureCard key={key} title={t(`philosophy.principles.${key}.title`)} description={t(`philosophy.principles.${key}.description`)} />
                ))}
              </Grid>
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* 5. Why Scriptia Labs */}
      <Section spacing="md" className="bg-background-muted">
        <Container size="content">
          <ScrollReveal>
            <Stack gap="xl">
              <SectionHeading eyebrow={t('why.eyebrow')} title={t('why.title')} />
              <Grid cols={3} gap="lg">
                {whyKeys.map((key) => (
                  <Stack key={key} gap="sm">
                    <Heading level={3}>{t(`why.points.${key}.title`)}</Heading>
                    <Body>{t(`why.points.${key}.description`)}</Body>
                  </Stack>
                ))}
              </Grid>
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* 6. Call To Action */}
      <GlobalCTA
        title={t('cta.title')}
        description={t('cta.description')}
        primary={{ label: t('cta.primary'), href: 'https://scriptiastories.com', external: true }}
        secondary={{ label: t('cta.secondary'), href: '#products' }}
      />

      {/* 7. Footer is rendered globally by the locale layout */}
    </>
  );
}
