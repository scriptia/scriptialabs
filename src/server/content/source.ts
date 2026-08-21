// Which source the public site renders product and product-legal content from.
//
// This exists only for the migration. Both adapters produce the same
// ProductPageView / LegalDocView, the routes render from that view and never
// branch on the source, and scripts/verify-product-parity.mjs diffs the rendered
// HTML of both builds byte for byte. The flag is what lets that comparison
// happen against a real deployment rather than in a test harness: ship with
// `code`, prove zero diffs against the preview, then flip one environment
// variable — and flip it back if anything is wrong.
//
// Deleted in the phase that removes src/content/products, along with the
// from-code adapter. If you are reading this long after that, the flag was
// forgotten and the code path is dead.
export type PublicContentSource = 'code' | 'db';

export const publicContentSource: PublicContentSource = process.env.PUBLIC_CONTENT_SOURCE === 'db' ? 'db' : 'code';
