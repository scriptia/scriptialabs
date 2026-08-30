import { relations, sql } from 'drizzle-orm';
import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';

import type {
  BetAudience,
  BetDocumentKind,
  BetLinkKind,
  BetPriority,
  BetStatus,
  BetUpdateKind,
  PipelineRunEventLevel,
  PipelineRunKind,
  PipelineRunStatus,
  ProductAssetKind,
  ProductDocumentKind,
  TaskKind
} from '@/content/internal';
import type { ContentPieceStatus, ContentType, IntegrationCapability, KnowledgeSource } from '@/content/content-engine';
import type { ProductLegalDocumentKey, ProductLegalLabelKey } from '@/content/legal/product-documents';
import type { ProductStatus } from '@/content/products';
import type { ProductAccent } from '@/design/theme';

// Status/kind columns are `text` with a TypeScript union applied via `$type`,
// not PG enums — see ADR-010. The union is enforced at the application edge by
// the zod schemas in src/server/validation, and the content layer
// (src/content/internal) remains the single source of truth for the values.

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  // Nullable: existing accounts predate this column. Required in practice for
  // anyone who needs overdue-task email reminders (see betTasks below).
  email: text('email').unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<'admin' | 'member'>().notNull().default('member'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const bets = pgTable(
  'bets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<BetStatus>().notNull().default('backlog'),
    audience: text('audience').$type<BetAudience>().notNull().default('b2c'),
    priority: text('priority').$type<BetPriority>().notNull().default('medium'),
    // Nullable: a bet can sit in the backlog before anyone owns it. `set null`
    // on delete so removing a user never destroys the bet itself.
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    // Denormalised mirror of `products.slug` for this bet's published product,
    // kept in sync by the publish path. Still not a foreign key: a bet may have
    // no product yet, and deleting a product must not cascade into the bet.
    //
    // Note this is NOT the same string as `bets.slug`. The bet slug is
    // discovery's id (`chain-menu-nutrition-verified`); the product slug is the
    // brand (`ledgerly`). Panel URLs use the bet slug, public URLs the product
    // slug — see docs/engineering.md.
    publicSlug: text('public_slug'),
    // The hunting ground the discovery pipeline found this in ("cooking &
    // nutrition"). Accepted by ingestBetSchema and sent by push_bets.py since
    // day one, but there was no column to put it in, so every push silently
    // dropped it.
    ground: text('ground'),
    // The discovery verdict (PASS / BELOW_BAR / KILL). Now that approved
    // finalists and near-miss watchlist entries both land in `backlog`, this is
    // the only thing left that tells them apart on the board.
    discoveryVerdict: text('discovery_verdict'),
    nextAction: text('next_action'),
    startedAt: date('started_at'),
    targetDate: date('target_date'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' })
  },
  (table) => [index('bets_status_idx').on(table.status), index('bets_owner_idx').on(table.ownerId)]
);

export const betLinks = pgTable(
  'bet_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    betId: uuid('bet_id')
      .notNull()
      .references(() => bets.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<BetLinkKind>().notNull().default('other'),
    label: text('label'),
    url: text('url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('bet_links_bet_idx').on(table.betId)]
);

// Long-form markdown attached to a bet: the build prompt, its spec, its decision
// memo. Stored as text in Postgres rather than as blobs — these are tens of KB
// of markdown, they are read far more often than written, and keeping them in
// the same database means no second service, no signed URLs and no second place
// the data can go missing.
export const betDocuments = pgTable(
  'bet_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    betId: uuid('bet_id')
      .notNull()
      .references(() => bets.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<BetDocumentKind>().notNull().default('other'),
    // The filename as pushed, e.g. interactive-rosary-app.md — shown in the UI
    // and used as the download name.
    name: text('name').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  // One document per kind per bet. The ingest endpoint is called again on every
  // pipeline run, so re-pushing has to replace the prompt rather than stack up
  // copies of it.
  (table) => [uniqueIndex('bet_documents_unique_kind').on(table.betId, table.kind)]
);

export const betUpdates = pgTable(
  'bet_updates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    betId: uuid('bet_id')
      .notNull()
      .references(() => bets.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind').$type<BetUpdateKind>().notNull().default('note'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('bet_updates_bet_created_idx').on(table.betId, table.createdAt)]
);

export const betMetrics = pgTable(
  'bet_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    betId: uuid('bet_id')
      .notNull()
      .references(() => bets.id, { onDelete: 'cascade' }),
    metricKey: text('metric_key').notNull(),
    // numeric, not integer: metrics include MRR and conversion rates, not just
    // follower counts. Drizzle returns this as a string to avoid float loss.
    value: numeric('value').notNull(),
    unit: text('unit'),
    recordedOn: date('recorded_on').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  // One value per metric per bet per day — re-entering a snapshot updates it
  // rather than silently creating a duplicate point on the trend line.
  (table) => [uniqueIndex('bet_metrics_unique_point').on(table.betId, table.metricKey, table.recordedOn)]
);

// Despite the table name, a task no longer has to belong to a bet — betId is
// nullable so the standalone calendar (src/app/internal/(panel)/calendar) can
// hold tasks that aren't tied to any product bet. Kept the original name
// rather than renaming the table, since that would be a destructive operation
// against a live table full of existing rows for a cosmetic gain.
export const betTasks = pgTable(
  'bet_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    betId: uuid('bet_id').references(() => bets.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: text('kind').$type<TaskKind>().notNull().default('general'),
    done: boolean('done').notNull().default(false),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    dueOn: date('due_on'),
    sortOrder: integer('sort_order').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    // Last time an overdue reminder email was sent for this task, so the daily
    // cron doesn't re-email on every run within the same day.
    notifiedOverdueAt: timestamp('notified_overdue_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('bet_tasks_bet_idx').on(table.betId),
    index('bet_tasks_due_idx').on(table.dueOn),
    index('bet_tasks_assignee_idx').on(table.assigneeId)
  ]
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id'),
    action: text('action').$type<'create' | 'update' | 'delete'>().notNull(),
    // Only the changed fields, as { field: { from, to } }. Never a full row —
    // the log should stay readable and small.
    diff: jsonb('diff'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('audit_log_entity_idx').on(table.entity, table.entityId), index('audit_log_created_idx').on(table.createdAt)]
);

// ---------------------------------------------------------------------------
// Content Engine — ported from the b2c-content-agent Python/SQLAlchemy
// backend. Trend → ContentPiece → ContentAsset → Publication → SocialMetric
// traceability, plus KnowledgeEntry/IntegrationConfig, both immutable-version
// chains (never updated in place — a new row is inserted and the previous
// row's supersededById is set, same pattern applied to bets in this repo:
// history over the ability to edit).
// ---------------------------------------------------------------------------

export const apps = pgTable('apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  niche: text('niche').notNull(),
  brandProfile: jsonb('brand_profile').notNull().default({}),
  productProfile: jsonb('product_profile').notNull().default({}),
  audienceProfile: jsonb('audience_profile').notNull().default({}),
  businessGoals: jsonb('business_goals').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const trendSources = pgTable(
  'trend_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platform: text('platform').notNull(),
    niche: text('niche').notNull(),
    sourceUrl: text('source_url').notNull(),
    rawMetrics: jsonb('raw_metrics').notNull().default({}),
    dominantMetric: text('dominant_metric'),
    transcript: text('transcript'),
    sceneBreakdown: jsonb('scene_breakdown').notNull().default([]),
    extractedFormula: jsonb('extracted_formula').notNull().default({}),
    analyzedAt: timestamp('analyzed_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('trend_sources_niche_idx').on(table.niche)]
);

export const contentPieces = pgTable(
  'content_pieces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Owned by the app: deleting an app deletes its pieces, same reasoning as
    // bet_links being cascade-deleted with their bet.
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    contentType: text('content_type').$type<ContentType>().notNull(),
    status: text('status').$type<ContentPieceStatus>().notNull().default('proposed'),
    // Advisory: losing the trend source shouldn't destroy the piece it
    // inspired, same reasoning as bets.ownerId.
    inspiredById: uuid('inspired_by_id').references(() => trendSources.id, { onDelete: 'set null' }),
    angle: text('angle'),
    hookText: text('hook_text'),
    hookType: text('hook_type'),
    script: jsonb('script').notNull().default({}),
    generatedBy: jsonb('generated_by').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    // review-queue-style lookups filter by app + status; the days-window
    // listing filters by app + createdAt — same two access patterns as the
    // original API (`GET /content/review-queue`, `GET /content-pieces`).
    index('content_pieces_app_status_idx').on(table.appId, table.status),
    index('content_pieces_app_created_idx').on(table.appId, table.createdAt)
  ]
);

export const contentAssets = pgTable(
  'content_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentPieceId: uuid('content_piece_id')
      .notNull()
      .references(() => contentPieces.id, { onDelete: 'cascade' }),
    assetType: text('asset_type').notNull(),
    url: text('url').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
    productionMethod: text('production_method').notNull(),
    generationProvider: text('generation_provider'),
    // numeric, not a float type — same reasoning as bet_metrics.value: this is
    // money, and Drizzle returns numeric as a string to avoid float loss.
    generationCostUsd: numeric('generation_cost_usd'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('content_assets_piece_idx').on(table.contentPieceId)]
);

export const galleryItems = pgTable(
  'gallery_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    assetType: text('asset_type').notNull(),
    url: text('url').notNull(),
    description: text('description').notNull(),
    tags: jsonb('tags').notNull().default([]),
    productionMethod: text('production_method').notNull(),
    // Advisory: the gallery item is reusable library material and outlives
    // the piece that first produced it, so losing that piece shouldn't
    // destroy the item — same reasoning as bets.ownerId.
    sourceContentPieceId: uuid('source_content_piece_id').references(() => contentPieces.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('gallery_items_app_type_idx').on(table.appId, table.assetType)]
);

export const knowledgeEntries = pgTable(
  'knowledge_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    principle: text('principle').notNull(),
    source: text('source').$type<KnowledgeSource>().notNull(),
    // null = global principle (applies to any app). Set null rather than
    // cascade if the app disappears: a KnowledgeEntry is deliberately
    // never-deleted history (see supersededById below), so losing its scope
    // app shouldn't take the entry down with it.
    scopeAppId: uuid('scope_app_id').references(() => apps.id, { onDelete: 'set null' }),
    confidence: numeric('confidence').notNull(),
    // Structured fields for a direct join against performance data
    // (`WHERE related_angle = ...`) instead of parsing the free-form
    // `evidence` blob on every read.
    relatedAngle: text('related_angle'),
    relatedHookType: text('related_hook_type'),
    evidence: jsonb('evidence').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    // Immutable versioning: updating a principle never mutates this row — a
    // new row is inserted and this column is set on the old one. Same
    // pattern as integrationConfigs below.
    supersededById: uuid('superseded_by_id').references((): AnyPgColumn => knowledgeEntries.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('knowledge_entries_scope_active_idx').on(table.scopeAppId, table.isActive)]
);

export const publications = pgTable(
  'publications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentPieceId: uuid('content_piece_id')
      .notNull()
      .references(() => contentPieces.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    externalPostId: text('external_post_id'),
    permalink: text('permalink'),
    postedAt: timestamp('posted_at', { withTimezone: true })
  },
  (table) => [index('publications_piece_idx').on(table.contentPieceId)]
);

export const socialMetrics = pgTable(
  'social_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicationId: uuid('publication_id')
      .notNull()
      .references(() => publications.id, { onDelete: 'cascade' }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    views: integer('views').notNull().default(0),
    likes: integer('likes').notNull().default(0),
    comments: integer('comments').notNull().default(0),
    shares: integer('shares').notNull().default(0),
    saves: integer('saves').notNull().default(0),
    reach: integer('reach').notNull().default(0),
    avgWatchTimeS: numeric('avg_watch_time_s')
  },
  // Snapshots, not updates — a Publication accumulates one row per capture,
  // so "most recent snapshot per publication" is (publicationId, capturedAt).
  (table) => [index('social_metrics_publication_captured_idx').on(table.publicationId, table.capturedAt)]
);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentName: text('agent_name').notNull(),
    appId: uuid('app_id').references(() => apps.id, { onDelete: 'set null' }),
    contentPieceId: uuid('content_piece_id').references(() => contentPieces.id, { onDelete: 'set null' }),
    inputContext: jsonb('input_context').notNull().default({}),
    output: jsonb('output').notNull().default({}),
    status: text('status').notNull().default('running'),
    error: text('error'),
    costUsd: numeric('cost_usd'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true })
  },
  (table) => [index('agent_runs_app_idx').on(table.appId)]
);

export const integrationConfigs = pgTable(
  'integration_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // null = global config (applies to any app without its own override).
    appId: uuid('app_id').references(() => apps.id, { onDelete: 'set null' }),
    capability: text('capability').$type<IntegrationCapability>().notNull(),
    provider: text('provider').notNull(),
    // Encrypted at the application layer before it reaches this column —
    // same expectation as the original Python model's `api_key` (cifrada).
    apiKey: text('api_key').notNull(),
    extraConfig: jsonb('extra_config').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    // Immutable versioning, same pattern as knowledgeEntries above.
    supersededById: uuid('superseded_by_id').references((): AnyPgColumn => integrationConfigs.id, { onDelete: 'set null' }),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('integration_configs_capability_active_idx').on(table.capability, table.isActive)]
);

// ---------------------------------------------------------------------------
// Public product content
//
// Supersedes ADR-010's "the public site keeps zero database dependency" — see
// ADR-013 for why that constraint was worth breaking and what replaced it
// (ISR + tag revalidation, so a database outage degrades to a stale page rather
// than a down site). The panel is now the source of truth for what the public
// site shows, which is the whole point: flipping a status in the panel has to
// change something a visitor can see.
// ---------------------------------------------------------------------------

// Localized copy lives in jsonb `{en,es,ca}` columns rather than one row per
// locale. Three reasons specific to this codebase:
//
//  1. server/db/client.ts is explicit that the neon-http driver has no
//     interactive transactions — one statement per round trip. A locale-row
//     schema turns "publish one product" into hundreds of round trips that can
//     half-fail, and the failure mode is a LIVE page with an English hero and
//     no Catalan one. With jsonb the atomic unit is the thing, and every write
//     is a single idempotent upsert, exactly like upsertDocuments in the bets
//     ingest route.
//  2. The validated payload already has this shape — `localized()` in
//     server/validation/apps.ts produces {en,es,ca} — so the column is a 1:1
//     store of it, with no shred-on-write/pivot-on-read layer to lose a locale in.
//  3. The locale set is closed (`routing.locales`), and every read wants all
//     three anyway: buildLanguageAlternates emits hreflang for all three on
//     every page.
//
// Accepted cost: Postgres cannot enforce "all three locales present". The zod
// `localized()` at the edge already requires each one, and the parity script
// checks it for the migrated rows.
export type LocalizedText = { en: string; es: string; ca: string };

// One entry per <p>, matching LegalDocumentView's `body: string[]`.
export type LocalizedParagraphs = { en: string[]; es: string[]; ca: string[] };

// The `page.*` message block every hand-written product page carries. Optional
// as a whole and field by field: a machine-published product ships without most
// of it and the renderer skips the sections it has no copy for, rather than
// printing a heading over an empty body.
export type ProductPageCopy = {
  overview?: { title: LocalizedText; body: LocalizedText };
  capabilitiesTitle?: LocalizedText;
  howItWorks?: { title: LocalizedText; description: LocalizedText; steps: Array<{ title: LocalizedText; description: LocalizedText }> };
  why?: { title: LocalizedText; body: LocalizedText };
  statusBlock?: { title: LocalizedText; body: LocalizedText };
  faq?: { title: LocalizedText; items: Array<{ question: LocalizedText; answer: LocalizedText }> };
  cta?: { title: LocalizedText; description: LocalizedText; primary: LocalizedText; secondary?: LocalizedText };
  brandCta?: LocalizedText;
};

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The BRAND slug, which lives in the flat top-level namespace shared with
    // company legal documents and /contact (ADR-008). The publish route rejects
    // a slug that would shadow one of those.
    slug: text('slug').notNull().unique(),

    // Nullable: the products migrated out of src/content/products predate the
    // pipeline and have no bet. `set null` for the same reason as bets.ownerId —
    // deleting a bet must never destroy a live public page.
    betId: uuid('bet_id').references(() => bets.id, { onDelete: 'set null' }),

    status: text('status').$type<ProductStatus>().notNull().default('draft'),
    accent: text('accent').$type<ProductAccent>().notNull(),

    // THE publication gate. Null = the page 404s and the product is absent from
    // every listing, every nav menu and the sitemap. One column, one predicate,
    // read through exactly one query helper (listPublicProducts) that every
    // public surface calls. That is what makes "no broken links" a property
    // rather than a hope: a product cannot be linked from somewhere that uses a
    // different rule, because there is no different rule.
    publishedAt: timestamp('published_at', { withTimezone: true }),

    // Deliberately distinct from publishedAt. A `ready` product is live and
    // linked but not submitted to search until a human says so, usually at
    // `deployed`. Keeping these separate is what stops the sitemap advertising a
    // page whose own metadata says noindex — which is exactly what sitemap.ts
    // did for padelco, accento and nailio before this. One column now drives
    // both the sitemap filter and the page's robots meta, so they cannot diverge.
    indexable: boolean('indexable').notNull().default(false),

    // Mirrors ProductRecord.links. `live` = the running app on its own domain
    // (the product page's primary CTA); `external` = an off-site marketing page
    // shown only in nav and cards.
    liveUrl: text('live_url'),
    externalUrl: text('external_url'),

    badges: jsonb('badges').$type<string[]>().notNull().default([]),
    supportEmail: text('support_email'),

    name: jsonb('name').$type<LocalizedText>().notNull(),
    // A product carries TWO descriptions and they are genuinely different copy,
    // not a duplicate: `tagline` is the one-line version shown in the navbar's
    // product dropdown ("An AI padel coach launching soon."), while
    // `cardDescription` is the longer blurb on the homepage and /products cards
    // ("An AI coach for padel players, built on the same product discipline as
    // everything else we ship."). They lived in two message namespaces —
    // products.<ns>.description and homepage.products.items.<ns>.description —
    // and collapsing them into one column would silently rewrite every card.
    tagline: jsonb('tagline').$type<LocalizedText>().notNull(),
    cardDescription: jsonb('card_description').$type<LocalizedText>().notNull(),
    heroTitle: jsonb('hero_title').$type<LocalizedText>().notNull(),
    heroDescription: jsonb('hero_description').$type<LocalizedText>().notNull(),
    seoTitle: jsonb('seo_title').$type<LocalizedText>().notNull(),
    seoDescription: jsonb('seo_description').$type<LocalizedText>().notNull(),

    pageCopy: jsonb('page_copy').$type<ProductPageCopy | null>(),

    // product-agent's `store` block, recorded verbatim and never rendered: every
    // App Store Connect field the store stage filled in (SKU, team id, category,
    // age rating, App ID capabilities, subscription group).
    //
    // It lives here rather than on the run because it describes the PRODUCT, and
    // because the build handoff has to be able to read it long after the run that
    // produced it has been pruned. Opaque jsonb on purpose — this side has no
    // business having opinions about App Store Connect's field list, which
    // product-agent's docs/fields-stores.md owns.
    storeMetadata: jsonb('store_metadata').$type<Record<string, unknown> | null>(),

    // Provenance: which run wrote this page. `sourceRunId` is the pipeline_runs
    // uuid; `sourceExternalRunId` is product-agent's own run id ("2026-W40"),
    // which names the directory its artifacts live in. Both are needed — one
    // addresses the row, the other addresses the files. Not a foreign key, so
    // pruning run history never blanks a live page's provenance.
    sourceRunId: uuid('source_run_id'),
    sourceExternalRunId: text('source_external_run_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('products_published_idx').on(table.publishedAt), index('products_bet_idx').on(table.betId)]
);

// 1:N and ordered, so a table rather than a jsonb array on `products`: the panel
// edits one feature at a time and the ingest route replaces the set
// idempotently, and neither is comfortable read-modify-writing a JSON array on a
// driver with no transactions.
export const productFeatures = pgTable(
  'product_features',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    // camelCase identifier, the same constraint featureSchema already enforces
    // at the edge. Stable across re-pushes, which is what makes the upsert
    // idempotent.
    key: text('key').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    title: jsonb('title').$type<LocalizedText>().notNull(),
    description: jsonb('description').$type<LocalizedText>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  // Same reasoning as bet_documents_unique_kind: re-running a stage must replace
  // the feature, not stack a second copy of it.
  (table) => [uniqueIndex('product_features_unique_key').on(table.productId, table.key)]
);

export const productLegalDocs = pgTable(
  'product_legal_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    docKey: text('doc_key').$type<ProductLegalDocumentKey>().notNull(),
    // The URL segment: /{locale}/{product.slug}/legal/{slug}. Distinct from
    // docKey because `aiPolicy` renders as `ai-policy`.
    slug: text('slug').notNull(),
    // Overrides the `common.legalDocLabels.*` key used for this document's link.
    // `termsEula` exists because a terms document that doubles as an App Store
    // EULA has to say so in the link text, while company-wide terms must not.
    labelKey: text('label_key').$type<ProductLegalLabelKey>(),
    // One date across all three locales: a legal document has one "last updated"
    // fact, not one per language.
    lastUpdated: date('last_updated').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    title: jsonb('title').$type<LocalizedText>().notNull(),
    description: jsonb('description').$type<LocalizedText>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('product_legal_documents_unique_key').on(table.productId, table.docKey),
    // The link the product page renders and the URL the legal route resolves come
    // from the same row, and this index makes that URL unambiguous. Together they
    // make "every legal URL we link resolves" true by construction rather than by
    // test — which matters because a legal URL that 404s is an App Store rejection.
    uniqueIndex('product_legal_documents_unique_slug').on(table.productId, table.slug)
  ]
);

// Sections are rows, unlike src/content/legal/product-legal.ts which stores
// section ids only and puts the prose in the message files. They are ordered,
// numerous (speaklio's terms has 21) and independently editable in the panel.
export const productLegalSections = pgTable(
  'product_legal_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => productLegalDocs.id, { onDelete: 'cascade' }),
    // camelCase, and also the in-page anchor id rendered by LegalDocumentView
    // and linked from its table of contents.
    key: text('key').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    title: jsonb('title').$type<LocalizedText>().notNull(),
    body: jsonb('body').$type<LocalizedParagraphs>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex('product_legal_sections_unique_key').on(table.documentId, table.key)]
);

