'use client';

import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Badge, Button } from '@/components/primitives';
import { Grid, Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { revealWebhookSecret, type RevealState } from '@/server/actions/monetization';
import type { RevenueSnapshotRow } from '@/server/db/schema';
import type { AppDeploymentView } from '@/server/queries/pipeline-runs';

import { Sparkline } from '../../_components/sparkline';

type SubscriptionSlot = { id?: string; state?: string; territoriesPriced?: number; introOffer?: string; reviewScreenshot?: boolean };
type MonetizationState = {
  asc?: { groupId?: string; subscriptions?: Record<string, SubscriptionSlot> };
  revenuecat?: { projectId?: string; appId?: string; offerings?: Record<string, unknown> };
  billingEnabled?: boolean;
  blockers?: string[];
};

const READY = new Set(['READY_TO_SUBMIT', 'WAITING_FOR_REVIEW', 'IN_REVIEW', 'APPROVED', 'PENDING_BINARY_APPROVAL']);

function Row({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <>
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="min-w-0 truncate text-text-primary">{children ?? '—'}</dd>
    </>
  );
}

const metricTiles: { key: keyof RevenueSnapshotRow; label: string; unit: string | null }[] = [
  { key: 'mrr', label: 'MRR', unit: 'USD' },
  { key: 'activeSubscriptions', label: 'Active subscriptions', unit: null },
  { key: 'activeTrials', label: 'Active trials', unit: null },
  { key: 'revenue28d', label: 'Revenue (28 days)', unit: 'USD' }
];

// How the app makes money, as the build's monetization stage left it: the App
// Store subscriptions and their review state, the RevenueCat project, whether
// billing is switched on (and if not, exactly why), and the daily RevenueCat
// numbers once there are any.
export function MonetizationCard({
  betId,
  deployment,
  revenue,
  canRevealSecrets
}: Readonly<{ betId: string; deployment: AppDeploymentView; revenue: RevenueSnapshotRow[]; canRevealSecrets: boolean }>) {
  const [reveal, revealAction, revealing] = useActionState<RevealState, FormData>(revealWebhookSecret, {});
  const state = (deployment.monetizationState ?? {}) as MonetizationState;
  const subscriptions = Object.entries(state.asc?.subscriptions ?? {});
  const projectId = deployment.revenuecatProjectId ?? state.revenuecat?.projectId;
  const billing = state.billingEnabled === true;
  const latest = revenue.at(-1);

  return (
    <Surface className="p-5">
      <Stack gap="md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Heading level={3}>Monetization</Heading>
          <Badge tone={billing ? 'success' : 'warning'}>{billing ? 'Billing on' : 'Billing off — app unlocked'}</Badge>
        </div>

        {!billing && state.blockers?.length ? (
          <Alert tone="warning">
            <span className="font-medium">Billing turns on when these are fixed (then press Publish):</span>
            <ul className="mt-1 list-disc pl-5">
              {state.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-body-small">
          <Row label="Subscription group">{deployment.ascSubscriptionGroupId}</Row>
          <Row label="RevenueCat">
            {projectId ? (
              <a href={`https://app.revenuecat.com/projects/${projectId}`} className="text-brand hover:underline" target="_blank" rel="noreferrer">
                project {projectId}
              </a>
            ) : null}
          </Row>
          <Row label="SDK key">{deployment.revenuecatPublicKey}</Row>
          <Row label="Webhook secret">{deployment.revenuecatWebhookSecretSet ? 'set (sealed in the vault)' : null}</Row>
        </dl>

        {subscriptions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-body-small">
              <thead>
                <tr className="text-left text-caption text-text-tertiary">
                  <th className="py-1 pr-3 font-normal">Product</th>
                  <th className="py-1 pr-3 font-normal">App Store state</th>
                  <th className="py-1 pr-3 font-normal">Storefronts</th>
                  <th className="py-1 font-normal">Intro offer</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(([productId, slot]) => (
                  <tr key={productId} className="border-t border-border">
                    <td className="py-1.5 pr-3 font-mono text-caption">{productId}</td>
                    <td className="py-1.5 pr-3">
                      <Badge tone={slot.state && READY.has(slot.state) ? 'success' : 'warning'}>{slot.state ?? 'unknown'}</Badge>
                      {!slot.reviewScreenshot && !(slot.state && READY.has(slot.state)) ? (
                        <span className="ml-2 text-caption text-text-tertiary">needs a review screenshot</span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3">{slot.territoriesPriced ?? '—'}</td>
                    <td className="py-1.5">{slot.introOffer ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {canRevealSecrets && deployment.revenuecatWebhookSecretSet ? (
          <form action={revealAction} className="space-y-2">
            <input type="hidden" name="betId" value={betId} />
            {deployment.deployTarget === 'deferred' ? (
              <Body size="small">
                Your own Supabase needs this as <code>REVENUECAT_WEBHOOK_SECRET</code> (<code>supabase secrets set …</code>), then Publish verifies the webhook and
                turns billing on.
              </Body>
            ) : null}
            {reveal.error ? <Alert tone="error">{reveal.error}</Alert> : null}
            {reveal.secret ? (
              <code className="block break-all rounded-md border border-border bg-surface-subtle px-3 py-2 text-caption">{reveal.secret}</code>
            ) : (
              <Button type="submit" size="sm" variant="secondary" disabled={revealing}>
                {revealing ? 'Revealing…' : 'Reveal webhook secret'}
              </Button>
            )}
          </form>
        ) : null}

        {revenue.length ? (
          <Grid cols={2} gap="md">
            {metricTiles.map((tile) => {
              const points = revenue
                .filter((row) => row[tile.key] !== null && row[tile.key] !== undefined)
                .map((row) => ({ date: String(row.date), value: Number(row[tile.key]) }));
              return (
                <Surface key={tile.key} className="p-4">
                  <p className="text-caption uppercase tracking-[0.08em] text-text-tertiary">{tile.label}</p>
                  <p className="mt-1 text-h3 font-medium text-text-primary">
                    {latest && latest[tile.key] !== null ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(Number(latest[tile.key])) : '—'}
                    {tile.unit && latest && latest[tile.key] !== null ? <span className="ml-1 text-caption text-text-tertiary">{tile.unit}</span> : null}
                  </p>
                  <div className="mt-3">
                    <Sparkline label={tile.label} unit={tile.unit} points={points} />
                  </div>
                </Surface>
              );
            })}
          </Grid>
        ) : projectId ? (
          <Body size="small">RevenueCat numbers appear here after the first daily snapshot.</Body>
        ) : null}
      </Stack>
    </Surface>
  );
}
