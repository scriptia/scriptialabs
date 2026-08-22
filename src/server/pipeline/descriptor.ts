import 'server-only';

import { createHash } from 'node:crypto';
import { asc, desc, eq, inArray } from 'drizzle-orm';

import { productAssetKinds } from '@/content/internal';
import { legalDocuments } from '@/content/legal';
import { productLegalDocumentKeys, productLegalDocumentSlugs } from '@/content/legal/product-documents';
import { contentSite } from '@/content/site';
import { routing } from '@/lib/i18n/routing';
import { canonicalRoutes } from '@/lib/routing/routes';
import { db } from '@/server/db/client';
import { betDocuments, bets, pipelineRuns, productAssets, productFeatures, productLegalDocs, productLegalSections, products, users } from '@/server/db/schema';
import { autoAccents, pickAutoAccent } from '@/server/products/accent';

// The job descriptor: everything a runner needs to execute one run without
// reading anything else.
//
// The Bet Case is INLINED rather than linked. product-agent used to read its
// input from a sibling checkout of discovery-bets-pipeline on the same disk;
// inlining the case and the discovery entry here is what removes that
// dependency, so the runner can live on a machine that has never seen that repo.
//
// Bumped `descriptorVersion` whenever this shape changes in a way an older
// runner would misread, so it can refuse the job instead of half-executing it.
export const DESCRIPTOR_VERSION = 1;

const HEARTBEAT_INTERVAL_SECONDS = 60;
// Vercel rejects request bodies above ~4.5 MB, so the runner is told the ceiling
// rather than discovering it as a truncated upload.
const ASSET_MAX_BYTES = 4 * 1024 * 1024;


const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

/**
 * Slugs a new product may not take.
 *
 * Products, company legal documents and /contact share one flat top-level
 * namespace (ADR-008), so an `identity` stage that names an app "Contact" would
 * shadow a real page. Sent to the run up front AND enforced by the publish
 * route — a prompt is a suggestion, a constraint is a constraint.
 */
