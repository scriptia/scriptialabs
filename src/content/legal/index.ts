export type LegalDocumentKey = 'privacy' | 'terms' | 'cookies';

export const legalDocuments = {
  privacy: {
    slug: 'privacy',
    titleKey: 'legal.privacy.title',
    descriptionKey: 'legal.privacy.description'
  },
  terms: {
    slug: 'terms',
    titleKey: 'legal.terms.title',
    descriptionKey: 'legal.terms.description'
  },
  cookies: {
    slug: 'cookies',
    titleKey: 'legal.cookies.title',
    descriptionKey: 'legal.cookies.description'
  }
} as const;
