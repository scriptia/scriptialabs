import * as React from 'react';

import { cn } from '@/lib/utils';

// The official store badges. Both stores' brand guidelines require their own
// artwork, unmodified, so these are images rather than styled buttons:
//
// - App Store: Apple's badge service, the embed its Marketing Tools hand out.
//   Served per locale, so the badge reads "Descárgalo en el App Store" on /es.
// - Google Play: Google's generic badge PNGs, vendored in public/badges/ and
//   cropped to the badge itself (the originals carry uneven transparent padding
//   that differs per locale, which made the two badges impossible to align).
//
// Both render at the same height, so one badge alone or two side by side read
// as a deliberate pair rather than two unrelated images.

type BadgeLocale = 'en' | 'es' | 'ca';

const appleLocale: Record<BadgeLocale, string> = { en: 'en-us', es: 'es-es', ca: 'ca-es' };

export type StoreBadgesProps = Readonly<{
  locale: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
  labels: { appStore: string; googlePlay: string };
  /** `lg` in the hero, `md` in the closing call to action. */
  size?: 'md' | 'lg';
  className?: string;
}>;

export function StoreBadges({ locale, appStoreUrl, playStoreUrl, labels, size = 'lg', className }: StoreBadgesProps) {
  if (!appStoreUrl && !playStoreUrl) return null;

  const badgeLocale: BadgeLocale = locale === 'es' || locale === 'ca' ? locale : 'en';
  // Apple's minimum on-screen height is 40px; 48/44 keep it comfortably above.
  const height = size === 'lg' ? 'h-12' : 'h-11';

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {appStoreUrl ? (
        <a href={appStoreUrl} target="_blank" rel="noreferrer" className="rounded-[0.6rem] transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://tools.applemarketingtools.com/api/badges/download-on-the-app-store/black/${appleLocale[badgeLocale]}`}
            alt={labels.appStore}
            className={cn(height, 'w-auto')}
            height={48}
          />
        </a>
      ) : null}
      {playStoreUrl ? (
        <a href={playStoreUrl} target="_blank" rel="noreferrer" className="rounded-[0.6rem] transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/badges/google-play-${badgeLocale}.png`} alt={labels.googlePlay} className={cn(height, 'w-auto')} height={48} />
        </a>
      ) : null}
    </div>
  );
}
