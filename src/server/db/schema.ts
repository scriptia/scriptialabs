import { relations } from 'drizzle-orm';
import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';

import type { BetAudience, BetDocumentKind, BetLinkKind, BetPriority, BetStatus, BetUpdateKind } from '@/content/internal';
import type { ContentPieceStatus, ContentType, IntegrationCapability, KnowledgeSource } from '@/content/content-engine';

// Status/kind columns are `text` with a TypeScript union applied via `$type`,
// not PG enums — see ADR-010. The union is enforced at the application edge by
// the zod schemas in src/server/validation, and the content layer
// (src/content/internal) remains the single source of truth for the values.

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
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
    // Advisory pointer to a slug in src/content/products. Not a foreign key and
    // not authoritative — the public site stays statically generated from code
    // and never reads this database (ADR-010).
    publicSlug: text('public_slug'),
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

export const betTasks = pgTable(
  'bet_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    betId: uuid('bet_id')
      .notNull()
      .references(() => bets.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    done: boolean('done').notNull().default(false),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    dueOn: date('due_on'),
    sortOrder: integer('sort_order').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('bet_tasks_bet_idx').on(table.betId)]
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

export const usersRelations = relations(users, ({ many }) => ({
  ownedBets: many(bets)
}));

export const betsRelations = relations(bets, ({ one, many }) => ({
  owner: one(users, { fields: [bets.ownerId], references: [users.id] }),
  links: many(betLinks),
  documents: many(betDocuments),
  updates: many(betUpdates),
  metrics: many(betMetrics),
  tasks: many(betTasks)
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
