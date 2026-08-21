import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Container } from '@/components/surfaces';
import { Link as LocaleLink, type Locale } from '@/lib/i18n/routing';
import { productThemeClassName } from '@/design/theme';
import { buildMetadata } from '@/lib/seo';
import { getProductPage } from '@/server/content/products';

// The brand system is a fully self-styled document served statically from
// /scriptia-brand.html. It's rendered in an <iframe> so its global CSS stays
// isolated from the app. Only Scriptia has one today — see the multi-brand
// model in the design docs.
type PageProps = Readonly<{ params: Promise<{ locale: string; slug: string }> }>;

const BRAND_SLUG = 'scriptia';

export function generateStaticParams() {
  return [{ slug: BRAND_SLUG }];
}

// Scriptia-only, so the param space is closed and anything else must 404 rather
// than render a themed shell around a missing iframe.
export const dynamicParams = false;
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = locale as Locale;

  if (slug !== BRAND_SLUG) return buildMetadata({ locale: resolvedLocale, noindex: true });

  const product = await getProductPage(resolvedLocale, BRAND_SLUG);
  if (!product) return buildMetadata({ locale: resolvedLocale, noindex: true });

  const label = product.page.brandCta ?? 'Brand';

  return buildMetadata({
    locale: resolvedLocale,
    title: `${product.name} — ${label}`,
    description: product.seoDescription,
    path: `/${BRAND_SLUG}/brand`,
    noindex: true
  });
}

export default async function BrandPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const resolvedLocale = locale as Locale;

  if (slug !== BRAND_SLUG) notFound();

  const product = await getProductPage(resolvedLocale, BRAND_SLUG);
  if (!product) notFound();

  // Falls back rather than blocking: a machine-published product has no brand
  // copy, and this page existing at all is a Scriptia-only affordance.
  const label = product.page.brandCta ?? 'Brand';

  return (
    <div className={`${productThemeClassName.scriptia} flex min-h-[70dvh] flex-col bg-background text-text-primary`}>
      <Container size="hero">
        <div className="flex items-center justify-between gap-4 py-6">
          <LocaleLink href={product.canonical} className="inline-flex items-center gap-2 text-body-small font-medium text-text-secondary transition-colors hover:text-text-primary">
            <span aria-hidden="true">←</span> {product.name}
          </LocaleLink>
          <div className="text-caption font-medium uppercase tracking-[0.1em] text-text-tertiary">{label}</div>
        </div>
      </Container>
      <iframe src="/scriptia-brand.html" title={`${product.name} — ${label}`} className="min-h-[calc(100dvh-8rem)] w-full flex-1 border-0" />
    </div>
  );
}
