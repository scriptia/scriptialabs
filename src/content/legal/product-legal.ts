import type { ProductRecord } from '@/content/products';

export type ProductLegalDocumentKey = 'privacy' | 'terms' | 'cookies' | 'aiPolicy' | 'contact' | 'dataDeletion' | 'acceptableUse';

export type ProductLegalDocument = {
  slug: string;
  lastUpdated: string;
  // Section ids only — titles/bodies live in
  // `productLegal.<productId>.<key>.sections.<id>.{title,body}`.
  sections: string[];
};

// Keyed by product id, then document key. Only populated for products that
// have shipped their own legal documentation — see ADR-009 for why this
// replaced the single company-wide set, and docs/roadmap.md for which
// products still fall back to the company-wide pages under `legalDocuments`.
export const productLegalDocuments: Partial<Record<ProductRecord['id'], Record<ProductLegalDocumentKey, ProductLegalDocument>>> = {
  padelco: {
    privacy: {
      slug: 'privacy',
      lastUpdated: '2026-07-08',
      sections: [
        'introduction',
        'informationWeCollect',
        'doNotCollect',
        'cameraPermission',
        'photoLibraryPermission',
        'howWeUseInformation',
        'thirdPartyServices',
        'aiGeneratedInsights',
        'automatedDecisionMaking',
        'security',
        'dataRetention',
        'internationalTransfers',
        'userRights',
        'childrensPrivacy',
        'changes',
        'contact'
      ]
    },
    terms: {
      slug: 'terms',
      lastUpdated: '2026-07-08',
      sections: [
        'eligibility',
        'accounts',
        'acceptableUse',
        'userContent',
        'feedback',
        'aiGeneratedInsights',
        'intellectualProperty',
        'availability',
        'serviceModifications',
        'thirdPartyLinks',
        'termination',
        'disclaimers',
        'limitationOfLiability',
        'disputeResolution',
        'governingLaw',
        'exportCompliance',
        'appStoreTerms'
      ]
    },
    cookies: {
      slug: 'cookies',
      lastUpdated: '2026-07-08',
      sections: ['mobileAppAndCookies', 'similarTechnologies', 'websiteCookies', 'noAdvertisingCookies', 'management', 'futureUpdates']
    },
    aiPolicy: {
      slug: 'ai-policy',
      lastUpdated: '2026-07-08',
      sections: [
        'howAiIsUsed',
        'informationalOnly',
        'humanResponsibility',
        'automatedDecisionMaking',
        'limitations',
        'continuousImprovement',
        'privacyConsiderations',
        'noExaggeratedClaims'
      ]
    },
    contact: {
      slug: 'contact',
      lastUpdated: '2026-07-08',
      sections: ['support', 'privacy', 'security', 'business', 'legal', 'responseTime', 'languages']
    },
    dataDeletion: {
      slug: 'data-deletion',
      lastUpdated: '2026-07-08',
      sections: ['howToRequest', 'whatIsDeleted', 'accountVsPartialDeletion', 'whatMayBeRetained', 'responseProcess', 'futureInAppDeletion']
    },
    acceptableUse: {
      slug: 'acceptable-use',
      lastUpdated: '2026-07-08',
      sections: ['prohibitedBehaviour', 'impersonation', 'abuseAndFraud', 'reverseEngineering', 'automatedMisuse', 'illegalContent', 'accountSharing', 'reportingViolations']
    }
  },
  speaklio: {
    privacy: {
      slug: 'privacy',
      lastUpdated: '2026-07-09',
      sections: [
        'introduction',
        'informationWeCollect',
        'doNotCollect',
        'microphonePermission',
        'audioAndTranscripts',
        'howWeUseInformation',
        'aiProcessing',
        'subscriptionsAndPayments',
        'thirdPartyServices',
        'automatedDecisionMaking',
        'security',
        'dataRetention',
        'internationalTransfers',
        'userRights',
        'childrensPrivacy',
        'changes',
        'contact'
      ]
    },
    terms: {
      slug: 'terms',
      lastUpdated: '2026-07-09',
      sections: [
        'eligibility',
        'accounts',
        'acceptableUse',
        'userContent',
        'feedback',
        'aiGeneratedInsights',
        'subscriptions',
        'intellectualProperty',
        'availability',
        'serviceModifications',
        'thirdPartyLinks',
        'termination',
        'disclaimers',
        'limitationOfLiability',
        'disputeResolution',
        'governingLaw',
        'exportCompliance',
        'appStoreTerms'
      ]
    },
    cookies: {
      slug: 'cookies',
      lastUpdated: '2026-07-09',
      sections: ['mobileAppAndCookies', 'similarTechnologies', 'websiteCookies', 'noAdvertisingCookies', 'management', 'futureUpdates']
    },
    aiPolicy: {
      slug: 'ai-policy',
      lastUpdated: '2026-07-09',
      sections: [
        'howAiIsUsed',
        'informationalOnly',
        'humanResponsibility',
        'audioProcessing',
        'automatedDecisionMaking',
        'limitations',
        'continuousImprovement',
        'privacyConsiderations',
        'noExaggeratedClaims'
      ]
    },
    contact: {
      slug: 'contact',
      lastUpdated: '2026-07-09',
      sections: ['support', 'privacy', 'security', 'business', 'legal', 'responseTime', 'languages']
    },
    dataDeletion: {
      slug: 'data-deletion',
      lastUpdated: '2026-07-09',
      sections: ['howToRequest', 'whatIsDeleted', 'accountVsPartialDeletion', 'whatMayBeRetained', 'responseProcess', 'futureInAppDeletion']
    },
    acceptableUse: {
      slug: 'acceptable-use',
      lastUpdated: '2026-07-09',
      sections: ['prohibitedBehaviour', 'impersonation', 'abuseAndFraud', 'reverseEngineering', 'automatedMisuse', 'illegalContent', 'accountSharing', 'reportingViolations']
    }
  }
};

export function getProductLegalEntry(productId: ProductRecord['id'], slug: string) {
  const documents = productLegalDocuments[productId];
  if (!documents) return undefined;

  const entry = (Object.entries(documents) as Array<[ProductLegalDocumentKey, ProductLegalDocument]>).find(([, document]) => document.slug === slug);
  return entry ? { key: entry[0], document: entry[1] } : undefined;
}
