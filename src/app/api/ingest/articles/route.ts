import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { articlesSegment } from '@/content/articles';
import { contentSite } from '@/content/site';
import { recordAudit } from '@/server/audit';
import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { productArticles, products } from '@/server/db/schema';
import { revalidateProductArticles } from '@/server/products/revalidate';
import { productArticlesTag } from '@/server/queries/public-products';
import { articleIngestPayloadSchema, type ArticlePayload } from '@/server/validation/articles';

export const runtime = 'nodejs';

// Publishes one product's articles to the public site (ADR-014).
//
// An UPSERT keyed on (product, locale, translationKey), for the same reason the
// products route is one: re-running the publish script to fix a typo should
// update the page, not demand a new slug.
//
// What it deliberately does NOT do:
// - delete an article missing from the payload. Unpublishing is `status:
//   "draft"`, so a payload built from an older checkout can never take pages down;
// - require a pipeline run. Articles are written by a person (or a Skill a
//   person drives), not by product-agent;
// - move `updatedAt` when the words did not change. dateModified and the
//   sitemap's lastmod are claims to search engines, and a re-publish of the same
//   text is not a modification.

type Outcome = 'created' | 'updated' | 'unchanged';

export async function POST(request: NextRequest) {
  const auth = requireBearerToken(request, 'ARTICLE_INGEST_TOKEN');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = articleIngestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const payload = parsed.data;

  // Articles hang off a product that already has a page. Publication state is not
  // checked here: an unpublished product's articles are stored and simply stay
  // invisible, because every public read joins through the product predicate.
  const [product] = await db.select({ id: products.id, slug: products.slug }).from(products).where(eq(products.slug, payload.product)).limit(1);
  if (!product) {
    return NextResponse.json({ ok: false, error: `No product with slug "${payload.product}".` }, { status: 404 });
  }

  const existingRows = await db.select().from(productArticles).where(eq(productArticles.productId, product.id));

  // A slug held by a DIFFERENT article in the same locale would trip the unique
  // index halfway through the loop. Refuse the whole payload instead.
  for (const article of payload.articles) {
    const holder = existingRows.find((row) => row.locale === article.locale && row.slug === article.slug && row.translationKey !== article.translationKey);
    const movingAway = holder && payload.articles.some((other) => other.locale === holder.locale && other.translationKey === holder.translationKey && other.slug !== holder.slug);
    if (holder && !movingAway) {
      return NextResponse.json(
        { ok: false, error: `/${article.locale}/${product.slug}/${articlesSegment}/${article.slug} already belongs to article "${holder.translationKey}".` },
        { status: 409 }
      );
    }
  }

  const now = new Date();
  const results: Array<{ locale: string; slug: string; translationKey: string; status: string; outcome: Outcome; url: string }> = [];

  // Two passes when slugs swap between articles: park the moving rows on a
  // temporary slug first so the unique index never sees two rows on one URL.
  const moving = payload.articles.filter((article) => {
    const row = existingRows.find((candidate) => candidate.locale === article.locale && candidate.translationKey === article.translationKey);
    return row && row.slug !== article.slug;
  });
  for (const article of moving) {
    await db
      .update(productArticles)
      .set({ slug: `${article.slug}--moving-${now.getTime()}` })
      .where(and(eq(productArticles.productId, product.id), eq(productArticles.locale, article.locale), eq(productArticles.translationKey, article.translationKey)));
  }

  for (const article of payload.articles) {
    const existing = existingRows.find((row) => row.locale === article.locale && row.translationKey === article.translationKey);
    const checksum = checksumOf(article);
    const wordsChanged = !existing || existing.checksum !== checksum;

    const values = {
      productId: product.id,
      locale: article.locale,
      slug: article.slug,
      translationKey: article.translationKey,
      status: article.status,
      title: article.title,
      description: article.description,
      body: article.body,
      faq: article.faq,
      targetQuery: article.targetQuery ?? null,
      keywords: article.keywords,
      checksum,
      // Set on first publication, never moved afterwards — including across an
      // unpublish/republish, which is a visibility change, not a new article.
      publishedAt: existing?.publishedAt ?? (article.status === 'published' ? now : null),
      updatedAt: wordsChanged || !existing ? now : existing.updatedAt
    };

    const metadataChanged =
      !!existing &&
      (existing.slug !== article.slug ||
        existing.status !== article.status ||
        existing.targetQuery !== values.targetQuery ||
        JSON.stringify(existing.keywords) !== JSON.stringify(article.keywords));

    await db
      .insert(productArticles)
      .values(values)
      .onConflictDoUpdate({ target: [productArticles.productId, productArticles.locale, productArticles.translationKey], set: values });

    const outcome: Outcome = !existing ? 'created' : wordsChanged || metadataChanged ? 'updated' : 'unchanged';
    results.push({
      locale: article.locale,
      slug: article.slug,
      translationKey: article.translationKey,
      status: article.status,
      outcome,
      url: `${contentSite.url}/${article.locale}/${product.slug}/${articlesSegment}/${article.slug}`
    });
  }

  const changed = results.filter((result) => result.outcome !== 'unchanged');
  if (changed.length > 0) {
    await recordAudit({
      actorId: null,
      entity: 'product_articles',
      entityId: product.id,
      action: 'update',
      diff: Object.fromEntries(changed.map((result) => [`${result.locale}/${result.translationKey}`, { from: null, to: `${result.outcome}:${result.status}` }]))
    });
  }

  revalidateProductArticles(product.slug);

  return NextResponse.json({
    ok: true,
    product: product.slug,
    created: results.filter((result) => result.outcome === 'created').length,
    updated: results.filter((result) => result.outcome === 'updated').length,
    unchanged: results.filter((result) => result.outcome === 'unchanged').length,
    articles: results,
    revalidated: [productArticlesTag(product.slug), '/sitemap.xml', '/llms.txt']
  });
}

function checksumOf(article: ArticlePayload) {
  return createHash('sha256')
    .update(JSON.stringify([article.title, article.description, article.body, article.faq]))
    .digest('hex');
}
