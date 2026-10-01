import { relations, sql } from 'drizzle-orm';
import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';

import type {
  AccountCredentialType,
  AccountProvider,
  AccountStatus,
  BetAudience,
  BetDocumentKind,
  BetLinkKind,
  BetPriority,
  BetStatus,
  BetUpdateKind,
  DeployTarget,
  PipelineRunEventLevel,
  PipelineRunKind,
  PipelineRunStatus,
  ProductDocumentKind,
  StoredProductAssetKind,
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

export const appFunnelMetrics = pgTable(
  'app_funnel_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    // Weekly buckets (Monday), not daily — App Store Connect and TikTok
    // analytics are both noisy day to day for apps this size; a week is the
    // smallest window worth eyeballing for a funnel trend.
    periodStart: date('period_start').notNull(),
    // TikTok side of the funnel: organic content -> profile -> bio link.
    tiktokViews: integer('tiktok_views').notNull().default(0),
    tiktokProfileVisits: integer('tiktok_profile_visits').notNull().default(0),
    tiktokLinkClicks: integer('tiktok_link_clicks').notNull().default(0),
    // App Store Connect side: the link lands on the product page, which
    // converts to a download.
    appStoreProductPageViews: integer('app_store_product_page_views').notNull().default(0),
    appStoreDownloads: integer('app_store_downloads').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    // One entry per app per week: entering a week that already has data
    // updates it rather than creating a duplicate row.
    uniqueIndex('app_funnel_metrics_app_period_idx').on(table.appId, table.periodStart),
    index('app_funnel_metrics_app_idx').on(table.appId)
  ]
);

