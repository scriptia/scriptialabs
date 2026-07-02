'use client';

import * as React from 'react';
import { useLocale, useRouter, useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button } from '@/components/primitives';
import { CenteredLayout, EmptyStateLayout, LoadingState } from './layout';

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
