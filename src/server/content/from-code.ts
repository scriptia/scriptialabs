import { getTranslations } from 'next-intl/server';

import { productLegalDocuments, getProductLegalEntry, type ProductLegalDocumentKey } from '@/content/legal/product-legal';
import { getProductBySlug, products, type ProductRecord } from '@/content/products';
import { productMessageKeyById } from '@/content/products/message-keys';
import type { Locale } from '@/lib/i18n/routing';
import type { LegalDocView, ProductCardView, ProductLegalUrlView, ProductPageView } from './product-view';

// Adapter: src/content/products + src/content/legal/product-legal + the message
// files -> the view models. This is the OLD path, kept alive behind
// PUBLIC_CONTENT_SOURCE only long enough to prove the database path renders
// identically, and deleted with the content registries afterwards.
//
// It deliberately reads through `getTranslations` with the same namespaces and
// keys the routes used before this refactor, rather than importing the message
// dictionaries directly. Identical lookup machinery means identical output —
// including any ICU formatting and any fallback behaviour — so a parity diff can
// only come from the database adapter, which is the thing actually being tested.

const publishedProducts = () => products.filter((product) => product.status !== 'archived');

async function toCardView(locale: Locale, product: ProductRecord): Promise<ProductCardView> {
  const messageKey = productMessageKeyById[product.id];
  const [t, tHome] = await Promise.all([
    getTranslations({ locale, namespace: `products.${messageKey}` }),
    getTranslations({ locale, namespace: 'homepage' })
  ]);

  return {
    id: product.id,
    slug: product.slug,
    status: product.status,
    accent: product.accent,
    canonical: product.links.canonical,
    name: t('name'),
    // The card blurb is the homepage's copy, not products.<ns>.description —
    // they are different strings. See the schema comment on cardDescription.
    cardDescription: tHome(`products.items.${messageKey}.description`),
    tagline: t('description'),
    liveUrl: product.links.live,
    externalUrl: product.links.external,
    indexable: product.seo.indexable
  };
}

export async function listProductCardsFromCode(locale: Locale): Promise<ProductCardView[]> {
  return Promise.all(publishedProducts().map((product) => toCardView(locale, product)));
}

export function listProductSlugsFromCode(): string[] {
  return publishedProducts().map((product) => product.slug);
}

export async function getProductPageFromCode(locale: Locale, slug: string): Promise<ProductPageView | null> {
  const product = getProductBySlug(slug);
  if (!product || product.status === 'archived') return null;

  const messageKey = productMessageKeyById[product.id];
  const t = await getTranslations({ locale, namespace: `products.${messageKey}` });
  const card = await toCardView(locale, product);

  // Feature ids are derived the way the route derived them at render time:
  // strip the `products.<key>.` prefix off the message key.
  const featureKeyPrefix = `products.${messageKey}.`;
  const features = product.features.map((feature) => {
    const relativeTitleKey = feature.titleKey.replace(featureKeyPrefix, '');
    const relativeDescriptionKey = feature.descriptionKey.replace(featureKeyPrefix, '');
    return {
      key: relativeTitleKey.replace(/^features\./, '').replace(/\.title$/, ''),
      title: t(relativeTitleKey),
      description: t(relativeDescriptionKey)
    };
  });

  const stepKeys = ['1', '2', '3'] as const;
  const faqKeys = ['1', '2', '3', '4'] as const;

  const legal = productLegalDocuments[product.id];
  const legalLinks = legal
    ? Object.entries(legal).map(([docKey, document]) => ({
        docKey,
        slug: document.slug,
        labelKey: document.labelKey ?? docKey
      }))
    : [];

  return {
    ...card,
    heroTitle: t('hero.title'),
    heroDescription: t('hero.description'),
    seoTitle: t('seo.title'),
    seoDescription: t('seo.description'),
    badges: product.badges,
    features,
    page: {
      overview: { title: t('page.overview.title'), body: t('page.overview.body') },
      capabilitiesTitle: t('page.capabilities.title'),
      howItWorks: {
        title: t('page.howItWorks.title'),
        description: t('page.howItWorks.description'),
        steps: stepKeys.map((key) => ({
          title: t(`page.howItWorks.steps.${key}.title`),
          description: t(`page.howItWorks.steps.${key}.description`)
        }))
      },
      why: { title: t('page.why.title'), body: t('page.why.body') },
      statusBlock: { title: t('page.status.title'), body: t('page.status.body') },
      faq: {
        title: t('page.faq.title'),
        items: faqKeys.map((key) => ({
          question: t(`page.faq.items.${key}.question`),
          answer: t(`page.faq.items.${key}.answer`)
        }))
      },
      cta: {
        title: t('page.cta.title'),
        description: t('page.cta.description'),
        primary: t('page.cta.primary'),
        // Matches the route's original `t.has('page.cta.secondary')` guard —
        // only Scriptia carries one.
        ...(t.has('page.cta.secondary') ? { secondary: t('page.cta.secondary') } : {})
      },
      ...(t.has('page.brandCta') ? { brandCta: t('page.brandCta') } : {})
    },
    legalLinks
  };
}

export async function getProductLegalDocFromCode(locale: Locale, slug: string, legalSlug: string): Promise<LegalDocView | null> {
  const product = getProductBySlug(slug);
  if (!product || product.status === 'archived' || !productLegalDocuments[product.id]) return null;

  const entry = getProductLegalEntry(product.id, legalSlug);
  if (!entry) return null;

  const messageKey = productMessageKeyById[product.id];
  const t = await getTranslations({ locale, namespace: `productLegal.${messageKey}.${entry.key}` });

  return {
    docKey: entry.key,
    slug: entry.document.slug,
    lastUpdated: entry.document.lastUpdated,
    title: t('title'),
    description: t('description'),
    sections: entry.document.sections.map((sectionId) => ({
      id: sectionId,
      title: t(`sections.${sectionId}.title`),
      body: t.raw(`sections.${sectionId}.body`) as string[]
    }))
  };
}

export function listProductLegalUrlsFromCode(): ProductLegalUrlView[] {
  return publishedProducts().flatMap((product) => {
    const documents = productLegalDocuments[product.id];
    if (!documents) return [];
    return Object.values(documents).map((document) => ({
      productSlug: product.slug,
      docSlug: document.slug,
      indexable: product.seo.indexable
    }));
  });
}

/** Every (productSlug, legalSlug) pair, for generateStaticParams. */
export function listProductLegalParamsFromCode(): Array<{ slug: string; legalSlug: string }> {
  return listProductLegalUrlsFromCode().map(({ productSlug, docSlug }) => ({ slug: productSlug, legalSlug: docSlug }));
}

export type { ProductLegalDocumentKey };
