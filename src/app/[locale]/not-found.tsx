import type { Metadata } from 'next';

import { RouteNotFoundState } from '@/components/layout/route-states';
import { buildMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/lib/i18n/routing';

// `params` is a promise in Next 15. Reading it synchronously threw inside
// metadata generation, and a throw there made Next serve the not-found page
// with a 200 — a soft 404 on every unmatched locale route.
export async function generateMetadata({ params }: Readonly<{ params: Promise<{ locale: Locale }> }>): Promise<Metadata> {
  const { locale } = await params;

  return buildMetadata({ locale, noindex: true });
}

export default function NotFound() {
  return <RouteNotFoundState />;
}