// Icons, the logo, screenshots, social cards. The bytes live in Vercel Blob and
// this row is the index. ADR-011 argued documents belong in Postgres because
// they are markdown read as text; that reasoning does not transfer to a
// 1024x1024 PNG, which is a genuine file upload.
export const productAssets = pgTable(
  'product_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<ProductAssetKind>().notNull(),
    url: text('url').notNull(),
    // The blob pathname, kept so the object can be deleted when the row goes. A
    // URL is not a handle; storing only the URL orphans the blob.
    pathname: text('pathname').notNull(),
    contentType: text('content_type').notNull(),
    width: integer('width'),
    height: integer('height'),
    bytes: integer('bytes').notNull().default(0),
    // sha256 of the uploaded bytes. publish_product.py records the same digest
    // from disk, so "the icon on the site is the icon the run rendered" is a
    // string comparison rather than a visual check.
    checksum: text('checksum'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  // (kind, sortOrder) is the slot: an icon has one, a screenshot has six.
  // Re-running a stage replaces slot 3 rather than appending a seventh.
  (table) => [uniqueIndex('product_assets_unique_slot').on(table.productId, table.kind, table.sortOrder)]
);

// The markdown a product is built from. Same reasoning as bet_documents and the
// same storage decision (ADR-011): these are documents read as text, so Postgres
// rather than blob storage.
//
// Why it exists: the ingest carried feature titles, legal prose and images and
// nothing else, so everything a builder actually needs to implement a feature —
// the specification, the requirements, the identity — stayed on the machine that
// ran the product stage. `build.json` handed over ten feature names with no
// specification behind any of them. A marketing agent asking for the App Store
// listing had no route to it at all.
export const productDocuments = pgTable(
  'product_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    // The document's ROLE. Ten feature specs share `feature`; `path` tells them apart.
    kind: text('kind').$type<ProductDocumentKind>().notNull().default('other'),
    // Path relative to the bet directory, e.g. product/features/F-01-traceable-import.md.
    // This is the identity of the document, which is why the unique index is on it: a run
    // that renames a feature file should replace that file, not accumulate both spellings.
    path: text('path').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    // sha256 of the content, so a consumer can tell "unchanged" from "re-pushed"
    // without diffing 12KB of markdown.
    checksum: text('checksum'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('product_documents_unique_path').on(table.productId, table.path),
    index('product_documents_product_kind_idx').on(table.productId, table.kind)
  ]
);

// ---------------------------------------------------------------------------
// Pipeline runs
//
// The job queue. The panel enqueues; a poller inside product-agent claims over
// HTTP. Not a hosted queue service: there is exactly one consumer, the work
// takes hours (far past any serverless timeout), and the runner is a Python
// process on a laptop that has to survive being closed. A row in the database
// the panel already reads is the smallest thing that is honest about all three.
// ---------------------------------------------------------------------------

export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // NULLABLE: a `discovery` run hunts markets and has no bet — it PRODUCES
    // bets. Only product-agent and build runs belong to one.
    betId: uuid('bet_id').references(() => bets.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<PipelineRunKind>().notNull(),
    status: text('status').$type<PipelineRunStatus>().notNull().default('queued'),

    // Set when a run reports `blocked` — a Claude usage or spend limit ended the
    // session. The run returns to `queued` and the claim query refuses to hand it
    // out again until this passes, so an unattended scheduler stops re-running a
    // job every window just to rediscover the quota is still closed. Read from
    // the CLI's own rate_limit_event, which carries an exact epoch.
    retryAfter: timestamp('retry_after', { withTimezone: true }),
    blockedReason: text('blocked_reason'),

    // {publishLegal, createFeatures, externalRunId, stages, force, ...}.
    // Validated by zod at both edges; jsonb here because each `kind` has a
    // different and growing parameter set, and a column per flag would be a
    // migration per flag.
    params: jsonb('params').$type<Record<string, unknown>>().notNull().default({}),
    // Bumped when the descriptor's shape changes, so an old runner can refuse a
    // job it would misread rather than half-execute it.
    descriptorVersion: integer('descriptor_version').notNull().default(1),

    runnerId: text('runner_id'),
    attempt: integer('attempt').notNull().default(0),
    // 3, not 1. Claiming sets attempt = 1, so `attempt < maxAttempts` in the
    // reaper was false on the FIRST lease expiry and every stranded run went
    // straight to `expired`/"giving up" — the whole lease-and-reap recovery
    // mechanism was inert. A quota block does not consume an attempt (it sets
    // retry_after and re-queues), so these three are spent only on a runner that
    // actually stopped reporting, which is exactly the case worth retrying.
    maxAttempts: integer('max_attempts').notNull().default(3),

    // {stage, stageIndex, stageCount, note} — the last heartbeat, denormalised
    // onto the run so the list view renders progress without joining events.
    progress: jsonb('progress').$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb('result').$type<Record<string, unknown> | null>(),
    error: text('error'),

    // product-agent's own run id ("2026-W40"), which names the directory its
    // artifacts live in. Distinct from `id`; both are needed.
    externalRunId: text('external_run_id'),
    logUrl: text('log_url'),

    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }),
    // A lease, not a timeout: the runner extends it while it works and the
    // reaper requeues anything past it. This is what makes a closed laptop
    // recoverable without a human noticing a run is wedged.
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    // Set by an admin hitting Cancel. The runner sees it on its next heartbeat
    // and writes its STOP file, reusing product-agent's existing
    // halt-at-a-session-boundary convention rather than being killed mid-stage.
    cancelRequestedAt: timestamp('cancel_requested_at', { withTimezone: true }),

    requestedById: uuid('requested_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    // The claim query's exact shape: WHERE status='queued' AND kind = ANY(...)
    // ORDER BY queued_at.
    index('pipeline_runs_claim_idx').on(table.status, table.kind, table.queuedAt),
    index('pipeline_runs_bet_idx').on(table.betId, table.createdAt),
    // One active run per (bet, kind), enforced by Postgres rather than by the
    // button being disabled. Double-clicking "Run product agent", or two admins
    // clicking at once, is a constraint violation the action turns into a
    // message — not two runners fighting over one bet. The predicate matches
    // activePipelineRunStatuses in content/internal/pipeline-run.ts; keep them
    // in step.
    // Postgres treats NULLs as distinct in a unique index, so this constrains
    // bet-scoped kinds only — which is right: `discovery` runs have a null betId
    // and several may legitimately be queued at once. Discovery's own
    // one-at-a-time rule is enforced separately, by run id.
    uniqueIndex('pipeline_runs_one_active')
      .on(table.betId, table.kind)
      .where(sql`${table.status} in ('queued', 'claimed', 'running', 'blocked')`)
  ]
);

