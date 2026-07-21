'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/data';
import { Alert } from '@/components/feedback';
import { Button, Input } from '@/components/primitives';
import { Grid, Stack, Surface } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { addBetMetric, deleteBetMetric, type DetailState } from '@/server/actions/bet-details';

import { formatDate, formatMetricValue, todayIso } from '../../_components/format';
import { Sparkline } from '../../_components/sparkline';

export type MetricRow = {
  id: string;
  metricKey: string;
  value: string;
  unit: string | null;
  recordedOn: string;
  note: string | null;
};

// One trend per metric key. Each is a stat tile — latest value, delta, sparkline —
// which is the right form for "a single current value plus its direction", rather
// than one combined chart that would need a second y-axis for followers vs MRR.
export function MetricsPanel({ betId, metrics }: Readonly<{ betId: string; metrics: MetricRow[] }>) {
  const [state, formAction, pending] = useActionState<DetailState, FormData>(addBetMetric, {});
  const id = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, MetricRow[]>();

    for (const metric of metrics) {
      const existing = map.get(metric.metricKey);

      if (existing) {
        existing.push(metric);
      } else {
        map.set(metric.metricKey, [metric]);
      }
    }

    return [...map.entries()].map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));
      const latest = sorted[sorted.length - 1];
      const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
      const delta = previous ? Number(latest.value) - Number(previous.value) : null;

      return { key, rows: sorted, latest, delta };
    });
  }, [metrics]);

  return (
    <Stack gap="lg">
      <form ref={formRef} action={formAction} className="grid gap-3 rounded-lg border border-border bg-surface-subtle p-4 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="betId" value={betId} />

        <Stack gap="xs">
          <Label htmlFor={`${id}-key`}>Metric</Label>
          <Input id={`${id}-key`} name="metricKey" list={`${id}-keys`} placeholder="tiktok_followers" required />
          {/* Suggest the keys already in use so the same metric doesn't end up
              split across three spellings — the classic spreadsheet failure. */}
          <datalist id={`${id}-keys`}>
            {grouped.map((group) => (
              <option key={group.key} value={group.key} />
            ))}
          </datalist>
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-value`}>Value</Label>
          <Input id={`${id}-value`} name="value" type="number" step="any" required />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-unit`}>Unit</Label>
          <Input id={`${id}-unit`} name="unit" placeholder="€, %, —" />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-date`}>Date</Label>
          <Input id={`${id}-date`} name="recordedOn" type="date" defaultValue={todayIso()} required />
        </Stack>

        <Button type="submit" loading={pending}>
          Save
        </Button>

        {state.error ? (
          <div className="sm:col-span-5">
            <Alert tone="error">{state.error}</Alert>
          </div>
        ) : null}
      </form>

      {grouped.length === 0 ? (
        <p className="text-body-small text-text-secondary">No metrics recorded yet. Add a snapshot to start a trend line.</p>
      ) : (
        <>
          <Grid cols={2} gap="md">
            {grouped.map((group) => (
              <Surface key={group.key} className="p-4">
                <p className="text-caption uppercase tracking-[0.08em] text-text-tertiary">{group.key}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-h3 font-medium text-text-primary">{formatMetricValue(group.latest.value, group.latest.unit)}</span>
                  {group.delta !== null && group.delta !== 0 ? (
                    <span className={group.delta > 0 ? 'text-caption text-success' : 'text-caption text-error'}>
                      {group.delta > 0 ? '+' : ''}
                      {new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(group.delta)}
                    </span>
                  ) : null}
                </div>
                <p className="text-caption text-text-tertiary">as of {formatDate(group.latest.recordedOn)}</p>
                <div className="mt-3">
                  <Sparkline
                    label={group.key}
                    unit={group.latest.unit}
                    points={group.rows.map((row) => ({ date: row.recordedOn, value: Number(row.value) }))}
                  />
                </div>
              </Surface>
            ))}
          </Grid>

          {/* The table is the accessible, non-visual view of the same data —
              every value above is readable here, sorted newest first. */}
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Metric</TableHeaderCell>
                <TableHeaderCell>Value</TableHeaderCell>
                <TableHeaderCell>Note</TableHeaderCell>
                <TableHeaderCell className="sr-only">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...metrics]
                .sort((a, b) => b.recordedOn.localeCompare(a.recordedOn))
                .map((metric) => (
                  <TableRow key={metric.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(metric.recordedOn)}</TableCell>
                    <TableCell className="text-text-secondary">{metric.metricKey}</TableCell>
                    <TableCell>{formatMetricValue(metric.value, metric.unit)}</TableCell>
                    <TableCell className="text-text-secondary">{metric.note ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <form action={deleteBetMetric}>
                        <input type="hidden" name="id" value={metric.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Remove
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </>
      )}
    </Stack>
  );
}
