import { productAccentMap, type ProductAccent } from '@/design/theme';

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
 * Every accent the `products.accent` column accepts, auto pool included.
 *
 * The publish payload used to validate `accent` against `autoAccents` alone,
 * which was right while the only caller was a machine naming a product it had
 * just invented. It stopped being right for the products that already have a
 * bespoke hue in `global.css` and were published through the same route:
 * `accento` and `nailio` have carried `--color-product-*` values matched to
 * their own app brand tokens since before either had a page, and a payload could
 * not ask for them.
 *
 * Derived from `productAccentMap`, so adding a hue to the theme is the only
 * change needed — there is no second list to keep in step.
 */
export const productAccents = Object.keys(productAccentMap) as [ProductAccent, ...ProductAccent[]];

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