export const appStoreConnectConfigs = pgTable('app_store_connect_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  // One config per app — a second save overwrites it (see saveAppStoreConnectConfig).
  appId: uuid('app_id')
    .notNull()
    .unique()
    .references(() => apps.id, { onDelete: 'cascade' }),
  issuerId: text('issuer_id').notNull(),
  keyId: text('key_id').notNull(),
  // AES-256-GCM ciphertext (iv:authTag:data, base64) — see server/integrations/crypto.ts.
  // The .p8 private key is the one genuinely sensitive value here; issuer/key
  // ids and the vendor/app ids are identifiers, not secrets.
  privateKeyEncrypted: text('private_key_encrypted').notNull(),
  // Sales Reports are scoped by vendor number; Analytics/Sales rows are
  // filtered down to this one app by its numeric Apple ID.
  vendorNumber: text('vendor_number').notNull(),
  ascAppId: text('asc_app_id').notNull(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastSyncError: text('last_sync_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

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

    // The public store listings, set by hand in the panel once the app ships.
    // Distinct from storeMetadata, which is what product-agent PLANNED to submit;
    // these are where the app actually is. `appStoreId` is parsed out of the URL
    // once so the page's Smart App Banner never has to re-parse it, and
    // `storeSyncedAt` is when the icon and screenshots were last imported from
    // the listing (server/products/app-store-import.ts). Play has no public
    // lookup API, so a Play URL is only ever a link.
    appStoreUrl: text('app_store_url'),
    appStoreId: text('app_store_id'),
    playStoreUrl: text('play_store_url'),
    storeSyncedAt: timestamp('store_synced_at', { withTimezone: true }),

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
    kind: text('kind').$type<StoredProductAssetKind>().notNull(),
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

    // The claim query refuses to hand the run out before this. A Claude limit
    // does NOT set it — that limit belongs to the account, which is marked
    // limited instead, so the run can continue at once on another account. It is
    // set when what ran out is something the pool cannot swap right now (every
    // EAS account at quota), so the run is not re-claimed every poll just to
    // rediscover that.
    retryAfter: timestamp('retry_after', { withTimezone: true }),
    // Why the run is paused, in words ("Claude limit on max-2 until 03:20").
    // Named for the status it used to describe; kept to avoid a column rename.
    blockedReason: text('blocked_reason'),

    // The fencing token. A fresh uuid on every claim; every runner write carries
    // it and every write is `WHERE lease_token = $token` in the same statement.
    // A process whose lease was reaped and handed to another machine holds a
    // stale token, so its writes match nothing and get a 409 — it cannot
    // overwrite the new holder between a check and a write.
    leaseToken: uuid('lease_token'),
    // Sessions this run has used: +1 on every claim. "Paused ×N" on the board.
    sessionCount: integer('session_count').notNull().default(0),
    // Higher first. Paused runs already go before queued ones at equal priority.
    priority: integer('priority').notNull().default(0),
    // The last checkpoint the orchestrator uploaded: {parts:[{pathname,bytes}],
    // sha256, bytes, runnerId, createdAt, sessionSeq}. A claim on another
    // machine restores from it; the machine that wrote it skips the download.
    checkpoint: jsonb('checkpoint').$type<Record<string, unknown> | null>(),

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
    // `attempt` counts lapsed leases, not claims: the reaper increments it. A
    // claim does not — a run that pauses on account limits ten times has used
    // ten sessions (`session_count`), not ten attempts, and must never be given
    // up on for it. The third lapsed lease expires the run.
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
    index('pipeline_runs_lease_token_idx').on(table.leaseToken),
    index('pipeline_runs_bet_idx').on(table.betId, table.createdAt),
    // One active run per (bet, kind), enforced by Postgres rather than by the
    // button being disabled. Double-clicking "Run product agent", or two admins
    // clicking at once, is a constraint violation the action turns into a
    // message — not two runners fighting over one bet. The predicate matches
    // activePipelineRunStatuses in content/internal/pipeline-run.ts; keep them
    // in step.
    // Postgres treats NULLs as distinct in a unique index, so this constrains
    // bet-scoped kinds only — which is right: `discovery` runs have a null betId
    // and several may legitimately be queued at once.
    uniqueIndex('pipeline_runs_one_active')
      .on(table.betId, table.kind)
      .where(sql`${table.status} in ('queued', 'claimed', 'running', 'paused')`),
    // Discovery's one-in-flight rule: several may be QUEUED, one may be past the
    // queue. The claim query already skips a discovery run while another is in
    // flight; this is the backstop for two claims racing on two machines — the
    // loser's UPDATE is a unique violation, which the claim route answers 204.
    uniqueIndex('pipeline_runs_one_discovery_in_flight')
      .on(table.kind)
      .where(sql`${table.betId} is null and ${table.status} in ('claimed', 'running', 'paused')`)
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
  // Reported by idion-orchestrator on every claim, for the Machines section.
  // All optional: a legacy runner sends none of them.
  host: text('host'),
  version: text('version'),
  capacity: integer('capacity'),
  activeRuns: integer('active_runs'),
  kinds: jsonb('kinds').$type<string[] | null>(),
  // {claude, eas, supabase, fastlane, node, git} versions from `doctor`.
  tools: jsonb('tools').$type<Record<string, string | null> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ---------------------------------------------------------------------------
// The account pool
// ---------------------------------------------------------------------------

/**
 * One account of one provider (a Claude subscription, an Expo account, a
 * Supabase org, the Apple team). See content/internal/provider-accounts.ts.
 *
 * The secret is encrypted at rest (server/vault) and write-only from the panel:
 * it can be pasted or replaced, never read back. The only reader is a runner
 * holding a lease on the account, and only in the lease response.
 */
export const providerAccounts = pgTable(
  'provider_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').$type<AccountProvider>().notNull(),
    // What humans call it: "max-1", "expo-mesquius2".
    label: text('label').notNull(),
    // The email / Expo owner / Supabase org id / Apple team id.
    identity: text('identity'),
    credentialType: text('credential_type').$type<AccountCredentialType>().notNull(),
    // AES-256-GCM, iv:authTag:data base64 — server/vault/crypto.ts.
    secretEncrypted: text('secret_encrypted').notNull(),
    // Last 4 characters, so a human can tell two tokens apart without seeing either.
    secretHint: text('secret_hint'),
    plan: text('plan'),
    status: text('status').$type<AccountStatus>().notNull().default('active'),
    // How many jobs may hold this account at once. 1 for a Claude subscription:
    // parallel jobs on one subscription only drain the same window faster.
    maxConcurrency: integer('max_concurrency').notNull().default(1),
    // Live lease count, maintained in the SAME statements that take and release
    // leases. A column on the account row rather than a count(*) over leases
    // because the claim locks the account row FOR UPDATE SKIP LOCKED, and
    // Postgres re-checks a locked row's own columns against the WHERE clause —
    // so two machines can never both see "0 < 1" for one account. The reaper
    // re-derives it from account_leases as a self-heal.
    activeLeases: integer('active_leases').notNull().default(0),
    // Set when a session on this account hits its limit: the parsed reset time
    // (5-hour window, weekly window, EAS billing cycle). Null = not limited.
    limitedUntil: timestamp('limited_until', { withTimezone: true }),
    limitReason: text('limit_reason'),
    // Provider-specific usage: EAS {used, limit, cycleResetAt}, Supabase
    // {projects, limit}.
    quota: jsonb('quota').$type<Record<string, unknown>>().notNull().default({}),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    notes: text('notes'),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('provider_accounts_provider_label_idx').on(table.provider, table.label),
    index('provider_accounts_pick_idx').on(table.provider, table.status, table.lastUsedAt)
  ]
);

/**
 * Who holds which account. Rows are never deleted: a released lease keeps
 * `released_at`, which is the account's usage history.
 *
 * A lease lives exactly as long as the run lease it was taken under — same
 * token, extended by the same heartbeat, released by the same pause/complete,
 * reaped by the same reaper.
 */
export const accountLeases = pgTable(
  'account_leases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => providerAccounts.id, { onDelete: 'cascade' }),
    runId: uuid('run_id').references(() => pipelineRuns.id, { onDelete: 'set null' }),
    runnerId: text('runner_id').notNull(),
    // The run's lease_token when it was taken.
    leaseToken: uuid('lease_token').notNull(),
    // 'session' (the Claude account a claim came with), or the provider a
    // platform stage asked for: 'eas', 'supabase', 'apple'.
    purpose: text('purpose').notNull().default('session'),
    leasedAt: timestamp('leased_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    releasedAt: timestamp('released_at', { withTimezone: true })
  },
  (table) => [
    index('account_leases_account_idx').on(table.accountId, table.releasedAt),
    index('account_leases_token_idx').on(table.leaseToken),
    index('account_leases_run_idx').on(table.runId)
  ]
);

/**
 * One row per session a run used: claimed with an account, ended by a limit,
 * a finish, a failure or a lost lease. The job page's session timeline.
 */
export const runSessions = pgTable(
  'run_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: 'cascade' }),
    // 1-based, equal to the run's session_count when it started.
    seq: integer('seq').notNull(),
    accountId: uuid('account_id').references(() => providerAccounts.id, { onDelete: 'set null' }),
    runnerId: text('runner_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    // completed | limit | failed | cancelled | lease_lost
    endReason: text('end_reason'),
    // {inputTokens, outputTokens, costUsd, claudeSessions} as the orchestrator totals it.
    usage: jsonb('usage').$type<Record<string, unknown> | null>()
  },
  (table) => [uniqueIndex('run_sessions_run_seq_idx').on(table.runId, table.seq)]
);

/**
 * Where an app lives once built: its backend and its store identity. One row
 * per bet, written by the build's backend and release stages — and by a human
 * in the Backend card when the deploy target is `deferred`.
 */
export const appDeployments = pgTable('app_deployments', {
  betId: uuid('bet_id')
    .primaryKey()
    .references(() => bets.id, { onDelete: 'cascade' }),
  deployTarget: text('deploy_target').$type<DeployTarget>().notNull().default('supabase'),
  bundleId: text('bundle_id'),
  // App Store Connect's numeric app id — `submit.production.ios.ascAppId`.
  ascAppId: text('asc_app_id'),
  // The EAS account the app is linked to. A release prefers it, so an app only
  // changes account (and version) when this one is out of builds.
  easAccountId: uuid('eas_account_id').references(() => providerAccounts.id, { onDelete: 'set null' }),
  easOwner: text('eas_owner'),
  easProjectId: text('eas_project_id'),
  // Marketing version (1.0.3). Bumped on every EAS account switch.
  appVersion: text('app_version'),
  supabaseAccountId: uuid('supabase_account_id').references(() => providerAccounts.id, { onDelete: 'set null' }),
  supabaseProjectRef: text('supabase_project_ref'),
  supabaseUrl: text('supabase_url'),
  // The publishable/anon key — public by design, it ships inside the app.
  supabaseAnonKey: text('supabase_anon_key'),
  // {id, url, status, version, buildNumber, submissionId, finishedAt}
  lastBuild: jsonb('last_build').$type<Record<string, unknown> | null>(),
  // Monetization (the build's monetization stage, from the app's monetization.json).
  ascSubscriptionGroupId: text('asc_subscription_group_id'),
  revenuecatProjectId: text('revenuecat_project_id'),
  revenuecatAppId: text('revenuecat_app_id'),
  // The `appl_` SDK key — public by design, it ships inside the app.
  revenuecatPublicKey: text('revenuecat_public_key'),
  // The per-app webhook Authorization value, sealed with the account vault
  // (server/vault/crypto.ts). Revealed only to admins (deferred backends set it
  // on their own Supabase) and to the run that owns the app.
  revenuecatWebhookSecretEncrypted: text('revenuecat_webhook_secret_encrypted'),
  // {asc: {groupId, subscriptions: {productId: {id, state, territoriesPriced, …}}},
  //  revenuecat: {projectId, appId, offerings}, billingEnabled, blockers}
  monetizationState: jsonb('monetization_state').$type<Record<string, unknown> | null>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * One row per bet per day: RevenueCat's overview metrics for the app's
 * project, written by the daily /api/cron/revenuecat-metrics. The bet page's
 * Monetization card draws its sparklines from here.
 */
export const revenueSnapshots = pgTable(
  'revenue_snapshots',
  {
    betId: uuid('bet_id')
      .notNull()
      .references(() => bets.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    mrr: numeric('mrr', { precision: 12, scale: 2 }),
    revenue28d: numeric('revenue_28d', { precision: 12, scale: 2 }),
    activeSubscriptions: integer('active_subscriptions'),
    activeTrials: integer('active_trials'),
    newCustomers28d: integer('new_customers_28d'),
    activeUsers28d: integer('active_users_28d'),
    // Every metric RevenueCat returned, by id, for anything not promoted to a column.
    raw: jsonb('raw').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.betId, table.date] })]
);

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
  events: many(pipelineRunEvents),
  sessions: many(runSessions)
}));

