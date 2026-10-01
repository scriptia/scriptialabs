# ADR-015 — Monetization from one file, set up by code, switched on only when it can sell

**Status:** accepted
**Amends:** ADR-014 (orchestrator and account pool)

## Context

Every built app reached TestFlight with a paywall that could not sell. The product agent
planned the subscriptions (ids, durations, prices, trial, exit offer), but only as markdown
tables; the build received `store.subscription_group` and nothing else. Getting from there to
a working purchase took a person in three dashboards: App Store Connect (group,
subscriptions, prices per storefront, trial), RevenueCat (project, products, entitlement,
offering, packages, webhook) and Supabase (the webhook secret, `paywall_enabled`). The
template shipped `PAYWALL_ENABLED: "true"` with `REPLACE_ME` keys, and ids followed two
conventions depending on which agent wrote them.

## Decision

**One machine-readable plan.** The product agent's store stage writes `monetization.json`
(schema v1), the twin of APP-STORE-CONNECT.md §7, cross-checked against it. It travels as
`store.monetization` (zod-validated at ingest, `server/validation/monetization.ts`), into the
build descriptor and into the app repo. The template generates StoreKit, the app config, the
webhook's entitlement id and `identity.json` product ids from it. Nothing downstream reads a
product id, price or entitlement from anywhere else. Fixed conventions:

- product ids are `com.idion.<slug>.<period>`;
- the entitlement is `pro`;
- the offering is `default` and current;
- packages are RevenueCat's standard keys.

**A `monetization` platform stage** in the orchestrator, after the backend and the App Store
record and before the EAS build. Every object is found by its natural key before it is
created, with ids kept in the checkpointed `platform.json`, so a re-run or a resume on
another machine creates nothing twice. It sets up:

- App Store Connect:
  - the group;
  - the subscriptions;
  - prices in every storefront, equalized from the USD price point;
  - the trial and the promotional offers.
- RevenueCat (one project per app):
  - the App Store app, with the In-App Purchase and App Store Connect keys;
  - products, entitlement, offerings and packages;
  - a RevenueCat paywall, only if a placement asks for one;
  - a webhook with a per-app secret.

**Billing is switched on only when the whole chain verifies:**

- the webhook answers a TEST event with the secret;
- `billing-health` agrees;
- every subscription is ready to submit;
- RevenueCat returned a public key.

Only then are `app_config.paywall_enabled` and `EXPO_PUBLIC_PAYWALL_ENABLED` set to true, and
the app requires both. Any gap leaves both off. The app is then unlocked rather than showing a
paywall that cannot sell, and the reasons are written to `app_deployments.monetization_state`
and shown on the bet's Monetization card. Publish re-runs the stage and flips billing once the
gap is closed.

**RevenueCat access is a pool provider (`revenuecat`).**

- The preferred credential is an OAuth client (`oauth_client`), so project creation needs no
  human.
- The fallback is a project secret key (`access_token`) labelled with the app's slug.
- The panel owns the OAuth refresh token. `POST /api/accounts/revenuecat/token` hands a run an
  access token, refreshing it when it has under ten minutes left.
- RevenueCat refresh tokens are single-use. neon-http has no interactive transactions, so the
  refresh is guarded by a compare-and-swap lock in the account's `quota` jsonb: one statement
  takes the lock, the holder refreshes and stores the rotated pair, and everyone else waits for
  the new token. The lock (45 s) outlives the HTTP timeout (20 s), so a holder cannot lose it
  mid-call.
- Tested with ten parallel callers on Postgres: one refresh (`tests/queue/revenuecat-token.test.ts`).

**Secrets.**

- The per-app webhook secret is sealed in `app_deployments.revenuecat_webhook_secret_encrypted`
  with the account vault.
- It is never returned by the deployment route, and pages see only whether it is set.
- It is delivered in the run descriptor, so a run on a new machine reuses it instead of
  rotating it.
- Admins can reveal it (audited) for a backend they run themselves.

**Observability.**

- The app sets subscriber attributes and Apple Search Ads attribution, and logs one purchase
  funnel to `events`.
- Supabase keeps a `subscriptions` mirror (grace, billing issue, transfer) that `profiles.is_pro`
  derives from.
- A daily cron (`/api/cron/revenuecat-metrics`) stores RevenueCat's overview metrics in
  `revenue_snapshots`, drawn as sparklines on the card.

**Paywall flexibility without releases.**

- Each paywall context is a RevenueCat placement.
- The copy and the highlighted plan come from offering metadata, which is written once when the
  offering is created and never overwritten, so dashboard edits survive rebuilds.
- A context can switch to RevenueCat's own paywall renderer from the dashboard.

## Consequences

- A new app sells on its first TestFlight build when the pool has an OAuth client, the Apple
  bundle has the In-App Purchase key, and the subscriptions have review screenshots. Otherwise
  it ships unlocked, with a precise list of what is missing.
- Still human, once per account:
  - granting the RevenueCat OAuth client;
  - creating the In-App Purchase key;
  - the Paid Apps agreement.
- Still human, per app:
  - ticking the subscriptions on the first version's review page;
  - Submit for Review;
  - a review screenshot when the product has none;
  - optionally, pasting RevenueCat's Apple notification URL.
- Not yet verified against the real services (M0):
  - RevenueCat's OAuth token URL (`REVENUECAT_OAUTH_TOKEN_URL`, default
    `https://api.revenuecat.com/oauth2/token`) and project creation over OAuth;
  - Apple's v1 subscription localization endpoints;
  - intro offers created per storefront;
  - the package-products response shape.

  Each of these is a fixable call site behind an already-tested flow.
- Existing apps are not migrated.
