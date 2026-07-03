export type ProductStatus = 'draft' | 'teaser' | 'alpha' | 'beta' | 'live' | 'deprecated' | 'archived';

export type ProductRecord = {
  id: 'scriptia' | 'padelco' | 'voice-agents';
  slug: 'scriptia' | 'padelco' | 'voice-agents';
  nameKey: string;
  descriptionKey: string;
  status: ProductStatus;
  accent: 'scriptia' | 'padelco' | 'voice-agents';
  links: {
    canonical: string;
    external?: string;
  };
  hero: {
    titleKey: string;
    descriptionKey: string;
  };
  features: Array<{
    titleKey: string;
    descriptionKey: string;
  }>;
  seo: {
    titleKey: string;
    descriptionKey: string;
    indexable: boolean;
  };
  badges: string[];
  availability: 'public' | 'private' | 'teaser';
  translations: Record<string, string>;
  social: {
    ogImageKey?: string;
  };
  futureFlags: Record<string, boolean>;
};

export const productRegistry: Record<ProductRecord['id'], ProductRecord> = {
  scriptia: {
    id: 'scriptia',
    slug: 'scriptia',
    nameKey: 'products.scriptia.name',
    descriptionKey: 'products.scriptia.description',
    status: 'live',
    accent: 'scriptia',
    links: { canonical: '/scriptia', external: 'https://scriptiastories.com' },
    hero: {
      titleKey: 'products.scriptia.hero.title',
      descriptionKey: 'products.scriptia.hero.description'
    },
    features: [
      { titleKey: 'products.scriptia.features.writing.title', descriptionKey: 'products.scriptia.features.writing.description' },
      { titleKey: 'products.scriptia.features.editorial.title', descriptionKey: 'products.scriptia.features.editorial.description' },
      { titleKey: 'products.scriptia.features.assistant.title', descriptionKey: 'products.scriptia.features.assistant.description' }
    ],
    seo: {
      titleKey: 'products.scriptia.seo.title',
      descriptionKey: 'products.scriptia.seo.description',
      indexable: true
    },
    badges: [],
    availability: 'public',
    translations: {},
    social: {},
    futureFlags: {}
  },
  padelco: {
    id: 'padelco',
    slug: 'padelco',
    nameKey: 'products.padelco.name',
    descriptionKey: 'products.padelco.description',
    status: 'teaser',
    accent: 'padelco',
    links: { canonical: '/padelco' },
    hero: {
      titleKey: 'products.padelco.hero.title',
      descriptionKey: 'products.padelco.hero.description'
    },
    features: [
      { titleKey: 'products.padelco.features.coaching.title', descriptionKey: 'products.padelco.features.coaching.description' },
      { titleKey: 'products.padelco.features.progression.title', descriptionKey: 'products.padelco.features.progression.description' },
      { titleKey: 'products.padelco.features.training.title', descriptionKey: 'products.padelco.features.training.description' }
    ],
    seo: {
      titleKey: 'products.padelco.seo.title',
      descriptionKey: 'products.padelco.seo.description',
      indexable: false
    },
    badges: ['launching-soon'],
    availability: 'teaser',
    translations: {},
    social: {},
    futureFlags: {}
  },
  'voice-agents': {
    id: 'voice-agents',
    slug: 'voice-agents',
    nameKey: 'products.voiceAgents.name',
    descriptionKey: 'products.voiceAgents.description',
    status: 'beta',
    accent: 'voice-agents',
    links: { canonical: '/voice-agents' },
    hero: {
      titleKey: 'products.voiceAgents.hero.title',
      descriptionKey: 'products.voiceAgents.hero.description'
    },
    features: [
      { titleKey: 'products.voiceAgents.features.support.title', descriptionKey: 'products.voiceAgents.features.support.description' },
      { titleKey: 'products.voiceAgents.features.booking.title', descriptionKey: 'products.voiceAgents.features.booking.description' },
      { titleKey: 'products.voiceAgents.features.qualification.title', descriptionKey: 'products.voiceAgents.features.qualification.description' }
    ],
    seo: {
      titleKey: 'products.voiceAgents.seo.title',
      descriptionKey: 'products.voiceAgents.seo.description',
      indexable: true
    },
    badges: ['mvp'],
    availability: 'public',
    translations: {},
    social: {},
    futureFlags: {}
  }
} satisfies Record<ProductRecord['id'], ProductRecord>;

export const products = Object.values(productRegistry);

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}
