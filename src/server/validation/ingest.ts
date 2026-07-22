import { z } from 'zod';

import { betAudiences, betDocumentKinds, betPriorities } from '@/content/internal';
import { slugSchema } from './bets';

// The discovery pipeline (C:\dev\bets\discovery-bets-pipeline) posts here at the
// end of a weekly run. Its ledger ids are already kebab-case, so they satisfy
// slugSchema unchanged and become the bet slug directly.
//
// Only three statuses are accepted. The pipeline decides "approved / near-miss /
// discarded" and nothing more — every later stage of the lifecycle is a human
// decision made in the panel, and letting a machine write `deployed` would make
// the board lie.
export const ingestStatuses = ['ready', 'backlog', 'killed'] as const;

export type IngestStatus = (typeof ingestStatuses)[number];

// 500k characters is roughly 10x the largest build prompt seen so far, and still
// far below anything Postgres cares about. It exists to bound a runaway payload,
// not to be a meaningful limit.
const MAX_DOCUMENT_CHARS = 500_000;

export const ingestDocumentSchema = z.object({
  kind: z.enum(betDocumentKinds),
  name: z.string().trim().min(1, 'Document name is required.').max(200),
  content: z.string().min(1, 'Document content is empty.').max(MAX_DOCUMENT_CHARS)
});

export const ingestBetSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(8000).nullish(),
  status: z.enum(ingestStatuses),
  audience: z.enum(betAudiences).optional(),
  priority: z.enum(betPriorities).optional(),
  // Free text on purpose: the pipeline's hunting grounds are not a fixed
  // vocabulary here, and this is only ever displayed.
  ground: z.string().trim().max(120).nullish(),
  documents: z.array(ingestDocumentSchema).max(8).optional()
});

export const ingestPayloadSchema = z.object({
  runId: z.string().trim().min(1).max(64),
  bets: z.array(ingestBetSchema).min(1, 'Nothing to ingest.').max(50)
});

export type IngestDocumentInput = z.infer<typeof ingestDocumentSchema>;
export type IngestBetInput = z.infer<typeof ingestBetSchema>;
export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
