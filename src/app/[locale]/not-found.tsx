import type { Metadata } from 'next';

import { RouteNotFoundState } from '@/components/layout/route-states';
import { buildMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/lib/i18n/routing';

export function generateMetadata({ params }: Readonly<{ params: { locale: Locale } }>): Metadata {
  return buildMetadata({ locale: params.locale, noindex: true });
}

export default function NotFound() {
  return <RouteNotFoundState />;
}
