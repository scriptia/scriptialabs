import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/primitives';
import { Body, Display, Heading } from '@/components/typography';
import { Container, Grid, Section, Stack } from '@/components/surfaces';
import { Accordion, SectionHeading } from '@/components/display';
import { FeatureCard } from '@/components/data';
import { FadeUp, ScrollReveal } from '@/components/motion';
import { GlobalCTA } from '@/components/layout';
import { IdionMark } from '@/components/media';
import { PipelineDiagram } from '@/components/idion';
import { type Locale } from '@/lib/i18n/routing';
import { canonicalRoutes } from '@/lib/routing/routes';
import { buildMetadata } from '@/lib/seo';

// The deep dive behind the homepage's pipeline section, written for investors
// and alumni: what each stage takes in, which agents run it, what it hands
// on, and where a person signs off. A static route, so it resolves ahead of
// the flat `[slug]` namespace (and `/pipeline` is reserved from product slugs
// via canonicalRoutes — see server/pipeline/descriptor.ts).
type PageProps = Readonly<{ params: Promise<{ locale: string }> }>;

export const revalidate = 3600;

const STAGES = ['conceive', 'build', 'deploy', 'scale'] as const;
const STAGE_FIELDS = ['input', 'agents', 'output', 'human'] as const;
const MOAT_POINTS = ['data', 'system', 'cost', 'speed'] as const;
const FAQ_ITEMS = ['autonomy', 'quality', 'stores', 'focus'] as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'pipeline' });
  return buildMetadata({
    locale: locale as Locale,
    title: t('meta.title'),
    description: t('meta.description'),
    path: canonicalRoutes.pipeline
  });
}

export default async function PipelinePage({ params }: PageProps) {
  const { locale } = await params;
  const resolvedLocale = locale as Locale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'pipeline' });
  const tHome = await getTranslations({ locale: resolvedLocale, namespace: 'homepage' });

  const contactHref = `/${resolvedLocale}/contact`;
  const portfolioHref = `/${resolvedLocale}#portfolio`;

  return (
    <>
      {/* Hero */}
      <Section spacing="lg" className="relative -mt-24 overflow-hidden pb-16 pt-40">
        <div aria-hidden="true" className="bg-idion-grid pointer-events-none absolute inset-0" />
        <IdionMark
          aria-hidden="true"
          animated
          weight="fine"
          showCore={false}
          className="pointer-events-none absolute -right-40 top-10 h-[36rem] w-[36rem] text-orbit/[0.08] md:-right-24"
        />
        <Container size="content" className="relative">
          <FadeUp>
            <Stack gap="lg">
              <div className="flex items-center gap-3 font-mono text-caption uppercase tracking-[0.28em] text-brand">
                <span aria-hidden="true" className="h-px w-8 bg-brand" />
                {t('hero.eyebrow')}
              </div>
              <Display level="l" className="max-w-[18ch] text-balance font-light">
                {t('hero.title')}
              </Display>
              <Body className="max-w-2xl text-[1.125rem] leading-relaxed text-text-secondary md:text-[1.25rem]">{t('hero.description')}</Body>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button size="lg" className="px-7" asChild>
                  <Link href={contactHref}>
                    {t('hero.primaryCta')}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" className="px-7" asChild>
                  <Link href={portfolioHref}>{t('hero.secondaryCta')}</Link>
                </Button>
              </div>
            </Stack>
          </FadeUp>
        </Container>
      </Section>

      {/* Overview diagram — same component as the homepage. */}
      <Section spacing="md" className="border-t border-border">
        <Container size="hero">
          <ScrollReveal>
            <Stack gap="xl">
              <SectionHeading eyebrow={t('overview.eyebrow')} title={t('overview.title')} />
              <PipelineDiagram
                loopLabel={tHome('pipeline.loop')}
                stages={STAGES.map((key) => ({ key, title: t(`stages.${key}.title`), description: t(`stages.${key}.summary`) }))}
              />
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      {/* Stage-by-stage: a spec sheet per stage. */}
      <Section spacing="md" className="border-t border-border">
        <Container size="content">
          <div className="grid gap-6">
            {STAGES.map((key, index) => (
              <ScrollReveal key={key}>
                <article id={key} className="scroll-mt-28 rounded-xl border border-border bg-surface p-6 md:p-10">
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
                    <Stack gap="sm">
                      <div className="font-mono text-caption uppercase tracking-[0.2em] text-brand">{String(index + 1).padStart(2, '0')}</div>
                      <Heading level={2} className="font-normal">
                        {t(`stages.${key}.title`)}
                      </Heading>
                      <Body className="text-text-secondary">{t(`stages.${key}.summary`)}</Body>
                    </Stack>
                    <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                      {STAGE_FIELDS.map((field) => (
                        <div key={field} className={field === 'human' ? 'bg-brand-subtle p-5' : 'bg-surface p-5'}>
                          <dt className={`font-mono text-[0.6875rem] uppercase tracking-[0.2em] ${field === 'human' ? 'text-brand' : 'text-text-tertiary'}`}>{t(`labels.${field}`)}</dt>
                          <dd className="mt-2 text-body-small leading-[1.6] text-text-primary">{t(`stages.${key}.${field}`)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Humans in the loop + the feedback loop, side by side. */}
      <Section spacing="lg" className="border-t border-border bg-background-muted">
        <Container size="content">
          <ScrollReveal>
            <div className="grid gap-12 md:grid-cols-2">
              {(['humans', 'loop'] as const).map((key) => (
                <Stack key={key} gap="md">
                  <div className="font-mono text-caption uppercase tracking-[0.2em] text-brand">{t(`${key}.eyebrow`)}</div>
                  <Heading level={2} className="font-normal">
                    {t(`${key}.title`)}
                  </Heading>
                  <Body className="text-text-secondary">{t(`${key}.body`)}</Body>
                </Stack>
              ))}
            </div>
          </ScrollReveal>
        </Container>
      </Section>

      {/* Why it compounds */}
      <Section spacing="lg" className="border-t border-border">
        <Container size="content">
          <ScrollReveal>
            <Stack gap="xl">
              <SectionHeading eyebrow={t('moat.eyebrow')} title={t('moat.title')} />
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

      {/* Investor FAQ */}
      <Section spacing="md" className="border-t border-border">
        <Container size="content">
          <ScrollReveal>
            <Stack gap="xl">
              <SectionHeading title={t('faq.title')} />
              <Accordion items={FAQ_ITEMS.map((key) => ({ title: t(`faq.items.${key}.question`), content: t(`faq.items.${key}.answer`) }))} />
            </Stack>
          </ScrollReveal>
        </Container>
      </Section>

      <GlobalCTA
        title={t('cta.title')}
        description={t('cta.description')}
        primary={{ label: t('cta.primary'), href: contactHref }}
        secondary={{ label: t('cta.secondary'), href: portfolioHref }}
      />
    </>
  );
}
