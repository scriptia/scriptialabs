// Stored as `text` in Postgres rather than a PG enum (same reasoning as
// ADR-010 for bets): the vocabulary is still settling as the ported system
// gets used here, so adding a value is a one-line change plus a zod update,
// not an `ALTER TYPE` against live data.
export const contentTypes = ['reel', 'carousel', 'short'] as const;
export type ContentType = (typeof contentTypes)[number];

export function isContentType(value: string): value is ContentType {
  return (contentTypes as readonly string[]).includes(value);
}

// Mirrors the original Python/SQLAlchemy pipeline's ContentStatus exactly —
// a piece starts `proposed`, gets a script (`scripted`), passes production
// (`ready_for_review`), and is then approved/published, or rejected/archived.
export const contentPieceStatuses = ['proposed', 'scripted', 'ready_for_review', 'approved', 'published', 'rejected', 'archived'] as const;
export type ContentPieceStatus = (typeof contentPieceStatuses)[number];

export function isContentPieceStatus(value: string): value is ContentPieceStatus {
  return (contentPieceStatuses as readonly string[]).includes(value);
}
