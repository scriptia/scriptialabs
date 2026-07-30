import type { AppRow } from '@/server/db/schema';

export type ContentEngineSearchParams = {
  app_id?: string;
};

// Apps are dynamic data, not a fixed content-layer union like bet statuses —
// so instead of validating app_id against a static list of allowed values
// (the bets pattern via isBetStatus()), it's validated against the apps that
// actually exist right now. An unrecognised or missing app_id falls back to
// the first app rather than erroring — same "a mistyped URL should still
// render a page" principle as toBetFilters().
export function resolveActiveApp(apps: AppRow[], params: ContentEngineSearchParams): AppRow | null {
  if (apps.length === 0) {
    return null;
  }

  const requested = params.app_id ? apps.find((app) => app.id === params.app_id) : undefined;

  return requested ?? apps[0];
}
