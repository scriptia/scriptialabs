import { z } from 'zod';

import { productLegalDocumentKeys, productLegalLabelKeys } from '@/content/legal/product-documents';
import { slugSchema } from './bets';

// The product copy + legal half of the publish payload.
//
// This was server/validation/apps.ts, written for an endpoint that would splice
// a new product into six TypeScript source files via ts-morph and commit them to
// GitHub. That path is gone (ADR-013) and so is the AST machinery, but the
// SCHEMA was always the good part: it is the shape product-agent's `legal` and
// `identity` stages emit, and product-agent/docs/scriptialabs-payload-schema.md
// documents it from the sending side. Extended by ./products.ts with the fields
// the database publish needs.

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

// One to six. This was `.length(3)` — exactly three, matching the convention
// every hand-written product page followed. That became the tightest coupling
// between the two repos the moment a machine started producing these: a
// product-agent run writes eight to fourteen features, so a fixed three meant
// either a 422 at publish time or a public page showing three of fourteen. Six
// is where the three-column grid stops wrapping raggedly.
const productCopySchema = z.object({
  name: localized(60),
  tagline: localized(140),
  // The longer blurb for homepage and /products cards, distinct from `tagline`
  // (the navbar one-liner). Optional: a machine-published product falls back to
  // its tagline rather than blocking the publish on a second string.
  cardDescription: localized(220).optional(),
  hero: z.object({
    title: localized(80),
    description: localized(220)
  }),
  features: z.array(featureSchema).min(1).max(6),
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
  // Paragraphs. One entry per <p>, matching LegalDocumentView's body: string[].
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
    // May be EMPTY. `publishLegal: false` is a supported run parameter, and a
    // run started that way has no documents to send — requiring at least one
    // made a legitimate option fail with a 422 at the last step. The publish
    // route skips the legal writes in that case and the panel shows a warning
    // that the product has no legal links, which is the honest outcome.
    documents: z.array(legalDocumentSchema).max(productLegalDocumentKeys.length)
  }),
  supportEmail: z.email().max(200)
});

export type AppsIngestPayload = z.infer<typeof appsIngestPayloadSchema>;
export type ProductCopyInput = z.infer<typeof productCopySchema>;
export type LegalDocumentInput = z.infer<typeof legalDocumentSchema>;

export { LOCALES as PRODUCT_COPY_LOCALES };
