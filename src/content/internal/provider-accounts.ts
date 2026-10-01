import type { BadgeTone } from '@/components/primitives';

// The account pool. Every external service a job spends a metered allowance on
// is a provider, and every provider is a list of interchangeable accounts:
//
//   claude    Claude subscriptions (5-hour and weekly windows). One is leased
//             with every claimed session; a limit pauses the job and the next
//             claim continues it on another account.
//   eas       Expo accounts. Monthly build quota. Switching an app to another
//             account bumps its patch version and re-links its projectId.
//   supabase  Supabase organisations. Free tier = 2 active projects per org.
//   apple     The App Store Connect API key, the team distribution certificate
//             and service secrets the release needs. Not really a pool — one
//             team — but stored the same way so there is one vault.
//   revenuecat  RevenueCat API access for the monetization stage: an OAuth
//             client (creates one project per app), or a per-app project key
//             labelled with the app's slug. The panel refreshes OAuth tokens
//             itself (server/accounts/revenuecat.ts); runners get access tokens.
//
// Same storage approach as pipeline-run.ts: `text` columns, unions here.
export const accountProviders = ['claude', 'eas', 'supabase', 'apple', 'revenuecat'] as const;

export type AccountProvider = (typeof accountProviders)[number];

export const accountProviderLabels: Record<AccountProvider, string> = {
  claude: 'Claude',
  eas: 'EAS (Expo)',
  supabase: 'Supabase',
  apple: 'Apple',
  revenuecat: 'RevenueCat'
};

// What the identity field holds for each provider, for the Accounts form.
export const accountIdentityLabels: Record<AccountProvider, string> = {
  claude: 'Account email',
  eas: 'Expo owner (username or org)',
  supabase: 'Organisation id',
  apple: 'Team id',
  revenuecat: 'Project id (per-app key only)'
};

// What kind of secret the account carries. Kept as a column so a provider can
// gain a second credential type without a schema change.
export const accountCredentialTypes = ['oauth_token', 'access_token', 'asc_api_key', 'secret_bundle', 'oauth_client'] as const;

export type AccountCredentialType = (typeof accountCredentialTypes)[number];

export const defaultCredentialType: Record<AccountProvider, AccountCredentialType> = {
  // `claude setup-token` — a long-lived subscription OAuth token, consumed by the
  // CLI as CLAUDE_CODE_OAUTH_TOKEN.
  claude: 'oauth_token',
  // EXPO_TOKEN (a personal access token of that Expo account).
  eas: 'access_token',
  // SUPABASE_ACCESS_TOKEN (a personal access token with access to the org).
  supabase: 'access_token',
  // JSON: {issuerId, keyId, privateKey (.p8), teamId, distCertP12?, distCertPassword?, secrets?}
  apple: 'secret_bundle',
  // JSON {clientId, clientSecret?, refreshToken} — or credential type
  // `access_token` with a project `sk_` key, label = the app's slug.
  revenuecat: 'oauth_client'
};

export const accountStatuses = ['active', 'disabled'] as const;

export type AccountStatus = (typeof accountStatuses)[number];

// What the pool page shows: the stored status plus what the leases and limits
// say right now. Derived, never stored.
export type AccountAvailability = 'available' | 'in_use' | 'full' | 'limited' | 'disabled';

export const accountAvailabilityLabels: Record<AccountAvailability, string> = {
  available: 'Available',
  in_use: 'In use',
  full: 'In use (full)',
  limited: 'Limited',
  disabled: 'Disabled'
};

export const accountAvailabilityTones: Record<AccountAvailability, BadgeTone> = {
  available: 'success',
  in_use: 'brand',
  full: 'brand',
  limited: 'warning',
  disabled: 'neutral'
};

export function accountAvailability(account: {
  status: AccountStatus;
  limitedUntil: Date | null;
  activeLeases: number;
  maxConcurrency: number;
}, now: Date = new Date()): AccountAvailability {
  if (account.status === 'disabled') return 'disabled';
  if (account.limitedUntil && account.limitedUntil > now) return 'limited';
  if (account.activeLeases >= account.maxConcurrency) return 'full';
  if (account.activeLeases > 0) return 'in_use';
  return 'available';
}

export function isAccountProvider(value: string): value is AccountProvider {
  return (accountProviders as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Build deploy targets
// ---------------------------------------------------------------------------

// Where a build's backend goes. Chosen by the human who presses Build, stored
// in the run's params and on the app's deployment row.
//
//   supabase  the orchestrator creates the Supabase project (from the pool),
//             pushes migrations, deploys functions, sets secrets, and ends the
//             build with the App Store release.
//   deferred  "I will deploy Supabase myself": everything else is done, the
//             release waits until the Backend card is filled in and someone
//             presses Publish.
//   vpc       Idion Cloud — our own VPC. Same interface, not available yet.
export const deployTargets = ['supabase', 'deferred', 'vpc'] as const;

export type DeployTarget = (typeof deployTargets)[number];

export const deployTargetLabels: Record<DeployTarget, string> = {
  supabase: 'Deploy to Supabase',
  deferred: 'Supabase later — I will do it',
  vpc: 'Idion Cloud (VPC)'
};

export const deployTargetDescriptions: Record<DeployTarget, string> = {
  supabase: 'Provision a Supabase project from the pool, push migrations and functions, then build and send it to TestFlight.',
  deferred: 'Build everything except the backend. The store release waits until you enter the Supabase URL and key on the bet.',
  vpc: 'Our own cloud. Coming soon.'
};

// Targets a human can pick today. `vpc` is listed so the form can show it, but
// the action refuses it until the provider exists.
export const availableDeployTargets: readonly DeployTarget[] = ['supabase', 'deferred'];
