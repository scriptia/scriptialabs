import { z } from 'zod';

const nonNegativeInt = z.coerce.number().int().min(0, 'Must be 0 or more.').max(100_000_000);

export const funnelEntrySchema = z.object({
  appId: z.string().uuid('Choose an app.'),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a week.'),
  tiktokViews: nonNegativeInt,
  tiktokProfileVisits: nonNegativeInt,
  tiktokLinkClicks: nonNegativeInt,
  appStoreProductPageViews: nonNegativeInt,
  appStoreDownloads: nonNegativeInt,
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value ? value : undefined))
});

export type FunnelEntryInput = z.infer<typeof funnelEntrySchema>;