export async function listReservedSlugs(): Promise<string[]> {
  const taken = await db.select({ slug: products.slug }).from(products);

  return [
    ...Object.values(canonicalRoutes).map((route) => route.replace(/^\//, '')),
    ...Object.values(legalDocuments).map((document) => document.slug),
    ...taken.map((row) => row.slug),
    'internal',
    'api',
    '_next',
    'products'
  ]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort();
}

function siteBlock(reservedSlugs: string[], suggestedAccent: string) {
  return {
    baseUrl: contentSite.url,
    locales: [...routing.locales],
    defaultLocale: routing.defaultLocale,
    // Not sent: product-agent owns the support address in its own
    // data/store-account.json, and duplicating it here would create a second
    // source for a value that ends up on a legal page.
    suggestedAccent,
    accentPool: [...autoAccents],
    legalDocKeys: [...productLegalDocumentKeys],
    legalDocSlugs: productLegalDocumentSlugs,
    reservedSlugs,
    assetKinds: [...productAssetKinds],
    assetMaxBytes: ASSET_MAX_BYTES,
    urlTemplates: {
      product: '/{locale}/{slug}',
      legal: '/{locale}/{slug}/legal/{legalSlug}'
    }
  };
}

function callbacksBlock(runId: string) {
  return {
    base: contentSite.url,
    self: `/api/runs/${runId}`,
    heartbeat: `/api/runs/${runId}/heartbeat`,
    events: `/api/runs/${runId}/events`,
    assets: `/api/runs/${runId}/assets`,
    complete: `/api/runs/${runId}/complete`,
    publish: '/api/ingest/products',
    heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
    leaseSeconds: 900
  };
}

export type JobDescriptor = Record<string, unknown>;

/**
 * Builds the descriptor for one run. Returns null when the run does not exist.
 *
 * Shared by GET /api/runs/{id} and the response to POST /api/runs/claim, so a
 * runner that re-fetches after a restart gets byte-identical instructions.
 */
export async function buildJobDescriptor(runId: string): Promise<JobDescriptor | null> {
  const [row] = await db
    .select({
      run: pipelineRuns,
      bet: bets,
      requestedByName: users.name
    })
    .from(pipelineRuns)
    .innerJoin(bets, eq(bets.id, pipelineRuns.betId))
    .leftJoin(users, eq(users.id, pipelineRuns.requestedById))
    .where(eq(pipelineRuns.id, runId))
    .limit(1);

  if (!row) return null;

  const { run, bet } = row;
  const reservedSlugs = await listReservedSlugs();

  // A discovery run has no bet: it hunts markets and PRODUCES bets. Its
  // descriptor is deliberately small — the pipeline it drives owns its own
  // roster, rubric and prompts, and duplicating any of that here would create a
  // second source for something discovery-bets-pipeline already decides.
  if (run.kind === 'discovery') {
    return {
      descriptorVersion: run.descriptorVersion,
      run: {
        id: run.id,
        kind: run.kind,
        status: run.status,
        attempt: run.attempt,
        maxAttempts: run.maxAttempts,
        queuedAt: run.queuedAt.toISOString(),
        claimedAt: run.claimedAt?.toISOString() ?? null,
        leaseExpiresAt: run.leaseExpiresAt?.toISOString() ?? null,
        externalRunId: run.externalRunId,
        requestedBy: row.requestedByName,
        cancelRequested: Boolean(run.cancelRequestedAt)
      },
      callbacks: callbacksBlock(run.id),
      params: run.params,
      bet: null,
      site: { baseUrl: contentSite.url, panelUrl: `${contentSite.url}/internal/runs/${run.id}` }
    };
  }

  const base = {
    descriptorVersion: run.descriptorVersion,
    run: {
      id: run.id,
      kind: run.kind,
      status: run.status,
      attempt: run.attempt,
      maxAttempts: run.maxAttempts,
      queuedAt: run.queuedAt.toISOString(),
      claimedAt: run.claimedAt?.toISOString() ?? null,
      leaseExpiresAt: run.leaseExpiresAt?.toISOString() ?? null,
      externalRunId: run.externalRunId,
      requestedBy: row.requestedByName,
      // The graceful-stop signal. The runner touches its STOP file when it sees
      // this, rather than being killed mid-stage — product-agent already halts at
      // session boundaries and this reuses that, instead of inventing a second
      // mechanism that leaves half-written artifacts behind.
      cancelRequested: Boolean(run.cancelRequestedAt)
    },
    callbacks: callbacksBlock(run.id),
    params: run.params,
    bet: {
      id: bet.id,
      slug: bet.slug,
      title: bet.title,
      description: bet.description,
      status: bet.status,
      audience: bet.audience,
      priority: bet.priority,
      ground: bet.ground,
      discoveryVerdict: bet.discoveryVerdict,
      publicSlug: bet.publicSlug,
      panelUrl: `${contentSite.url}/internal/bets/${bet.slug}`
    },
    site: siteBlock(reservedSlugs, pickAutoAccent(bet.slug))
  };

  return run.kind === 'build' ? { ...base, artifacts: await buildArtifactsBlock(bet.id, bet.publicSlug) } : { ...base, input: await buildInputBlock(bet.id) };
}

/** The Bet Case and every other document the pipeline pushed, inlined. */
async function buildInputBlock(betId: string) {
  const documents = await db
    .select({ kind: betDocuments.kind, name: betDocuments.name, content: betDocuments.content })
    .from(betDocuments)
    .where(eq(betDocuments.betId, betId))
    .orderBy(asc(betDocuments.kind));

  const caseDocument = documents.find((document) => document.kind === 'case') ?? null;
  const discoveryEntry = documents.find((document) => document.name === 'discovery-entry.json') ?? null;

  let parsedEntry: unknown = null;
  if (discoveryEntry) {
    try {
      parsedEntry = JSON.parse(discoveryEntry.content);
    } catch {
      // A malformed entry is the pipeline's defect, not a reason to fail the
      // whole descriptor — the Bet Case is the input that actually matters.
      parsedEntry = null;
    }
  }

  return {
    case: caseDocument
      ? { name: caseDocument.name, content: caseDocument.content, sha256: sha256(caseDocument.content) }
      : null,
    discoveryEntry: parsedEntry,
    documents: documents
      .filter((document) => document.kind !== 'case')
      .map((document) => ({ kind: document.kind, name: document.name, content: document.content, sha256: sha256(document.content) }))
  };
}

/**
 * Everything the product-agent run produced, for the builder.
 *
 * Read from the database rather than from the publishing run's payload, because
 * by now a human may have corrected a string in the panel — and the builder must
 * receive what is actually live, not what the machine originally proposed.
 *
 * Legal document BODIES are deliberately absent. The builder consumes URLs (it
 * generates a src/lib/legal.ts of links), not prose, and inlining ~200 sections
 * in three locales would make this descriptor megabytes for no reader.
 */
async function buildArtifactsBlock(betId: string, publicSlug: string | null) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.betId, betId))
    .orderBy(desc(products.createdAt))
    .limit(1);

  if (!product) {
    // Not an error here: the claim route already refuses a build for a bet with
    // no product, and a descriptor that says so plainly is more useful to a
    // runner than one that throws.
    return { product: null, features: [], assets: [], legal: null, store: null, sourceRun: null, publicSlug, reason: 'No published product for this bet.' };
  }

  const [features, legalDocuments, assets] = await Promise.all([
    db
      .select({ key: productFeatures.key, sortOrder: productFeatures.sortOrder, title: productFeatures.title, description: productFeatures.description })
      .from(productFeatures)
      .where(eq(productFeatures.productId, product.id))
      .orderBy(asc(productFeatures.sortOrder)),
    db
      .select({ id: productLegalDocs.id, docKey: productLegalDocs.docKey, slug: productLegalDocs.slug, labelKey: productLegalDocs.labelKey, lastUpdated: productLegalDocs.lastUpdated })
      .from(productLegalDocs)
      .where(eq(productLegalDocs.productId, product.id))
      .orderBy(asc(productLegalDocs.sortOrder)),
    db
      .select({ kind: productAssets.kind, url: productAssets.url, width: productAssets.width, height: productAssets.height, bytes: productAssets.bytes, checksum: productAssets.checksum, sortOrder: productAssets.sortOrder })
      .from(productAssets)
      .where(eq(productAssets.productId, product.id))
      .orderBy(asc(productAssets.kind), asc(productAssets.sortOrder))
  ]);

  const sectionKeys = legalDocuments.length
    ? await db
        .select({ documentId: productLegalSections.documentId, key: productLegalSections.key })
        .from(productLegalSections)
        .where(
          inArray(
            productLegalSections.documentId,
            legalDocuments.map((document) => document.id)
          )
        )
        .orderBy(asc(productLegalSections.sortOrder))
    : [];

  const locales = [...routing.locales];
  const urlsFor = (path: string) => Object.fromEntries(locales.map((locale) => [locale, `${contentSite.url}/${locale}${path}`]));
  const legalUrl = (docKey: string) => {
    const document = legalDocuments.find((entry) => entry.docKey === docKey);
    return document ? `${contentSite.url}/${routing.defaultLocale}/${product.slug}/legal/${document.slug}` : null;
  };

  return {
    product: {
      id: product.id,
      slug: product.slug,
      status: product.status,
      accent: product.accent,
      // The builder should know whether these URLs are actually reachable. An
      // unpublished product's pages 404, which is an App Store rejection if the
      // build proceeds to submission on the strength of them.
      published: Boolean(product.publishedAt),
      publishedAt: product.publishedAt?.toISOString() ?? null,
      indexable: product.indexable,
      name: product.name,
      tagline: product.tagline,
      hero: { title: product.heroTitle, description: product.heroDescription },
      seo: { title: product.seoTitle, description: product.seoDescription },
      supportEmail: product.supportEmail,
      urls: urlsFor(`/${product.slug}`)
    },
    features: features.map((feature) => ({ key: feature.key, sortOrder: feature.sortOrder, title: feature.title, description: feature.description })),
    assets: assets.map((asset) => ({
      kind: asset.kind,
      url: asset.url,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
      checksum: asset.checksum,
      sortOrder: asset.sortOrder
    })),
    legal: {
      // `hosted` here is a claim about this database, not a probe. push_product.py
      // does the probing and writes the authoritative answer into
      // export/products.json; the builder should re-probe before submitting.
      documentCount: legalDocuments.length,
      locales,
      privacyUrl: legalUrl('privacy'),
      termsUrl: legalUrl('terms'),
      documents: legalDocuments.map((document) => ({
        docKey: document.docKey,
        slug: document.slug,
        labelKey: document.labelKey,
        lastUpdated: document.lastUpdated,
        sectionKeys: sectionKeys.filter((section) => section.documentId === document.id).map((section) => section.key),
        urls: urlsFor(`/${product.slug}/legal/${document.slug}`)
      }))
    },
    store: product.storeMetadata,
    sourceRun: {
      id: product.sourceRunId,
      externalRunId: product.sourceExternalRunId,
      publishedAt: product.publishedAt?.toISOString() ?? null
    },
    publicSlug
  };
}
