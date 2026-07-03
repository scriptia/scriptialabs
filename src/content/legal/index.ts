export type LegalDocumentKey = 'privacy' | 'terms' | 'cookies' | 'security' | 'aiPolicy';

export type LegalDocument = {
  slug: string;
  titleKey: string;
  descriptionKey: string;
  // ISO date, not translated — legal documents share one "last updated" fact
  // across locales rather than being independently dated per language.
  lastUpdated: string;
  // Section ids, in display order. Each id resolves to
  // `legal.<document>.sections.<id>.title` and `.body` (an array of
  // paragraphs) in the message files — the registry only owns structure.
  sections: string[];
};

export const legalDocuments: Record<LegalDocumentKey, LegalDocument> = {
  privacy: {
    slug: 'privacy',
    titleKey: 'legal.privacy.title',
    descriptionKey: 'legal.privacy.description',
    lastUpdated: '2026-07-03',
    sections: [
      'introduction',
      'personalInformation',
      'usageInformation',
      'cookies',
      'analytics',
      'logData',
      'security',
      'dataRetention',
      'thirdPartyServices',
      'internationalTransfers',
      'userRights',
      'futureProducts',
      'changes',
      'contact'
    ]
  },
  terms: {
    slug: 'terms',
    titleKey: 'legal.terms.title',
    descriptionKey: 'legal.terms.description',
    lastUpdated: '2026-07-03',
    sections: [
      'acceptance',
      'accounts',
      'intellectualProperty',
      'productAvailability',
      'subscriptions',
      'acceptableUse',
      'limitationOfLiability',
      'termination',
      'changes',
      'governingLaw'
    ]
  },
  cookies: {
    slug: 'cookies',
    titleKey: 'legal.cookies.title',
    descriptionKey: 'legal.cookies.description',
    lastUpdated: '2026-07-03',
    sections: [
      'whatAreCookies',
      'necessaryCookies',
      'analyticsCookies',
      'functionalCookies',
      'futureMarketingCookies',
      'managingCookies',
      'browserControls',
      'futureConsentManagement'
    ]
  },
  security: {
    slug: 'security',
    titleKey: 'legal.security.title',
    descriptionKey: 'legal.security.description',
    lastUpdated: '2026-07-03',
    sections: ['philosophy', 'dataProtection', 'encryption', 'responsibleDisclosure', 'securityUpdates', 'incidentResponse', 'futureVulnerabilityReporting']
  },
  aiPolicy: {
    slug: 'ai-policy',
    titleKey: 'legal.aiPolicy.title',
    descriptionKey: 'legal.aiPolicy.description',
    lastUpdated: '2026-07-03',
    sections: ['humanOversight', 'transparency', 'responsibleUse', 'limitations', 'bias', 'privacy', 'continuousImprovement', 'futureModels']
  }
};

export function getLegalDocumentEntryBySlug(slug: string) {
  const entry = (Object.entries(legalDocuments) as Array<[LegalDocumentKey, LegalDocument]>).find(([, document]) => document.slug === slug);
  return entry ? { key: entry[0], document: entry[1] } : undefined;
}
