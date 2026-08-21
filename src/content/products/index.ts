// A value, not just a type, because the status labels are resolved from
// `common.productStatus.*` in server components and handed to client components
// as a plain record — which needs something to iterate. Also what the product
// ingest schema validates against.
export const productStatuses = ['draft', 'teaser', 'alpha', 'beta', 'live', 'deprecated', 'archived'] as const;

export type ProductStatus = (typeof productStatuses)[number];

export function isProductStatus(value: string): value is ProductStatus {
  return (productStatuses as readonly string[]).includes(value);
}

export type ProductRecord = {
  id: 'scriptia' | 'padelco' | 'voice-agents' | 'speaklio' | 'accento' | 'nailio';
  slug: 'scriptia' | 'padelco' | 'voice-agents' | 'speaklio' | 'accento' | 'nailio';
  nameKey: string;
  descriptionKey: string;
  status: ProductStatus;
  accent: 'scriptia' | 'padelco' | 'voice-agents' | 'speaklio' | 'accento' | 'nailio';
  links: {
    canonical: string;
    // An off-site marketing/product link shown ONLY in navigation and cards
    // (kept for future products). Prefer `live` for "visit the running app".
    external?: string;
    // The live, in-production app for this product. Surfaced only on the
    // product's own page (its primary CTA), never in nav/cards/home — those
    // route to the in-domain product page instead.
    live?: string;
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
    links: { canonical: '/scriptia', live: 'https://scriptiastories.com' },
    hero: {
      titleKey: 'products.scriptia.hero.title',
      descriptionKey: 'products.scriptia.hero.description'
    },
    features: [
      { titleKey: 'products.scriptia.features.storefront.title', descriptionKey: 'products.scriptia.features.storefront.description' },
      { titleKey: 'products.scriptia.features.reading.title', descriptionKey: 'products.scriptia.features.reading.description' },
      { titleKey: 'products.scriptia.features.analytics.title', descriptionKey: 'products.scriptia.features.analytics.description' }
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
  },
  speaklio: {
    id: 'speaklio',
    slug: 'speaklio',
    nameKey: 'products.speaklio.name',
    descriptionKey: 'products.speaklio.description',
    status: 'beta',
    accent: 'speaklio',
    links: { canonical: '/speaklio' },
    hero: {
      titleKey: 'products.speaklio.hero.title',
      descriptionKey: 'products.speaklio.hero.description'
    },
    features: [
      { titleKey: 'products.speaklio.features.hotSeat.title', descriptionKey: 'products.speaklio.features.hotSeat.description' },
      { titleKey: 'products.speaklio.features.coach.title', descriptionKey: 'products.speaklio.features.coach.description' },
      { titleKey: 'products.speaklio.features.progress.title', descriptionKey: 'products.speaklio.features.progress.description' }
    ],
    seo: {
      titleKey: 'products.speaklio.seo.title',
      descriptionKey: 'products.speaklio.seo.description',
      indexable: true
    },
    badges: ['mvp'],
    availability: 'public',
    translations: {},
    social: {},
    futureFlags: {}
  },
  accento: {
    id: 'accento',
    slug: 'accento',
    nameKey: 'products.accento.name',
    descriptionKey: 'products.accento.description',
    // Archived, not teaser: there is no `products.accento` namespace in any of
    // src/messages/{en,es,ca}. next-intl logs a missing key and renders the key
    // path rather than throwing, so this page was serving
    // "products.accento.hero.title" as its <h1> — and sitemap.ts was submitting
    // it to Google. `archived` is honoured by resolveProduct, generateStaticParams
    // and sitemap.ts alike, so one word retires all three. Restore it by
    // publishing through the pipeline, which writes real copy in all locales.
    status: 'archived',
    accent: 'accento',
    links: { canonical: '/accento' },
    hero: {
      titleKey: 'products.accento.hero.title',
      descriptionKey: 'products.accento.hero.description'
    },
    features: [
      { titleKey: 'products.accento.features.hotSeat.title', descriptionKey: 'products.accento.features.hotSeat.description' },
      { titleKey: 'products.accento.features.coach.title', descriptionKey: 'products.accento.features.coach.description' },
      { titleKey: 'products.accento.features.progress.title', descriptionKey: 'products.accento.features.progress.description' }
    ],
    seo: {
      titleKey: 'products.accento.seo.title',
      descriptionKey: 'products.accento.seo.description',
      indexable: false
    },
    badges: ['launching-soon'],
    availability: 'teaser',
    translations: {},
    social: {},
    futureFlags: {}
  },
  nailio: {
    id: 'nailio',
    slug: 'nailio',
    nameKey: 'products.nailio.name',
    descriptionKey: 'products.nailio.description',
    // Archived for the same reason as accento above: no `products.nailio`
    // namespace exists in any locale.
    status: 'archived',
    accent: 'nailio',
    links: { canonical: '/nailio' },
    hero: {
      titleKey: 'products.nailio.hero.title',
      descriptionKey: 'products.nailio.hero.description'
    },
    features: [
      { titleKey: 'products.nailio.features.hotSeat.title', descriptionKey: 'products.nailio.features.hotSeat.description' },
      { titleKey: 'products.nailio.features.coach.title', descriptionKey: 'products.nailio.features.coach.description' },
      { titleKey: 'products.nailio.features.progress.title', descriptionKey: 'products.nailio.features.progress.description' }
    ],
    seo: {
      titleKey: 'products.nailio.seo.title',
      descriptionKey: 'products.nailio.seo.description',
      indexable: false
    },
    badges: ['launching-soon'],
    availability: 'teaser',
    translations: {},
    social: {},
    futureFlags: {}
  }
} satisfies Record<ProductRecord['id'], ProductRecord>;

export const products = Object.values(productRegistry);

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}
