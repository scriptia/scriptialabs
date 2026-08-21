import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';

import { RouteNotFoundState } from '@/components/layout/route-states';
import { buildMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/lib/i18n/routing';

// `not-found.tsx` is not a page: Next renders it as a boundary and passes it NO
// props, so there is no `params` here — not even a promise of one. An earlier
// version destructured `{ locale }` out of it anyway, which threw
// (`Cannot destructure property 'locale' of 'undefined'`), and a throw inside
// metadata generation makes Next serve this page with a **200** instead of a
// 404. That is the soft 404 the comment here used to claim was fixed: every
// unmatched route under /{locale} answered 200 with a 145 KB body and the
// generic "Scriptia Labs" title. product-agent's deploy_legal.py has a
// GENERIC_TITLES probe written specifically to survive it.
//
// The locale comes from next-intl's request scope instead, which is populated
// by the middleware for every route this boundary can render under.
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;

  return buildMetadata({ locale, noindex: true });
}

export default function NotFound() {
  return <RouteNotFoundState />;
}
