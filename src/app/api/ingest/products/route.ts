import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, notInArray } from 'drizzle-orm';

import { isTerminalPipelineRunStatus } from '@/content/internal';
import { recordAudit } from '@/server/audit';
import { requireBearerToken } from '@/server/auth/api-token';
import { pickAutoAccent } from '@/server/products/accent';
import { db } from '@/server/db/client';
import { bets, pipelineRunEvents, pipelineRuns, productAssets, productDocuments, productFeatures, productLegalDocs, productLegalSections, products } from '@/server/db/schema';
import type { LocalizedText } from '@/server/db/schema';
import { listReservedSlugs } from '@/server/pipeline/descriptor';
import { PRODUCTS_TAG, productLegalTag, productTag } from '@/server/queries/public-products';
import { revalidateProduct } from '@/server/products/revalidate';
import { productIngestPayloadSchema, type ProductIngestPayload } from '@/server/validation/products';

export const runtime = 'nodejs';

// Publishes one product to the PUBLIC site. This is the route that makes a bet's
// page exist, so it is the one with the largest blast radius in the project.
//
// Deliberately an UPSERT, unlike the contract the original apps-ingest schema
// documented ("a slug that already exists is rejected, not upserted"). That rule
// was written when publishing meant committing to GitHub and waiting for a
// build. With a pipeline_runs row behind the call the caller is a run a human
// queued, every write is audited, the payload is retained on the run, and
// revalidation lands in seconds — so re-running `legal` to fix a typo should
// update the page rather than force a slug change.
//
// The guard that replaces it: a product may only be upserted by the bet that
// owns it. A slug held by a different bet is a 409, always.

