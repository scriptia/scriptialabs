import { z } from 'zod';

import { articleSlugPattern, articleStatuses } from '@/content/articles';
import { routing } from '@/lib/i18n/routing';

// The publish payload: POST /api/ingest/articles (ADR-014).
//
// Every article for ONE product, in any mix of locales. Each entry is one row:
// one locale, one slug. `translationKey` ties the locales of the same article
// together and is the upsert identity, so renaming a slug updates the row rather
// than leaving the old URL behind.

const slug = z.string().trim().regex(articleSlugPattern, 'Lowercase kebab-case, e.g. "stop-puppy-biting".').max(80);

const faqItemSchema = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(1200)
});

export const articlePayloadSchema = z.object({
  locale: z.enum(routing.locales),
  slug,
  translationKey: slug,
  status: z.enum(articleStatuses),
  title: z.string().trim().min(1).max(120),
  // Search engines show ~155 characters; the cap leaves room without inviting a paragraph.
  description: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(60_000),
  faq: z.array(faqItemSchema).max(10).default([]),
  targetQuery: z.string().trim().max(200).optional(),
  keywords: z.array(z.string().trim().min(1).max(80)).max(20).default([])
});

export const articleIngestPayloadSchema = z
  .object({
    product: z.string().trim().min(1),
    articles: z.array(articlePayloadSchema).min(1).max(200)
  })
  .superRefine((payload, ctx) => {
    // The two unique indexes, checked up front so a bad payload is a 422 that
    // names the duplicate rather than a half-applied publish and a 500.
    const seen = { slug: new Set<string>(), translation: new Set<string>() };
    payload.articles.forEach((article, index) => {
      const slugKey = `${article.locale}/${article.slug}`;
      const translationKey = `${article.locale}/${article.translationKey}`;
      if (seen.slug.has(slugKey)) {
        ctx.addIssue({ code: 'custom', path: ['articles', index, 'slug'], message: `Duplicate slug ${slugKey}.` });
      }
      if (seen.translation.has(translationKey)) {
        ctx.addIssue({ code: 'custom', path: ['articles', index, 'translationKey'], message: `Two ${article.locale} articles share translationKey "${article.translationKey}".` });
      }
      seen.slug.add(slugKey);
      seen.translation.add(translationKey);
    });
  });

export type ArticlePayload = z.infer<typeof articlePayloadSchema>;
export type ArticleIngestPayload = z.infer<typeof articleIngestPayloadSchema>;
