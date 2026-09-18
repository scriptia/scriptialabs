import type { FunnelEntryRow } from '@/server/queries/app-metrics';

import { FUNNEL_STAGES, type FunnelStageKey } from './stages';

export type FunnelStep = {
  key: FunnelStageKey;
  label: string;
  value: number;
  // Conversion from the immediately previous stage; null on the first step.
  stepRate: number | null;
  // Share of the top-of-funnel value that survives to this stage.
  cumulativeRate: number | null;
};

export function buildFunnelSteps(entry: Pick<FunnelEntryRow, FunnelStageKey> | null): FunnelStep[] {
  const top = entry ? entry[FUNNEL_STAGES[0].key] : 0;

  return FUNNEL_STAGES.map((stage, index) => {
    const value = entry ? entry[stage.key] : 0;
    const previous = index === 0 ? null : (entry ? entry[FUNNEL_STAGES[index - 1].key] : 0);

    return {
      key: stage.key,
      label: stage.label,
      value,
      stepRate: previous ? value / previous : previous === 0 ? null : null,
      cumulativeRate: top ? value / top : null
    };
  });
}

// Sums the latest week available for each app into one pseudo-entry, for
// the "all apps" combined funnel. Apps are rarely on the exact same week
// (some synced from ASC, some logged by hand later), so this deliberately
// mixes "most recent known" numbers per app rather than requiring one
// shared week — a looser number beats no aggregate view at all.
export function sumLatestEntries(entries: Array<Pick<FunnelEntryRow, FunnelStageKey> | null>): Pick<FunnelEntryRow, FunnelStageKey> | null {
  const present = entries.filter((entry): entry is Pick<FunnelEntryRow, FunnelStageKey> => entry !== null);

  if (present.length === 0) {
    return null;
  }

  return FUNNEL_STAGES.reduce(
    (acc, stage) => {
      acc[stage.key] = present.reduce((sum, entry) => sum + entry[stage.key], 0);

      return acc;
    },
    {} as Record<FunnelStageKey, number>
  ) as Pick<FunnelEntryRow, FunnelStageKey>;
}

// The stage with the worst step-over-step conversion — the weakest link in
// the funnel, and the thing worth improving first. Skips the first stage
// (no incoming conversion to judge) and any stage with no prior volume to
// convert from.
export function findWeakestStage(steps: FunnelStep[]): FunnelStep | null {
  const candidates = steps.slice(1).filter((step) => step.stepRate !== null);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((worst, step) => (step.stepRate! < worst.stepRate! ? step : worst));
}

export function formatPercent(rate: number | null): string {
  if (rate === null) {
    return '—';
  }

  return `${(rate * 100).toFixed(1)}%`;
}

// Monday of the current ISO week, as YYYY-MM-DD — the default value for the
// "week" input on the entry form.
export function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);

  monday.setUTCDate(now.getUTCDate() + diff);

  return monday.toISOString().slice(0, 10);
}