export async function POST(request: NextRequest) {
  const auth = requireBearerToken(request, 'PRODUCT_INGEST_TOKEN');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = productIngestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const payload = parsed.data;

  // 1 — the run must exist and still be live.
  const [run] = await db
    .select({ id: pipelineRuns.id, betId: pipelineRuns.betId, status: pipelineRuns.status, params: pipelineRuns.params, externalRunId: pipelineRuns.externalRunId })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.id, payload.pipelineRunId))
    .limit(1);

  if (!run) {
    return NextResponse.json({ ok: false, error: 'No such pipeline run.' }, { status: 404 });
  }
  if (isTerminalPipelineRunStatus(run.status)) {
    // The zombie guard. A process whose lease was reaped and reassigned must not
    // be able to publish over work the replacement already did.
    return NextResponse.json({ ok: false, error: `Run already finished (${run.status}); refusing to publish.` }, { status: 409 });
  }

  // A discovery run has no bet and therefore no product to publish. Only
  // product-agent runs reach here.
  if (!run.betId) {
    return NextResponse.json({ ok: false, error: 'That run is not attached to a bet; nothing to publish.' }, { status: 409 });
  }

  const [bet] = await db.select({ id: bets.id, slug: bets.slug, status: bets.status }).from(bets).where(eq(bets.id, run.betId)).limit(1);
  if (!bet) {
    return NextResponse.json({ ok: false, error: 'That run has no bet.' }, { status: 404 });
  }

  // 2 — reserved-slug guard. Products, company legal documents and /contact
  // share one flat top-level namespace (ADR-008), so a product named "Contact"
  // would shadow a real page. The descriptor tells the run this list up front;
  // this enforces it, because a prompt is a suggestion and a constraint is not.
  const reserved = await listReservedSlugs();
  const [existing] = await db.select({ id: products.id, betId: products.betId, publishedAt: products.publishedAt }).from(products).where(eq(products.slug, payload.slug)).limit(1);

  if (existing && existing.betId !== bet.id) {
    return NextResponse.json({ ok: false, error: `The slug "${payload.slug}" belongs to another bet.`, reservedSlugs: reserved }, { status: 409 });
  }
  if (!existing && reserved.includes(payload.slug)) {
    return NextResponse.json({ ok: false, error: `The slug "${payload.slug}" is reserved.`, reservedSlugs: reserved }, { status: 409 });
  }

  const publishLegal = (run.params as { publishLegal?: boolean })?.publishLegal !== false;
  const now = new Date();

  // 3 — the product row.
  const values = {
    slug: payload.slug,
    betId: bet.id,
    status: payload.status,
    accent: payload.accent ?? pickAutoAccent(payload.slug),
    // Set once. A re-publish must not move the publication date, and must not
    // silently re-publish something an admin deliberately unpublished — that is
    // what the Products panel's Publish button is for.
    publishedAt: existing?.publishedAt ?? now,
    liveUrl: payload.liveUrl ?? null,
    externalUrl: payload.externalUrl ?? null,
    badges: payload.badges,
    supportEmail: payload.supportEmail,
    name: payload.product.name as LocalizedText,
    tagline: payload.product.tagline as LocalizedText,
    // Falls back to the tagline: a machine-written product having one good
    // sentence instead of two is not a reason to refuse to publish it.
    cardDescription: (payload.product.cardDescription ?? payload.product.tagline) as LocalizedText,
    heroTitle: payload.product.hero.title as LocalizedText,
    heroDescription: payload.product.hero.description as LocalizedText,
    seoTitle: payload.product.seo.title as LocalizedText,
    seoDescription: payload.product.seo.description as LocalizedText,
    pageCopy: (payload.page ?? null) as never,
    // Kept so the build handoff can hand App Store Connect's fields to the
    // builder without reaching back into another machine's disk.
    storeMetadata: payload.store ?? null,
    sourceRunId: run.id,
    sourceExternalRunId: payload.externalRunId ?? run.externalRunId,
    updatedAt: now
  };

  const [row] = await db
    .insert(products)
    .values(values)
    // `indexable` is deliberately absent from the update set as well as unset on
    // insert (it defaults false): a coming-soon page is live and linked but not
    // submitted to search until a human flips it, and a re-publish must not undo
    // that decision.
    .onConflictDoUpdate({ target: products.slug, set: values })
    .returning({ id: products.id });

  const productId = row.id;

  // 4 — features. Replace, don't accumulate.
  await upsertFeatures(productId, payload);

  // 5 — legal, only when the run was asked for it.
  let legalDocumentCount = 0;
  if (publishLegal) {
    legalDocumentCount = await upsertLegal(productId, payload);
  }

  // 6 — assets by slot.
  await upsertAssets(productId, payload);

  // 7 — the markdown the product is built from. What makes the product stage
  // finished: until these are here, a builder can read a feature's name and
  // nothing else, and a marketing agent has no route to the store listing.
  const documentCount = await upsertDocuments(productId, payload);

  // 8 — the bet moves to `ready`: a public page now exists.
  let betStatus = bet.status;
  if (bet.status === 'researching' || bet.status === 'backlog') {
    betStatus = 'ready';
    await db.update(bets).set({ status: 'ready', publicSlug: payload.slug, updatedAt: now }).where(eq(bets.id, bet.id));
    await recordAudit({ actorId: null, entity: 'bet', entityId: bet.id, action: 'update', diff: { status: { from: bet.status, to: 'ready' }, publicSlug: { from: null, to: payload.slug } } });
  } else {
    await db.update(bets).set({ publicSlug: payload.slug, updatedAt: now }).where(eq(bets.id, bet.id));
  }

  const publicUrls = buildPublicUrls(payload);

  await db.update(pipelineRuns).set({ result: { productId, slug: payload.slug, publicUrls }, updatedAt: now }).where(eq(pipelineRuns.id, run.id));
  await db.insert(pipelineRunEvents).values({
    runId: run.id,
    level: 'info',
    message: `Published /${payload.slug} (${payload.product.features.length} features, ${legalDocumentCount} legal documents, ${documentCount} source documents).`
  });

  await recordAudit({
    actorId: null,
    entity: 'product',
    entityId: productId,
    action: existing ? 'update' : 'create',
    diff: { slug: { from: existing ? payload.slug : null, to: payload.slug }, runId: { from: null, to: run.id } }
  });

  // 8 — purge. Returned in the response so push_product.py can print exactly what
  // it invalidated, and so a stale page is a reportable fact rather than a guess.
  revalidateProduct(payload.slug);

  return NextResponse.json({
    ok: true,
    productId,
    slug: payload.slug,
    created: !existing,
    betStatus,
    features: payload.product.features.length,
    legalDocuments: legalDocumentCount,
    legalPublished: publishLegal,
    assets: payload.assets.length,
    publicUrls,
    revalidated: [PRODUCTS_TAG, productTag(payload.slug), productLegalTag(payload.slug), '/sitemap.xml']
  });
}

function buildPublicUrls(payload: ProductIngestPayload) {
  const base = 'https://scriptialabs.com';
  const locales = ['en', 'es', 'ca'] as const;

  return {
    product: Object.fromEntries(locales.map((locale) => [locale, `${base}/${locale}/${payload.slug}`])),
    legal: Object.fromEntries(
      payload.legal.documents.map((document) => [
        document.docKey,
        Object.fromEntries(locales.map((locale) => [locale, `${base}/${locale}/${payload.slug}/legal/${document.slug}`]))
      ])
    )
  };
}

