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
