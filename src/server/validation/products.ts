import { z } from 'zod';

import { productAssetKinds } from '@/content/internal';
import { productStatuses } from '@/content/products';
import { autoAccents } from '@/server/products/accent';
import { appsIngestPayloadSchema } from './apps';

// The publish payload: POST /api/ingest/products.
//
// Extends appsIngestPayloadSchema (product copy + legal documents, all three
// locales) additively, so the fixture in scripts/smoke-test-mutate.ts keeps
// parsing and the two halves stay one schema rather than two that drift.

const localizedText = z.object({
  en: z.string().trim().min(1),
  es: z.string().trim().min(1),
  ca: z.string().trim().min(1)
});

const localizedOptional = localizedText.optional();

const stepSchema = z.object({ title: localizedText, description: localizedText });
const faqSchema = z.object({ question: localizedText, answer: localizedText });

// The `page.*` block. Every field optional: a machine-published product ships
// with a subset, and the renderer skips a section it has no copy for rather than
// printing a heading over an empty body.
export const productPageCopySchema = z.object({
  overview: z.object({ title: localizedText, body: localizedText }).optional(),
  capabilitiesTitle: localizedOptional,
  howItWorks: z.object({ title: localizedText, description: localizedText, steps: z.array(stepSchema).max(6) }).optional(),
  why: z.object({ title: localizedText, body: localizedText }).optional(),
  statusBlock: z.object({ title: localizedText, body: localizedText }).optional(),
  faq: z.object({ title: localizedText, items: z.array(faqSchema).max(8) }).optional(),
  cta: z
    .object({
      title: localizedText,
      description: localizedText,
      primary: localizedText,
      secondary: localizedOptional
    })
    .optional(),
  brandCta: localizedOptional
});

export const productIngestPayloadSchema = appsIngestPayloadSchema.extend({
  // The pipeline_runs uuid, not a week string. Ties a published page to the run
  // that wrote it, which is the entire point of the exercise — and lets the
  // route reject a callback from a run that has already finished.
  pipelineRunId: z.uuid(),
  externalRunId: z.string().trim().min(1).max(64).optional(),

  // `teaser` by default: a freshly published product is coming-soon until a
  // human says otherwise.
  status: z.enum(productStatuses).default('teaser'),
  // Omitted means pickAutoAccent(slug) — deterministic on the slug, so a re-run
  // lands on the same colour without consulting anything.
  accent: z.enum(autoAccents).optional(),

  liveUrl: z.url().max(500).optional(),
  externalUrl: z.url().max(500).optional(),
  badges: z.array(z.string().trim().max(40)).max(4).default([]),

  // Uploaded first via POST /api/runs/{id}/assets; referenced here by URL so the
  // publish call stays a small JSON body rather than a multi-megabyte one.
  assets: z
    .array(
      z.object({
        kind: z.enum(productAssetKinds),
        url: z.url().max(1000),
        sortOrder: z.number().int().min(0).max(20).default(0),
        checksum: z
          .string()
          .regex(/^sha256:[0-9a-f]{64}$/)
          .optional()
      })
    )
    .max(30)
    .default([]),

  page: productPageCopySchema.optional(),

  // Recorded, never rendered: the store block from product-agent's
  // export/products.json, so the build job descriptor can hand it to the builder
  // without a second round trip to another machine's disk.
  store: z.record(z.string(), z.unknown()).optional()
});

export type ProductIngestPayload = z.infer<typeof productIngestPayloadSchema>;
export type ProductPageCopyInput = z.infer<typeof productPageCopySchema>;
