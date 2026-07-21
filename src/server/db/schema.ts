import { relations } from 'drizzle-orm';
import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import type { BetAudience, BetLinkKind, BetPriority, BetStatus, BetUpdateKind } from '@/content/internal';

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

export const usersRelations = relations(users, ({ many }) => ({
  ownedBets: many(bets)
}));

export const betsRelations = relations(bets, ({ one, many }) => ({
  owner: one(users, { fields: [bets.ownerId], references: [users.id] }),
  links: many(betLinks),
  updates: many(betUpdates),
  metrics: many(betMetrics),
  tasks: many(betTasks)
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

export type UserRow = typeof users.$inferSelect;
export type BetRow = typeof bets.$inferSelect;
export type BetLinkRow = typeof betLinks.$inferSelect;
export type BetUpdateRow = typeof betUpdates.$inferSelect;
export type BetMetricRow = typeof betMetrics.$inferSelect;
export type BetTaskRow = typeof betTasks.$inferSelect;