export const runSessionsRelations = relations(runSessions, ({ one }) => ({
  run: one(pipelineRuns, { fields: [runSessions.runId], references: [pipelineRuns.id] }),
  account: one(providerAccounts, { fields: [runSessions.accountId], references: [providerAccounts.id] })
}));

export const providerAccountsRelations = relations(providerAccounts, ({ many }) => ({
  leases: many(accountLeases),
  sessions: many(runSessions)
}));

export const accountLeasesRelations = relations(accountLeases, ({ one }) => ({
  account: one(providerAccounts, { fields: [accountLeases.accountId], references: [providerAccounts.id] }),
  run: one(pipelineRuns, { fields: [accountLeases.runId], references: [pipelineRuns.id] })
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
  integrationConfigs: many(integrationConfigs),
  funnelMetrics: many(appFunnelMetrics),
  appStoreConnectConfig: many(appStoreConnectConfigs)
}));

export const appFunnelMetricsRelations = relations(appFunnelMetrics, ({ one }) => ({
  app: one(apps, { fields: [appFunnelMetrics.appId], references: [apps.id] })
}));

export const appStoreConnectConfigsRelations = relations(appStoreConnectConfigs, ({ one }) => ({
  app: one(apps, { fields: [appStoreConnectConfigs.appId], references: [apps.id] })
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
export type ProviderAccountRow = typeof providerAccounts.$inferSelect;
export type AccountLeaseRow = typeof accountLeases.$inferSelect;
export type RunSessionRow = typeof runSessions.$inferSelect;
export type AppDeploymentRow = typeof appDeployments.$inferSelect;
export type RevenueSnapshotRow = typeof revenueSnapshots.$inferSelect;

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
