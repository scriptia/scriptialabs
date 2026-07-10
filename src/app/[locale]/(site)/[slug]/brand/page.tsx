import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { Container } from '@/components/surfaces';
import { Link as LocaleLink, type Locale } from '@/lib/i18n/routing';
import { getProductBySlug } from '@/content/products';
import { productThemeClassName } from '@/design/theme';
import { buildMetadata } from '@/lib/seo';

// The brand system is a fully self-styled document served statically from
// /scriptia-brand.html. It's rendered in an <iframe> so its global CSS stays
// isolated from the app. Only Scriptia has one today — see the multi-brand
// model in the design docs.
type PageProps = Readonly<{ params: Promise<{ locale: string; slug: string }> }>;

export function generateStaticParams() {
  return [{ slug: 'scriptia' }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (slug !== 'scriptia') notFound();

  const t = await getTranslations({ locale: locale as Locale, namespace: 'products.scriptia' });
  return buildMetadata({
    locale: locale as Locale,
    title: `${t('name')} — ${t('page.brandCta')}`,
    description: t('seo.description'),
    path: '/scriptia/brand',
    noindex: true
  });
}

export default async function BrandPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (slug !== 'scriptia') notFound();

  const product = getProductBySlug(slug);
  if (!product) notFound();

  const t = await getTranslations({ locale: locale as Locale, namespace: 'products.scriptia' });

  return (
    <div className={`${productThemeClassName.scriptia} flex min-h-[70dvh] flex-col bg-background text-text-primary`}>
      <Container size="hero">
        <div className="flex items-center justify-between gap-4 py-6">
          <LocaleLink
            href={product.links.canonical}
            className="inline-flex items-center gap-2 text-body-small font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <span aria-hidden="true">←</span> {t('name')}
          </LocaleLink>
          <div className="text-caption font-medium uppercase tracking-[0.1em] text-text-tertiary">{t('page.brandCta')}</div>
        </div>
      </Container>
      <iframe
        src="/scriptia-brand.html"
        title={`${t('name')} — ${t('page.brandCta')}`}
        className="min-h-[calc(100dvh-8rem)] w-full flex-1 border-0"
      />
    </div>
  );
}