// The run timeline the panel renders. Separate from the run so a chatty stage
// never rewrites a hot row, and so events survive a retry that resets progress.
export const pipelineRunEvents = pgTable(
  'pipeline_run_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: 'cascade' }),
    // Supplied by the runner, not defaulted to now(): events are batched and
    // shipped after the fact, so the wall-clock time they arrive is not the time
    // they happened.
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    level: text('level').$type<PipelineRunEventLevel>().notNull().default('info'),
    stage: text('stage'),
    message: text('message').notNull(),
    data: jsonb('data').$type<Record<string, unknown> | null>()
  },
  (table) => [index('pipeline_run_events_run_at_idx').on(table.runId, table.at)]
);

/**
 * One row per machine that polls for work. Not a runs table — a liveness table.
 *
 * A scheduler that stops running says nothing, and nothing is exactly what an
 * empty queue looks like: the panel showed no failures for four days while the
 * laptop was not running at all. The only way to tell "nobody queued anything"
 * apart from "nobody is listening" is for the listener to leave a mark, so the
 * claim route stamps this on EVERY poll, including the ones that find no work.
 */
export const pipelineRunners = pgTable('pipeline_runners', {
  // The runner's own id (`laptop-marti`), not a surrogate key. There is exactly
  // one row per machine and the machine chooses its own name, so a natural key
  // makes the upsert a one-liner and duplicates impossible.
  runnerId: text('runner_id').primaryKey(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastClaimedRunId: uuid('last_claimed_run_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const usersRelations = relations(users, ({ many }) => ({
  ownedBets: many(bets),
  requestedPipelineRuns: many(pipelineRuns)
}));

export const betsRelations = relations(bets, ({ one, many }) => ({
  owner: one(users, { fields: [bets.ownerId], references: [users.id] }),
  links: many(betLinks),
  documents: many(betDocuments),
  updates: many(betUpdates),
  metrics: many(betMetrics),
  tasks: many(betTasks),
  products: many(products),
  pipelineRuns: many(pipelineRuns)
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  bet: one(bets, { fields: [products.betId], references: [bets.id] }),
  features: many(productFeatures),
  legalDocuments: many(productLegalDocs),
  assets: many(productAssets),
  documents: many(productDocuments)
}));

export const productDocumentsRelations = relations(productDocuments, ({ one }) => ({
  product: one(products, { fields: [productDocuments.productId], references: [products.id] })
}));

export const productFeaturesRelations = relations(productFeatures, ({ one }) => ({
  product: one(products, { fields: [productFeatures.productId], references: [products.id] })
}));

export const productLegalDocsRelations = relations(productLegalDocs, ({ one, many }) => ({
  product: one(products, { fields: [productLegalDocs.productId], references: [products.id] }),
  sections: many(productLegalSections)
}));

export const productLegalSectionsRelations = relations(productLegalSections, ({ one }) => ({
  document: one(productLegalDocs, { fields: [productLegalSections.documentId], references: [productLegalDocs.id] })
}));

export const productAssetsRelations = relations(productAssets, ({ one }) => ({
  product: one(products, { fields: [productAssets.productId], references: [products.id] })
}));

export const pipelineRunsRelations = relations(pipelineRuns, ({ one, many }) => ({
  bet: one(bets, { fields: [pipelineRuns.betId], references: [bets.id] }),
  requestedBy: one(users, { fields: [pipelineRuns.requestedById], references: [users.id] }),
  events: many(pipelineRunEvents)
}));

export const pipelineRunEventsRelations = relations(pipelineRunEvents, ({ one }) => ({
  run: one(pipelineRuns, { fields: [pipelineRunEvents.runId], references: [pipelineRuns.id] })
}));

export const betDocumentsRelations = relations(betDocuments, ({ one }) => ({
  bet: one(bets, { fields: [betDocuments.betId], references: [bets.id] })
}));

export const betLinksRelations = relations(betLinks, ({ one }) => ({
  bet: one(bets, { fields: [betLinks.betId], references: [bets.id] })
}));

export const betUpdatesRelations = relations(betUpdates, ({ one }) => ({
  bet: one(bets, { fields: [betUpdates.betId], references: [bets.id] }),
  author: one(users, { fields: [betUpdates.authorId], references: [users.id] })
}));

export const betMetricsRelations = relations(betMetrics, ({ one }) => ({
  bet: one(bets, { fields: [betMetrics.betId], references: [bets.id] })
}));

export const betTasksRelations = relations(betTasks, ({ one }) => ({
  bet: one(bets, { fields: [betTasks.betId], references: [bets.id] }),
  assignee: one(users, { fields: [betTasks.assigneeId], references: [users.id] })
}));

export const appsRelations = relations(apps, ({ many }) => ({
  contentPieces: many(contentPieces),
  galleryItems: many(galleryItems),
  knowledgeEntries: many(knowledgeEntries),
  agentRuns: many(agentRuns),
  integrationConfigs: many(integrationConfigs)
}));

export const trendSourcesRelations = relations(trendSources, ({ many }) => ({
  inspiredPieces: many(contentPieces)
}));

export const contentPiecesRelations = relations(contentPieces, ({ one, many }) => ({
  app: one(apps, { fields: [contentPieces.appId], references: [apps.id] }),
  inspiredBy: one(trendSources, { fields: [contentPieces.inspiredById], references: [trendSources.id] }),
  assets: many(contentAssets),
  galleryItems: many(galleryItems),
  publications: many(publications),
  agentRuns: many(agentRuns)
}));

export const contentAssetsRelations = relations(contentAssets, ({ one }) => ({
  contentPiece: one(contentPieces, { fields: [contentAssets.contentPieceId], references: [contentPieces.id] })
}));

export const galleryItemsRelations = relations(galleryItems, ({ one }) => ({
  app: one(apps, { fields: [galleryItems.appId], references: [apps.id] }),
  sourceContentPiece: one(contentPieces, { fields: [galleryItems.sourceContentPieceId], references: [contentPieces.id] })
}));

export const knowledgeEntriesRelations = relations(knowledgeEntries, ({ one, many }) => ({
  scopeApp: one(apps, { fields: [knowledgeEntries.scopeAppId], references: [apps.id] }),
  supersededBy: one(knowledgeEntries, {
    fields: [knowledgeEntries.supersededById],
    references: [knowledgeEntries.id],
    relationName: 'knowledgeEntrySupersession'
  }),
  supersedes: many(knowledgeEntries, { relationName: 'knowledgeEntrySupersession' })
}));

export const publicationsRelations = relations(publications, ({ one, many }) => ({
  contentPiece: one(contentPieces, { fields: [publications.contentPieceId], references: [contentPieces.id] }),
  socialMetrics: many(socialMetrics)
}));

export const socialMetricsRelations = relations(socialMetrics, ({ one }) => ({
  publication: one(publications, { fields: [socialMetrics.publicationId], references: [publications.id] })
}));

export const agentRunsRelations = relations(agentRuns, ({ one }) => ({
  app: one(apps, { fields: [agentRuns.appId], references: [apps.id] }),
  contentPiece: one(contentPieces, { fields: [agentRuns.contentPieceId], references: [contentPieces.id] })
}));

export const integrationConfigsRelations = relations(integrationConfigs, ({ one, many }) => ({
  app: one(apps, { fields: [integrationConfigs.appId], references: [apps.id] }),
  supersededBy: one(integrationConfigs, {
    fields: [integrationConfigs.supersededById],
    references: [integrationConfigs.id],
    relationName: 'integrationConfigSupersession'
  }),
  supersedes: many(integrationConfigs, { relationName: 'integrationConfigSupersession' })
}));

export type UserRow = typeof users.$inferSelect;
export type BetRow = typeof bets.$inferSelect;
export type BetLinkRow = typeof betLinks.$inferSelect;
export type BetDocumentRow = typeof betDocuments.$inferSelect;
export type BetUpdateRow = typeof betUpdates.$inferSelect;
export type BetMetricRow = typeof betMetrics.$inferSelect;
export type BetTaskRow = typeof betTasks.$inferSelect;

export type ProductRow = typeof products.$inferSelect;
export type ProductFeatureRow = typeof productFeatures.$inferSelect;
export type ProductLegalDocRow = typeof productLegalDocs.$inferSelect;
export type ProductLegalSectionRow = typeof productLegalSections.$inferSelect;
export type ProductAssetRow = typeof productAssets.$inferSelect;
export type PipelineRunRow = typeof pipelineRuns.$inferSelect;
export type PipelineRunEventRow = typeof pipelineRunEvents.$inferSelect;
export type PipelineRunnerRow = typeof pipelineRunners.$inferSelect;

export type NewProductRow = typeof products.$inferInsert;
export type NewProductFeatureRow = typeof productFeatures.$inferInsert;
export type NewProductLegalDocRow = typeof productLegalDocs.$inferInsert;
export type NewProductLegalSectionRow = typeof productLegalSections.$inferInsert;

export type AppRow = typeof apps.$inferSelect;
export type TrendSourceRow = typeof trendSources.$inferSelect;
export type ContentPieceRow = typeof contentPieces.$inferSelect;
export type ContentAssetRow = typeof contentAssets.$inferSelect;
export type GalleryItemRow = typeof galleryItems.$inferSelect;
export type KnowledgeEntryRow = typeof knowledgeEntries.$inferSelect;
export type PublicationRow = typeof publications.$inferSelect;
export type SocialMetricRow = typeof socialMetrics.$inferSelect;
export type AgentRunRow = typeof agentRuns.$inferSelect;
export type IntegrationConfigRow = typeof integrationConfigs.$inferSelect;
