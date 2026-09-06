import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert } from '@/components/feedback';
import { Badge } from '@/components/primitives';
import { Grid, Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { routing } from '@/lib/i18n/routing';
import { requireUser } from '@/server/auth/guard';
import { getProductArtifactsBySlug, getProductBySlugForPanel } from '@/server/queries/products';

import { formatRelative } from '../../_components/format';
import { ProductArtifacts } from '../../_components/product-artifacts';
import { RevalidateAllButton } from '../revalidate-all-button';
import { PublishControls } from './publish-controls';

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <p className="text-caption uppercase tracking-[0.08em] text-text-tertiary">{label}</p>
      <p className="mt-0.5 text-body-small text-text-primary">{children}</p>
    </div>
  );
}

/** One string in all three locales, so a missing translation is visible at a glance. */
function Localized({ label, value }: Readonly<{ label: string; value: Record<string, string> | null | undefined }>) {
  return (
    <div>
      <p className="text-caption uppercase tracking-[0.08em] text-text-tertiary">{label}</p>
      <dl className="mt-1 space-y-1">
        {routing.locales.map((locale) => (
          <div key={locale} className="flex gap-2 text-body-small">
            <dt className="w-6 shrink-0 font-mono text-caption text-text-tertiary">{locale}</dt>
            <dd className={value?.[locale] ? 'text-text-primary' : 'text-error'}>{value?.[locale] ?? '— missing —'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function ProductDetailPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  await requireUser();

  const { slug } = await params;
  const [result, artifacts] = await Promise.all([getProductBySlugForPanel(slug), getProductArtifactsBySlug(slug)]);

  if (!result) {
    notFound();
  }

  const { product, features, legal } = result;

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level={1}>/{product.slug}</Heading>
            {product.publishedAt ? <Badge tone="success">Live</Badge> : <Badge tone="warning">Unpublished</Badge>}
            {product.indexable ? <Badge tone="brand">In sitemap</Badge> : null}
          </div>
          <Body size="small" className="mt-1">
            {product.status} · updated {formatRelative(product.updatedAt)}
            {product.sourceExternalRunId ? ` · run ${product.sourceExternalRunId}` : ''}
          </Body>
        </div>
        <RevalidateAllButton slug={product.slug} />
      </div>

      <Surface className="p-5">
        <PublishControls id={product.id} slug={product.slug} status={product.status} published={Boolean(product.publishedAt)} indexable={product.indexable} />
      </Surface>

      {!product.publishedAt ? (
        <Alert tone="warning" title="Not on the public site">
          This product 404s and appears in no listing, nav menu or sitemap. Press Publish to put it back.
        </Alert>
      ) : null}

      <Surface className="p-5">
        <Grid cols={2} gap="lg">
          <Localized label="Name" value={product.name} />
          <Localized label="Tagline (navbar)" value={product.tagline} />
          <Localized label="Card description (homepage, /products)" value={product.cardDescription} />
          <Localized label="Hero title" value={product.heroTitle} />
          <Localized label="Hero description" value={product.heroDescription} />
          <Localized label="SEO title" value={product.seoTitle} />
          <Localized label="SEO description" value={product.seoDescription} />
          <div>
            <Field label="Accent">{product.accent}</Field>
            <Field label="Live URL">{product.liveUrl ?? '—'}</Field>
            <Field label="Page copy">{product.pageCopy ? 'present' : 'none — the reduced template renders'}</Field>
          </div>
        </Grid>
      </Surface>

      <Stack gap="sm">
        <Heading level={3}>Features ({features.length})</Heading>
        {features.length === 0 ? (
          <Body size="small" className="text-text-tertiary">
            None. The capabilities section will not render.
          </Body>
        ) : (
          <Surface className="p-5">
            <Stack gap="md">
              {features.map((feature) => (
                <div key={feature.id}>
                  <p className="font-mono text-caption text-text-tertiary">{feature.key}</p>
                  <Localized label="Title" value={feature.title} />
                </div>
              ))}
            </Stack>
          </Surface>
        )}
      </Stack>

      <Stack gap="sm">
        <Heading level={3}>Legal documents ({legal.length})</Heading>
        {legal.length === 0 ? (
          <Alert tone="warning">
            No legal documents. The product page shows no legal links, and an App Store submission will fail its privacy-URL check.
          </Alert>
        ) : (
          <Surface className="p-5">
            <Stack gap="xs">
              {legal.map((document) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                  <span className="text-body-small text-text-primary">
                    {document.docKey} <span className="text-text-tertiary">· updated {document.lastUpdated}</span>
                  </span>
                  <span className="flex gap-3">
                    {routing.locales.map((locale) => (
                      <a
                        key={locale}
                        href={`/${locale}/${product.slug}/legal/${document.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-caption text-brand hover:underline"
                      >
                        {locale}
                      </a>
                    ))}
                  </span>
                </div>
              ))}
            </Stack>
          </Surface>
        )}
      </Stack>

      {/* Assets and source documents share a component with the bet page's
          Product tab — the same artifacts, reached from the other direction. */}
      <ProductArtifacts slug={product.slug} assets={artifacts?.assets ?? []} documents={artifacts?.documents ?? []} />

      <div>
        <Link href="/internal/products" className="text-body-small text-text-secondary hover:underline">
          ← All products
        </Link>
      </div>
    </Stack>
  );
}
