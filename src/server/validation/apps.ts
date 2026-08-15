import { z } from 'zod';

import { slugSchema } from './bets';

// product-agent (C:\dev\bets\product-agent) posts here once per bet, at the end
// of its `legal` pipeline stage, to create and deploy that bet's product page
// and legal pages in one call. See ADR-012 and
// product-agent/docs/scriptialabs-payload-schema.md, which documents this
// schema from the sending side and must stay in sync with it.
//
// Unlike /api/ingest/bets, there is no update path here: a slug that already
// exists in the registry is rejected (409), not upserted. Silently overwriting
// a product's public copy from an automated call is a bigger blast radius than
// silently overwriting a backlog card, and a re-run with a changed slug is the
// pipeline's own recovery path (see docs/adr/ADR-012-app-deploy-api.md).

export const productLegalDocumentKeys = [
  'privacy',
  'terms',
  'cookies',
  'aiPolicy',
  'contact',
  'dataDeletion',
  'accountDeletion',
  'acceptableUse'
] as const;

export const productLegalLabelKeys = [...productLegalDocumentKeys, 'termsEula'] as const;

const LOCALES = ['en', 'es', 'ca'] as const;

// Empty strings would silently render as blank headings/paragraphs on a live
// page rather than fail loudly, so every prose field requires real content.
const localized = (max: number) =>
  z.object({
    en: z.string().trim().min(1).max(max),
    es: z.string().trim().min(1).max(max),
    ca: z.string().trim().min(1).max(max)
  });

const featureSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-zA-Z0-9]*$/, 'Feature id must be a camelCase identifier, e.g. "tracking".'),
  title: localized(80),
  description: localized(220)
});

// Three, matching the convention every shipped product page follows (see
// ADR-003 addendum: "product.features is now populated (3 entries per
// product)"). Not a hard product constraint, just this endpoint keeping new
// pages consistent with the ones a human wrote.
const productCopySchema = z.object({
  name: localized(60),
  tagline: localized(140),
  hero: z.object({
    title: localized(80),
    description: localized(220)
  }),
  features: z.array(featureSchema).length(3),
  seo: z.object({
    title: localized(70),
    description: localized(160)
  })
});

const legalSectionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-zA-Z0-9]*$/, 'Section id must be a camelCase identifier, e.g. "informationWeCollect".'),
  title: localized(140),
  // Paragraphs. One entry per <p>, matching LegalDocument's body: string[].
  body: z.object({
    en: z.array(z.string().trim().min(1)).min(1).max(40),
    es: z.array(z.string().trim().min(1)).min(1).max(40),
    ca: z.array(z.string().trim().min(1)).min(1).max(40)
  })
});

const legalDocumentSchema = z.object({
  docKey: z.enum(productLegalDocumentKeys),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
  labelKey: z.enum(productLegalLabelKeys).optional(),
  title: localized(140),
  description: localized(240),
  sections: z.array(legalSectionSchema).min(1).max(30)
});

export const appsIngestPayloadSchema = z.object({
  runId: z.string().trim().min(1).max(64),
  slug: slugSchema,
  product: productCopySchema,
  legal: z.object({
    documents: z.array(legalDocumentSchema).min(1).max(productLegalDocumentKeys.length)
  }),
  supportEmail: z.email().max(200)
});

export type AppsIngestPayload = z.infer<typeof appsIngestPayloadSchema>;
export type ProductCopyInput = z.infer<typeof productCopySchema>;
export type LegalDocumentInput = z.infer<typeof legalDocumentSchema>;

export { LOCALES as APPS_INGEST_LOCALES };
