# ADR-009: Per-Product Legal Documentation

## Context

[ADR-003's addendum](ADR-003-product-registry.md#addendum-product-pages-2026-07) and [ADR-008](ADR-008-legal-routing.md) established a single, company-wide set of legal pages (`/privacy`, `/terms`, `/cookies`, `/contact`, `/security`, `/ai-policy`) covering every current and future Scriptia Labs product. That was correct for a set of web products sharing one data model and one origin.

Padelco changes the premise: it's a native iOS/Android app, not a web product. It requests platform permissions the corporate website never will (camera, photo library), collects app-specific data categories (training history, performance statistics), and — critically — both Apple's App Store and Google Play require a privacy policy that accurately and specifically describes what *that application* collects, not a policy written at the level of "Scriptia Labs products in general." A company-wide privacy policy broad enough to cover a writing assistant, a padel coaching app, and a voice agent platform simultaneously would either be too vague to satisfy App Store/Play Store review, or would have to enumerate every product's specific data practices in one document — which stops scaling the moment a product's practices diverge (exactly what happened here).

## Decision

**Legal documentation is per-product going forward, not company-wide.** Padelco is the first product to get its own complete set: Privacy Policy, Terms of Service, Cookie Policy, AI Policy, Contact, Data Deletion, and Acceptable Use — seven documents instead of the company-wide set's five, because a consumer mobile app needs two the corporate site didn't (Data Deletion, expected by both app stores as a discoverable account-deletion path; and its own Acceptable Use Policy, since "acceptable use" for a padel training app is a different question than for a writing tool).

Structurally:
- `src/content/legal/product-legal.ts` defines `productLegalDocuments`, keyed by product id then document key — populated only for Padelco today. `src/content/legal/index.ts`'s original company-wide `legalDocuments` registry is **not removed**; it's now documented as the fallback for products that haven't shipped their own yet (Scriptia, Voice Agents).
- Routes live at `/padelco/legal/privacy`, `/padelco/legal/terms`, etc. — nested under the product's own path rather than at the top level, so a product's legal documents are unambiguously its own and can't collide with another product's or the company-wide set.
- The Padelco product page gained a "Legal" links section, rendered only when `productLegalDocuments[product.id]` exists — so Scriptia's and Voice Agents' pages are unaffected and continue linking to the company-wide legal pages through the global footer, exactly as before.

## A second same-depth routing conflict, same root cause as ADR-008

The first attempt used a new top-level dynamic segment: `src/app/[locale]/(site)/[productId]/legal/[legalSlug]/page.tsx`, alongside the existing `(site)/[slug]/page.tsx`. This failed at dev-server startup with the identical error class ADR-008 already diagnosed — but for a subtly different reason. It isn't only "two routes resolving the same path" (these resolve *different* paths, at different depths). Next.js additionally requires that **sibling dynamic folders at the same directory position share one param name**, full stop — `[slug]` and `[productId]` sitting next to each other under `(site)/` violates that rule regardless of what's nested beneath either one.

The fix: nest the product-legal route *inside* the existing `[slug]` folder rather than beside it — `(site)/[slug]/legal/[legalSlug]/page.tsx`. There's now exactly one dynamic folder at that directory level, satisfying Next.js, and the naming (`slug` reused for what is always a product id in this branch) is a deliberate consequence of that constraint, not an accident — documented inline in the route file so a future reader doesn't "fix" it back into a conflict.

## Alternatives considered

- **Extend the company-wide documents with product-specific carve-out sections** (e.g. a "Padelco-specific data" subsection inside the one company-wide Privacy Policy). Rejected: this is exactly the pattern that doesn't scale — every new product would add another carve-out to an already-long shared document, and App Store/Play Store reviewers expect a policy scoped to the app they're reviewing, not a multi-product document they have to parse for the relevant section.
- **A single generic "mobile app" legal template parameterized by product.** Considered, but rejected for this pass: Padelco's actual data practices (camera/photo permissions, no location/payment/health data) are specific enough that writing a genuinely reusable template now — before a second mobile product exists to prove out what's actually shared versus Padelco-specific — would be speculative. The `productLegalDocuments` registry shape is already generic per-product; a shared template is a reasonable future extraction once a second product needs one.
- **Keep everyone on the company-wide set and add a Padelco-specific appendix page.** Rejected for the same reason as the first alternative — an appendix doesn't satisfy app store review's expectation of one coherent, app-scoped policy at one URL.

## Consequences

- Scriptia and Voice Agents are, for now, on two different legal models simultaneously: the company-wide fallback pages for anything not yet migrated. This is an intentional, temporary state, not an oversight — migrating them isn't in scope until either product needs its own app-store-style listing or its data practices diverge enough to need a dedicated policy.
- The product page's conditional "Legal" section (present for Padelco, absent for Scriptia/Voice Agents) means the three product pages are not visually identical anymore in this one respect. This is a deliberate, minimal difference — the alternative (showing a legal section that links to policies that don't actually describe that product) would be actively misleading.
- Anyone adding a second product with its own legal documents follows the exact same pattern: an entry in `productLegalDocuments`, translated content in `productLegal.<productMessageKey>.*`, and the routes and product-page links appear automatically — no new route file, matching the scalability bar the company-wide set was originally built to meet.

## Future considerations

- If a third product needs its own legal documents and a meaningful amount of content turns out to be identical across products (e.g. the "who we are" framing, or standard clauses), extract a shared partial rather than copy-pasting — but only once that duplication is real, not preemptively.
- Revisit whether Scriptia and Voice Agents should eventually get their own legal documents too, particularly if either starts its own app-store-distributed product (a Scriptia mobile app, for instance) that would face the same App Store/Play Store review expectations Padelco does today.
