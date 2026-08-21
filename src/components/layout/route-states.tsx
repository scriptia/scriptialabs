'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button } from '@/components/primitives';
import { useRouter } from '@/lib/i18n/routing';
import { CenteredLayout, EmptyStateLayout, LoadingState } from './layout';

// Currently unreferenced, and deliberately so. This used to be rendered by
// `src/app/loading.tsx` and `src/app/[locale]/loading.tsx`, which were deleted:
// a route-level loading.tsx wraps that whole subtree in a Suspense boundary, so
// Next flushes the HTML shell — committing HTTP 200 — before the page body runs
// and calls notFound(). The result was that EVERY unmatched route answered 200
// with a 145 KB body and the generic "Scriptia Labs" title instead of a 404.
// product-agent's deploy_legal.py carries a GENERIC_TITLES probe written
// specifically to survive that, because a legal URL that soft-404s is an App
// Store rejection.
//
// Do not reintroduce a route-level loading.tsx above any route that can 404.
// The correct pattern is an explicit <Suspense> INSIDE the page, placed after
// the existence check, so the status is settled before anything streams.
export function RouteLoadingState() {
  const t = useTranslations('common');

  return <LoadingState title={t('loading')} description={t('loading')} />;
}

export function RouteErrorState() {
  const t = useTranslations('common');
  const nav = useTranslations('navigation');
  const router = useRouter();
  const locale = useLocale();

  return (
    <CenteredLayout>
      <div className="grid gap-4">
        <h1 className="text-h1 font-medium text-text-primary">{t('errorTitle')}</h1>
        <p className="max-w-reading text-body text-text-secondary">{t('errorDescription')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => router.refresh()}>
            {t('continue')}
          </Button>
          <Button variant="secondary" asChild>
            <Link href={`/${locale}`}>{nav('home')}</Link>
          </Button>
        </div>
      </div>
    </CenteredLayout>
  );
}

export function RouteNotFoundState() {
  const t = useTranslations('common');
  const nav = useTranslations('navigation');
  const locale = useLocale();

  return (
    <EmptyStateLayout
      title={t('notFoundTitle')}
      description={t('notFoundDescription')}
      primaryAction={{ label: nav('home'), href: `/${locale}` }}
      secondaryAction={{ label: nav('contact'), href: `/${locale}/contact` }}
    />
  );
}
