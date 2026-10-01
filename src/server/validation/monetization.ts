import { z } from 'zod';

// monetization.json v1 — how an app makes money, as data. Written by
// product-agent's store stage, sent inside the product publish as
// `store.monetization`, handed to the build descriptor, and the ONLY input the
// orchestrator uses to create App Store subscriptions and the RevenueCat
// project, entitlement, offering, packages and paywall.
//
// Mirrors idion_kit/monetization.py (the orchestrator's and product-agent's
// validator). Checked here too so a malformed plan is a 422 at publish time —
// where the run that produced it can still fix it — rather than a build that
// fails hours later in front of App Store Connect.

const PERIODS = ['P1W', 'P1M', 'P2M', 'P3M', 'P6M', 'P1Y'] as const;
const OFFER_DURATIONS = ['P3D', 'P1W', 'P2W', 'P1M', 'P2M', 'P3M', 'P6M', 'P1Y'] as const;

// RevenueCat's standard package keys, fixed by period: the app template's
// paywall sorts, labels and computes savings from the package type.
export const packageForPeriod: Record<(typeof PERIODS)[number], string> = {
  P1W: '$rc_weekly',
  P1M: '$rc_monthly',
  P2M: '$rc_two_month',
  P3M: '$rc_three_month',
  P6M: '$rc_six_month',
  P1Y: '$rc_annual'
};

const price = z.string().regex(/^\d{1,4}\.\d{2}$/, 'A USD price like "49.99".');
const key = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/, 'Lowercase letters, digits and _.');
const lookup = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

const localized = (max: number) =>
  z.record(z.string().regex(/^[a-z]{2}(-[A-Z][A-Za-z]{1,3})?$/), z.string().trim().min(1).max(max)).refine((value) => Object.keys(value).length > 0, 'At least one locale.');

const offer = z
  .object({
    mode: z.enum(['free_trial', 'pay_up_front', 'pay_as_you_go']),
    duration: z.enum(OFFER_DURATIONS),
    periods: z.number().int().min(1).max(12).optional(),
    priceUsd: price.optional()
  })
  .refine((value) => value.mode === 'free_trial' || Boolean(value.priceUsd), 'A paid offer needs priceUsd.');

const paywallContext = z.object({
  renderer: z.enum(['custom', 'revenuecat']).optional(),
  headline: localized(80).optional(),
  subheadline: localized(160).optional(),
  bullets: z.array(localized(90)).max(6).optional(),
  cta: localized(40).optional()
});

export const monetizationSchema = z
  .object({
    version: z.literal(1),
    primaryLocale: z.string().default('en-US'),
    entitlement: z.literal('pro'),
    group: z.object({ referenceName: z.string().trim().min(1).max(64), displayName: localized(30) }),
    products: z
      .array(
        z.object({
          key,
          productId: z.string().regex(/^com\.idion\.[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9_]*$/, 'Product ids are com.idion.<slug>.<period>.'),
          referenceName: z.string().trim().min(1).max(64),
          period: z.enum(PERIODS),
          priceUsd: price,
          groupLevel: z.number().int().min(1),
          package: z.string().optional(),
          displayName: localized(30),
          description: localized(45),
          introOffer: offer.nullable().optional()
        })
      )
      .min(1)
      .max(6),
    promotionalOffers: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9][a-z0-9_]{0,63}$/),
            productKey: key,
            rcOffering: lookup.nullable().optional()
          })
          .and(offer)
      )
      .max(6)
      .optional(),
    offering: z
      .object({
        lookupKey: lookup.optional(),
        paywall: z
          .object({
            renderer: z.enum(['custom', 'revenuecat']).optional(),
            highlight: key.optional(),
            contexts: z.record(key, paywallContext).optional()
          })
          .optional()
      })
      .optional(),
    placements: z.array(key).max(20).optional(),
    reviewScreenshot: z.string().max(400).optional()
  })
  .superRefine((spec, ctx) => {
    const keys = new Set(spec.products.map((product) => product.key));
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });

    if (keys.size !== spec.products.length) issue('Two products share a key.');
    if (new Set(spec.products.map((product) => product.productId)).size !== spec.products.length) issue('Two products share a product id.');
    if (new Set(spec.products.map((product) => product.period)).size !== spec.products.length) issue('Two products share a period.');
    if (new Set(spec.products.map((product) => product.groupLevel)).size !== spec.products.length) issue('Two products share a group level.');
    if (new Set(spec.products.map((product) => product.productId.split('.')[2])).size > 1) issue('Product ids use different slugs.');

    for (const product of spec.products) {
      if (product.package && product.package !== packageForPeriod[product.period]) {
        issue(`${product.productId}: a ${product.period} product's package is ${packageForPeriod[product.period]}.`);
      }
      if (!product.displayName[spec.primaryLocale] || !product.description[spec.primaryLocale]) {
        issue(`${product.productId}: display name and description need ${spec.primaryLocale} text.`);
      }
    }
    for (const promo of spec.promotionalOffers ?? []) {
      if (!keys.has(promo.productKey)) issue(`Promotional offer ${promo.id} names an unknown product key.`);
    }
    const highlight = spec.offering?.paywall?.highlight;
    if (highlight && !keys.has(highlight)) issue(`The paywall highlights an unknown product key "${highlight}".`);
  });

export type Monetization = z.infer<typeof monetizationSchema>;
