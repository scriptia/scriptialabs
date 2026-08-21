import type { ProductAccent } from '@/design/theme';

// Deliberately NOT marked `server-only`, and deliberately not left in
// server/apps/serialize.ts where it started.
//
// This is a pure function over a string. It lived next to the ts-morph
// serializer because that was its first caller, but `server-only` on that module
// meant importing the accent pool dragged in the whole AST-mutation path — which
// made the publish schema that references it impossible to load in a test or a
// script. Nothing here touches the request, the database or the filesystem.
//
// server/apps/serialize.ts re-exports these for its remaining callers and goes
// away with the rest of the code-driven publishing path.

/** The pool a machine-named product draws from. */
export const autoAccents = ['auto-1', 'auto-2', 'auto-3', 'auto-4', 'auto-5', 'auto-6'] as const;

export type AutoAccent = (typeof autoAccents)[number];

// Compile-time guard: every auto accent must be a real ProductAccent, so adding
// a slot here without a matching theme entry is a type error rather than a
// product page rendering with no colour.
const _assertAccentsExist: readonly ProductAccent[] = autoAccents;
void _assertAccentsExist;

/**
 * Which accent a slug gets.
 *
 * Deterministic, not stateful: the slot depends only on the slug's own
 * characters, so re-running the same bet lands on the same colour without
 * consulting the registry to "remember" what it picked last time.
 */
export function pickAutoAccent(slug: string): AutoAccent {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return autoAccents[hash % autoAccents.length];
}
