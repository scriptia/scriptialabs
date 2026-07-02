import type { Metadata } from 'next';

import { contentSite } from '@/content/site';
import { type Locale } from '@/lib/i18n/routing';
import { buildCanonicalPath, buildLanguageAlternates } from './canonical';
import { buildRobots } from './robots';

export type MetadataInput = {
  locale: Locale;
  title?: string;
  description?: string;
  path?: string;
  noindex?: boolean;
};

export function buildMetadata({ locale, title, description, path = '/', noindex = false }: MetadataInput): Metadata {
  const canonical = buildCanonicalPath(locale, path);
  const resolvedTitle = title ?? contentSite.name;
  const resolvedDescription = description ?? contentSite.description;

  return {
    metadataBase: new URL(contentSite.url),
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical,
      languages: buildLanguageAlternates(path)
    },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url: canonical,
      siteName: contentSite.name,
      locale,
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: resolvedDescription
    },
    robots: buildRobots({ index: !noindex, follow: !noindex })
  };
}
