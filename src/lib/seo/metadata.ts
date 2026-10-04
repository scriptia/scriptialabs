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
  /** Numeric App Store id. Adds the Smart App Banner iOS Safari shows above the page. */
  appStoreId?: string;
  /**
   * hreflang alternates as locale -> path, when a page does NOT exist in every
   * locale (articles, ADR-014). Defaults to the same path in all locales.
   */
  languages?: Partial<Record<Locale, string>>;
  /** OpenGraph `article` with its dates, for article pages. ISO timestamps. */
  article?: { publishedTime: string; modifiedTime: string };
};

export function buildMetadata({ locale, title, description, path = '/', noindex = false, appStoreId, languages, article }: MetadataInput): Metadata {
  const canonical = buildCanonicalPath(locale, path);
  const resolvedTitle = title ?? contentSite.name;
  const resolvedDescription = description ?? contentSite.description;

  return {
    metadataBase: new URL(contentSite.url),
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical,
      languages: languages
        ? Object.fromEntries(Object.entries(languages).map(([alternate, alternatePath]) => [alternate, buildCanonicalPath(alternate as Locale, alternatePath)]))
        : buildLanguageAlternates(path)
    },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url: canonical,
      siteName: contentSite.name,
      locale,
      ...(article ? { type: 'article', publishedTime: article.publishedTime, modifiedTime: article.modifiedTime } : { type: 'website' })
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: resolvedDescription
    },
    robots: buildRobots({ index: !noindex, follow: !noindex }),
    ...(appStoreId ? { itunes: { appId: appStoreId } } : {})
  };
}
