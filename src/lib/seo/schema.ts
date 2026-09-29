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
