import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/primitives';
import { Body, Display, Heading } from '@/components/typography';
import { Container, Grid, Section, Stack } from '@/components/surfaces';
import { SectionHeading } from '@/components/display';
import { FeatureCard } from '@/components/data';
import { ProductCardGrid } from '@/components/product';
import { FadeUp, ScrollReveal } from '@/components/motion';
import { GlobalCTA } from '@/components/layout';
import { type Locale } from '@/lib/i18n/routing';
import { contentSite } from '@/content/site';
import { productStatuses } from '@/content/products';
import { buildMetadata, buildOrganizationSchema, createJsonLd } from '@/lib/seo';
import { listProductCards } from '@/server/content/products';

type PageProps = Readonly<{ params: Promise<{ locale: string }> }>;

export const revalidate = 3600;

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

  const visibleProducts = await listProductCards(resolvedLocale);
  const statusLabels = Object.fromEntries(productStatuses.map((status) => [status, tCommon(`productStatus.${status}`)]));

  const philosophyKeys = ['craftsmanship', 'purposefulAi', 'longTerm', 'discipline'] as const;
  const whyKeys = ['builders', 'practicalAi', 'oneTeam'] as const;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createJsonLd(organizationSchema) }} />

      {/* 1. Hero — "committed" marketing register: green owns the surface,
          cream text, a single gold-accented CTA (see brand spec §4–5).
          Full-height opener so it reads as a statement, not a strip. */}
      <Section spacing="lg" className="relative flex min-h-[86dvh] items-center overflow-hidden bg-brand text-text-inverse">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,hsl(var(--color-brand-strong)/0.55),transparent_70%)]"
        />
        <Container size="hero">
          <FadeUp>
            <Stack gap="xl" align="center" className="text-center">
              <div className="text-body-small font-medium uppercase tracking-[0.2em] text-brand-warm">{t('hero.eyebrow')}</div>
              <Display level="xl" className="max-w-[22ch] text-balance text-text-inverse">
                {t('hero.title')}
              </Display>
              <Body className="max-w-2xl text-[1.2rem] leading-relaxed text-text-inverse/85 md:text-[1.3125rem]">
                {t('hero.description')}
              </Body>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <Button size="lg" className="h-14 bg-brand-warm px-7 text-base text-[hsl(var(--color-brand-strong))] hover:bg-brand-warm/90" asChild>
                  <a href="#products">{t('hero.primaryCta')}</a>
                </Button>
                <Button size="lg" variant="ghost" className="h-14 border border-text-inverse/40 px-7 text-base text-text-inverse hover:bg-text-inverse/10" asChild>
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
              <ProductCardGrid products={visibleProducts} statusLabels={statusLabels} />
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
        primary={{ label: t('cta.primary'), href: `/${resolvedLocale}/scriptia` }}
        secondary={{ label: t('cta.secondary'), href: `/${resolvedLocale}/products` }}
      />

      {/* 7. Footer is rendered globally by the locale layout */}
    </>
  );
}
