export type SchemaObject = Record<string, unknown>;

export function buildOrganizationSchema(input: { name: string; url: string; logo?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.url,
    logo: input.logo
  } satisfies SchemaObject;
}

export function buildSoftwareApplicationSchema(input: {
  name: string;
  description: string;
  url: string;
  operatingSystem?: string;
  applicationCategory?: string;
  publisherName: string;
  publisherUrl: string;
  /** Store listing URLs; emitted as `sameAs` so search engines tie the page to the listing. */
  storeUrls?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: input.name,
    description: input.description,
    url: input.url,
    operatingSystem: input.operatingSystem ?? 'Web',
    applicationCategory: input.applicationCategory ?? 'BusinessApplication',
    publisher: {
      '@type': 'Organization',
      name: input.publisherName,
      url: input.publisherUrl
    },
    ...(input.storeUrls && input.storeUrls.length > 0 ? { sameAs: input.storeUrls } : {})
  } satisfies SchemaObject;
}

export function buildArticleSchema(input: {
  headline: string;
  description: string;
  url: string;
  inLanguage: string;
  datePublished: string;
  dateModified: string;
  wordCount: number;
  publisherName: string;
  publisherUrl: string;
  /** The app the article is about, so answer engines can tie the two together. */
  about: { name: string; url: string };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    url: input.url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
    inLanguage: input.inLanguage,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    wordCount: input.wordCount,
    author: { '@type': 'Organization', name: input.publisherName, url: input.publisherUrl },
    publisher: { '@type': 'Organization', name: input.publisherName, url: input.publisherUrl },
    about: { '@type': 'SoftwareApplication', name: input.about.name, url: input.about.url }
  } satisfies SchemaObject;
}

export function buildFaqPageSchema(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer }
    }))
  } satisfies SchemaObject;
}

export function buildBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url }))
  } satisfies SchemaObject;
}
