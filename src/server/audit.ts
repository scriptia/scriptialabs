import 'server-only';

import { db } from '@/server/db/client';
import { auditLog } from '@/server/db/schema';

export type AuditAction = 'create' | 'update' | 'delete';

export type AuditDiff = Record<string, { from: unknown; to: unknown }>;

// Records only the fields that actually changed, as { field: { from, to } }.
// Storing whole rows would make the log unreadable and grow it far faster than
// the free tier is comfortable with.
export function buildDiff<T extends Record<string, unknown>>(before: T, after: Partial<T>): AuditDiff {
  const diff: AuditDiff = {};

  for (const [key, next] of Object.entries(after)) {
    const previous = before[key];

    // Dates and nulls compare badly with ===; normalise both sides first.
    const normalise = (value: unknown) => (value instanceof Date ? value.toISOString() : (value ?? null));

    if (normalise(previous) !== normalise(next)) {
      diff[key] = { from: normalise(previous), to: normalise(next) };
    }
  }

  return diff;
}

// Auditing must never be the reason a user's edit fails — if the log write
// throws, the mutation it describes has already committed. Swallow and warn.
export async function recordAudit(entry: { actorId: string | null; entity: string; entityId: string | null; action: AuditAction; diff?: AuditDiff | null }) {
  try {
    await db.insert(auditLog).values({
      actorId: entry.actorId,
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      diff: entry.diff && Object.keys(entry.diff).length > 0 ? entry.diff : null
    });
  } catch (error) {
    console.warn('[audit] failed to record entry', entry.entity, entry.action, error);
  }
}
