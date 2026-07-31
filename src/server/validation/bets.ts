import { z } from 'zod';

import { betAudiences, betLinkKinds, betPriorities, betStatuses, betUpdateKinds } from '@/content/internal';

// Empty strings arrive from every unfilled <input>; treat them as "not provided"
// rather than as a value, so optional fields clear cleanly instead of storing ''.
export const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: 'Use the YYYY-MM-DD format.' });

export const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine((value) => value === null || z.uuid().safeParse(value).success, { message: 'Not a valid selection.' });

// Slugs are URL segments under /internal/bets/<slug>, so keep them to the same
// shape the public product registry already uses: lowercase, hyphen-separated.
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Slug must be at least 2 characters.')
  .max(64, 'Slug must be at most 64 characters.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only.');

export const betSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2, 'Title is required.').max(160),
  description: optionalText,
  status: z.enum(betStatuses),
  audience: z.enum(betAudiences),
  priority: z.enum(betPriorities),
  ownerId: optionalUuid,
  publicSlug: optionalText,
  nextAction: optionalText,
  startedAt: optionalDate,
  targetDate: optionalDate
});

export const betLinkSchema = z.object({
  betId: z.uuid(),
  kind: z.enum(betLinkKinds),
  label: optionalText,
  url: z.url('Enter a full URL, including https://').max(2048)
});

export const betUpdateSchema = z.object({
  betId: z.uuid(),
  kind: z.enum(betUpdateKinds),
  body: z.string().trim().min(1, 'Write something first.').max(4000)
});

export const betMetricSchema = z.object({
  betId: z.uuid(),
  metricKey: z.string().trim().min(1, 'Name the metric.').max(64),
  value: z.coerce.number('Enter a number.').finite(),
  unit: optionalText,
  recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
  note: optionalText
});

export const credentialsSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username.').max(64),
  password: z.string().min(1, 'Enter your password.').max(256)
});

export type BetInput = z.infer<typeof betSchema>;
export type BetLinkInput = z.infer<typeof betLinkSchema>;
export type BetUpdateInput = z.infer<typeof betUpdateSchema>;
export type BetMetricInput = z.infer<typeof betMetricSchema>;