async function upsertFeatures(productId: string, payload: ProductIngestPayload) {
  const features = payload.product.features;

  for (const [index, feature] of features.entries()) {
    const values = {
      productId,
      key: feature.id,
      sortOrder: index,
      title: feature.title as LocalizedText,
      description: feature.description as LocalizedText,
      updatedAt: new Date()
    };
    await db
      .insert(productFeatures)
      .values(values)
      .onConflictDoUpdate({ target: [productFeatures.productId, productFeatures.key], set: values });
  }

  // A re-publish with fewer features must remove the extras, or the page keeps
  // rendering something the run no longer believes in.
  const keys = features.map((feature) => feature.id);
  await db.delete(productFeatures).where(and(eq(productFeatures.productId, productId), notInArray(productFeatures.key, keys)));
}

async function upsertLegal(productId: string, payload: ProductIngestPayload) {
  const documents = payload.legal.documents;

  for (const [index, document] of documents.entries()) {
    const values = {
      productId,
      docKey: document.docKey,
      slug: document.slug,
      labelKey: document.labelKey ?? null,
      lastUpdated: document.lastUpdated,
      sortOrder: index,
      title: document.title as LocalizedText,
      description: document.description as LocalizedText,
      updatedAt: new Date()
    };

    const [docRow] = await db
      .insert(productLegalDocs)
      .values(values)
      .onConflictDoUpdate({ target: [productLegalDocs.productId, productLegalDocs.docKey], set: values })
      .returning({ id: productLegalDocs.id });

    for (const [sectionIndex, section] of document.sections.entries()) {
      const sectionValues = {
        documentId: docRow.id,
        key: section.id,
        sortOrder: sectionIndex,
        title: section.title as LocalizedText,
        body: section.body as never,
        updatedAt: new Date()
      };
      await db
        .insert(productLegalSections)
        .values(sectionValues)
        .onConflictDoUpdate({ target: [productLegalSections.documentId, productLegalSections.key], set: sectionValues });
    }

    const sectionKeys = document.sections.map((section) => section.id);
    await db.delete(productLegalSections).where(and(eq(productLegalSections.documentId, docRow.id), notInArray(productLegalSections.key, sectionKeys)));
  }

  const docKeys = documents.map((document) => document.docKey);
  if (docKeys.length) {
    await db.delete(productLegalDocs).where(and(eq(productLegalDocs.productId, productId), notInArray(productLegalDocs.docKey, docKeys)));
  }

  return documents.length;
}

async function upsertAssets(productId: string, payload: ProductIngestPayload) {
  if (payload.assets.length === 0) return;

  for (const asset of payload.assets) {
    const values = {
      productId,
      kind: asset.kind,
      url: asset.url,
      // The uploader owns the blob pathname; by the time an asset is referenced
      // here it has already been stored, and the URL is what the page renders.
      pathname: new URL(asset.url).pathname.replace(/^\//, ''),
      contentType: asset.url.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
      checksum: asset.checksum ?? null,
      sortOrder: asset.sortOrder,
      bytes: 0
    };
    await db
      .insert(productAssets)
      .values(values)
      .onConflictDoUpdate({ target: [productAssets.productId, productAssets.kind, productAssets.sortOrder], set: values });
  }

  const kinds = payload.assets.map((asset) => asset.kind);
  await db.delete(productAssets).where(and(eq(productAssets.productId, productId), notInArray(productAssets.kind, kinds)));
}

async function upsertDocuments(productId: string, payload: ProductIngestPayload) {
  // An empty array is meaningful in only one direction: a publish carrying no
  // documents leaves the existing ones alone rather than deleting them, so
  // re-publishing a copy fix from an older client cannot strip a product of its
  // specifications.
  if (payload.documents.length === 0) return 0;

  for (const document of payload.documents) {
    const values = {
      productId,
      kind: document.kind,
      path: document.path,
      name: document.name,
      content: document.content,
      checksum: document.checksum ?? null,
      sortOrder: document.sortOrder,
      updatedAt: new Date()
    };
    await db
      .insert(productDocuments)
      .values(values)
      .onConflictDoUpdate({ target: [productDocuments.productId, productDocuments.path], set: values });
  }

  // A document the run no longer produces is removed: a dropped feature must not
  // stay readable as though it were still part of the product.
  const paths = payload.documents.map((document) => document.path);
  await db.delete(productDocuments).where(and(eq(productDocuments.productId, productId), notInArray(productDocuments.path, paths)));

  return payload.documents.length;
}
