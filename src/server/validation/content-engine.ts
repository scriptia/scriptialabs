import { z } from 'zod';

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
