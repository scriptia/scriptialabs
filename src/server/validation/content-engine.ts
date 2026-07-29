import { z } from 'zod';

import { contentTypes } from '@/content/content-engine';

// Query-string schemas for the content-engine read API (see ADR-012). These
// validate `URLSearchParams` entries, which are always strings — numeric
// filters use `z.coerce.number()` rather than `z.number()` for that reason.

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()
  .refine((value) => value === undefined || z.uuid().safeParse(value).success, { message: 'Not a valid id.' });

const boolFromString = z
  .string()
  .trim()
  .transform((value) => value === 'true' || value === '1')
  .optional();

export const knowledgeQuerySchema = z.object({
  app_id: optionalUuid,
  related_angle: z.string().trim().min(1).optional(),
  related_hook_type: z.string().trim().min(1).optional(),
  include_inactive: boolFromString
});

export const trendSourcesQuerySchema = z.object({
  niche: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

export const trendSourceIdParamSchema = z.object({
  id: z.uuid('Not a valid id.')
});

export const contentPiecesQuerySchema = z.object({
  app_id: z.uuid('app_id is required and must be a valid id.'),
  days: z.coerce.number().int().positive().max(365).optional(),
  limit: z.coerce.number().int().positive().max(500).optional()
});

export const performanceSummaryQuerySchema = z.object({
  app_id: z.uuid('app_id is required and must be a valid id.'),
  days: z.coerce.number().int().positive().max(365).optional()
});

export const publicationsQuerySchema = z.object({
  app_id: z.uuid('app_id is required and must be a valid id.'),
  stale_hours: z.coerce.number().int().positive().max(24 * 365).optional()
});

export const galleryQuerySchema = z.object({
  app_id: z.uuid('app_id is required and must be a valid id.'),
  asset_type: z.string().trim().min(1).optional()
});

export const gallerySearchQuerySchema = z.object({
  app_id: z.uuid('app_id is required and must be a valid id.'),
  query: z.string().trim().min(1, 'query is required.'),
  asset_type: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(50).optional()
});

export const reviewQueueQuerySchema = z.object({
  app_id: optionalUuid
});

export const createContentPieceBodySchema = z.object({
  app_id: z.uuid('app_id is required and must be a valid id.'),
  content_type: z.enum(contentTypes),
  angle: z.string().trim().min(1).nullish(),
  hook_text: z.string().trim().min(1).nullish(),
  hook_type: z.string().trim().min(1).nullish(),
  script: z.unknown().optional(),
  inspired_by_id: z.uuid().nullish()
});

// See src/server/content-engine/production.ts for why this is `url`, never
// `prompt` — this repo has no executor that would turn a prompt into a
// real asset, so the Skill must hand over an already-produced url.
const finishedAssetSchema = z.object({
  url: z.url('Must be a real, already-produced url — this endpoint does not generate anything.'),
  production_method: z.string().trim().min(1),
  generation_provider: z.string().trim().min(1).nullish(),
  generation_cost_usd: z.coerce.number().nonnegative().nullish()
});

const finishedSlideAssetSchema = finishedAssetSchema.extend({
  order_index: z.coerce.number().int().nonnegative()
});

export const produceBodySchema = z.object({
  asset: finishedAssetSchema.optional(),
  slide_assets: z.array(finishedSlideAssetSchema).min(1).optional()
});

export const trendSourceFromLinkBodySchema = z.object({
  app_id: z.uuid('app_id is required and must be a valid id.'),
  url: z.url('url must be a valid url.'),
  platform: z.string().trim().min(1),
  raw_metrics: z
    .object({
      views: z.coerce.number().nonnegative().optional(),
      likes: z.coerce.number().nonnegative().optional(),
      comments: z.coerce.number().nonnegative().optional(),
      shares: z.coerce.number().nonnegative().optional(),
      saves: z.coerce.number().nonnegative().optional()
    })
    .optional()
});

export const trendSourceFormulaBodySchema = z.object({
  extracted_formula: z.record(z.string(), z.unknown())
});

export const publishContentPieceBodySchema = z.object({
  platform: z.string().trim().min(1),
  permalink: z.url().nullish(),
  external_post_id: z.string().trim().min(1).nullish()
});

export const createSocialMetricBodySchema = z.object({
  views: z.coerce.number().int().nonnegative().optional(),
  likes: z.coerce.number().int().nonnegative().optional(),
  comments: z.coerce.number().int().nonnegative().optional(),
  shares: z.coerce.number().int().nonnegative().optional(),
  saves: z.coerce.number().int().nonnegative().optional(),
  reach: z.coerce.number().int().nonnegative().optional(),
  avg_watch_time_s: z.coerce.number().nonnegative().optional()
});
