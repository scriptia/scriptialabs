import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/primitives';
import { Body, Display, Heading } from '@/components/typography';
import { Container, Grid, Section, Stack } from '@/components/surfaces';
import { SectionHeading } from '@/components/display';
import { FeatureCard } from '@/components/data';
import { ProductCardGrid } from '@/components/product';
import { FadeUp, ScrollReveal } from '@/components/motion';
import { GlobalCTA } from '@/components/layout';
import { OrbitField, PipelineDiagram, StatStrip } from '@/components/idion';
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
    title: `${contentSite.name} — ${t('meta.title')}`,
    description: t('hero.description'),
    path: '/'
  });
}

const PIPELINE_STAGES = ['conceive', 'build', 'deploy', 'scale'] as const;
const MOAT_POINTS = ['loop', 'stack', 'economics', 'memory'] as const;
const AUDIENCES = ['investors', 'builders'] as const;

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

  // Live counts only — read from the same published-product list the grid
  // renders, so the headline numbers can never disagree with the portfolio.
  const liveCount = visibleProducts.filter((product) => product.status === 'live').length;
  const pipelineHref = `/${resolvedLocale}/pipeline`;
  const contactHref = `/${resolvedLocale}/contact`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createJsonLd(organizationSchema) }} />

      {/* 1. Hero — the logo's world: navy field, blueprint grid, the mark
          turning at the centre of its orbit. Statement left, system right. */}
      <Section spacing="lg" className="relative -mt-24 flex min-h-[92dvh] items-center overflow-hidden pt-36">
        <div aria-hidden="true" className="bg-idion-grid pointer-events-none absolute inset-0" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_75%_45%,hsl(var(--color-brand)/0.10),transparent_70%)]"
        />
        <Container size="hero" className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
            <FadeUp>
              <Stack gap="xl">
                <div className="flex items-center gap-3 font-mono text-caption uppercase tracking-[0.28em] text-brand">
                  <span aria-hidden="true" className="h-px w-8 bg-brand" />
                  {t('hero.eyebrow')}
                </div>
                <Display level="xl" className="max-w-[16ch] text-balance font-light tracking-[-0.035em]">
                  {t('hero.title')}
                </Display>
                <Body className="max-w-xl text-[1.125rem] leading-relaxed text-text-secondary md:text-[1.25rem]">{t('hero.description')}</Body>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button size="lg" className="px-7" asChild>
                    <Link href={pipelineHref}>
                      {t('hero.primaryCta')}
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="secondary" className="px-7" asChild>
                    <a href="#portfolio">{t('hero.secondaryCta')}</a>
                  </Button>
                </div>
                <StatStrip
                  className="mt-6 max-w-xl"
                  stats={[
                    { value: visibleProducts.length, label: t('stats.products') },
                    { value: liveCount, label: t('stats.live') },
                    { value: PIPELINE_STAGES.length, label: t('stats.stages') }
                  ]}
                />
              </Stack>
            </FadeUp>
            <FadeUp>
              <OrbitField className="mx-auto max-w-[18rem] sm:max-w-[26rem] lg:max-w-[34rem]" />
            </FadeUp>
          </div>
        </Container>
      </Section>

      {/* 2. Thesis — one sentence, set large. */}
      <Section spacing="lg" className="border-t border-border">
        <Container size="content">
          <ScrollReveal>
            <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
              <div className="font-mono text-caption uppercase tracking-[0.2em] text-brand">{t('thesis.eyebrow')}</div>
              <Stack gap="lg">
                <p className="max-w-[26ch] font-display text-display-m font-light leading-[1.12] tracking-[-0.025em] text-text-primary">{t('thesis.title')}</p>
                <Body size="large" className="max-w-reading text-text-secondary">
                  {t('thesis.body')}
                </Body>
              </Stack>
            </div>
          </ScrollReveal>
        </Container>
      </Section>

      {/* 3. The pipeline — the system, stage by stage, closed into a loop. */}
      <Section spacing="lg" id="pipeline" className="scroll-mt-24 border-t border-border">
        <Container size="hero">
          <ScrollReveal>
            <Stack gap="xl">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <SectionHeading eyebrow={t('pipeline.eyebrow')} title={t('pipeline.title')} description={t('pipeline.description')} />
                <Link
                  href={pipelineHref}
                  className="group inline-flex shrink-0 items-center gap-2 text-body-small font-medium text-text-primary underline-offset-8 hover:underline"
                >
                  {t('pipeline.cta')}
                  <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
              <PipelineDiagram
                loopLabel={t('pipeline.loop')}
                stages={PIPELINE_STAGES.map((key) => ({
                  key,
                  title: t(`pipeline.stages.${key}.title`),
                  description: t(`pipeline.stages.${key}.description`),
                  agents: t(`pipeline.stages.${key}.agents`)
                }))}
              />
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* 4. Defensibility */}
      <Section spacing="lg" className="border-t border-border bg-background-muted">
        <Container size="content">
          <ScrollReveal>
            <Stack gap="xl">
              <SectionHeading eyebrow={t('moat.eyebrow')} title={t('moat.title')} description={t('moat.description')} />
              <Grid cols={2} gap="md">
                {MOAT_POINTS.map((key, index) => (
                  <FeatureCard
                    key={key}
                    index={String(index + 1).padStart(2, '0')}
                    title={t(`moat.points.${key}.title`)}
                    description={t(`moat.points.${key}.description`)}
                    className="p-6 md:p-8"
                  />
                ))}
              </Grid>
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* 5. Portfolio */}
      <Section spacing="lg" id="portfolio" className="scroll-mt-24 border-t border-border">
        <Container size="content">
          <ScrollReveal>
            <Stack gap="xl">
              <SectionHeading eyebrow={t('products.eyebrow')} title={t('products.title')} description={t('products.description')} />
              <ProductCardGrid products={visibleProducts} statusLabels={statusLabels} />
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* 6. Two audiences: the people this page is really for. */}
      <Section spacing="md" className="border-t border-border">
        <Container size="content">
          <ScrollReveal>
            <Stack gap="xl">
              <div className="font-mono text-caption uppercase tracking-[0.2em] text-brand">{t('audiences.eyebrow')}</div>
              <div className="grid gap-4 md:grid-cols-2">
                {AUDIENCES.map((key) => (
                  <div key={key} className="flex flex-col rounded-xl border border-border bg-surface p-8 md:p-10">
                    <div className="font-mono text-caption uppercase tracking-[0.2em] text-text-tertiary">{t(`audiences.${key}.label`)}</div>
                    <Heading level={3} className="mt-4 font-normal">
                      {t(`audiences.${key}.title`)}
                    </Heading>
                    <Body className="mt-3 text-text-secondary">{t(`audiences.${key}.body`)}</Body>
                    <div className="mt-8">
                      <Button variant={key === 'investors' ? 'primary' : 'secondary'} asChild>
                        <Link href={contactHref}>
                          {t(`audiences.${key}.cta`)}
                          <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* 7. Call To Action */}
      <GlobalCTA
        title={t('cta.title')}
        description={t('cta.description')}
        primary={{ label: t('cta.primary'), href: pipelineHref }}
        secondary={{ label: t('cta.secondary'), href: `/${resolvedLocale}/products` }}
      />

      {/* 8. Footer is rendered globally by the locale layout */}
    </>
  );
}
