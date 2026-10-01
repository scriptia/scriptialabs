import Link from 'next/link';

import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeaderCell, TableRow } from '@/components/data';
import { Alert } from '@/components/feedback';
import { Badge } from '@/components/primitives';
import { Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { accountAvailabilityLabels, accountAvailabilityTones, accountProviderLabels, accountProviders, isAccountProvider, type AccountProvider } from '@/content/internal';
import { cn } from '@/lib/utils';
import { requireAdmin } from '@/server/auth/guard';
import { countAccountsByProvider, listAccounts, type AccountView } from '@/server/queries/accounts';
import { isVaultConfigured } from '@/server/vault/crypto';

import { formatRelative } from '../_components/format';
import { AccountRowActions, AddAccountForm } from './account-forms';

type PageProps = Readonly<{ searchParams: Promise<{ provider?: string }> }>;

// What each pool is for, in one sentence, above its table. The page is used
// rarely and under pressure ("why is nothing running?"), so it explains itself.
const providerHelp: Record<AccountProvider, string> = {
  claude:
    'Every job session runs on one of these. When a session hits a 5-hour or weekly limit the account is marked limited until its reset and the job continues on the next free one. Add one with `python -m orchestrator accounts add claude --label max-N` (runs `claude setup-token`), or paste a token below.',
  eas: 'Expo accounts for `eas build --auto-submit`. When one runs out of builds the release moves the app to the next account, bumping its patch version (1.0.0 → 1.0.1) and re-linking its projectId. The token is an EXPO_TOKEN (Expo → Access tokens).',
  supabase: 'Organisations the backend stage creates projects in (free tier: 2 active projects each). The token is a personal access token with access to the org; identity is the org id.',
  apple:
    'The App Store Connect API key and the team distribution certificate, as one JSON bundle: {"issuerId","keyId","privateKey","teamId","distCertP12Base64","distCertPassword","iapKeyId","iapPrivateKey","vendorNumber","secrets":{"GEMINI_API_KEY":"…"}}. The In-App Purchase key (iapKeyId/iapPrivateKey) lets RevenueCat validate purchases and sign offers. One entry is enough.',
  revenuecat:
    'API access for the monetization stage. Best: the RevenueCat OAuth client as JSON {"clientId","clientSecret","refreshToken"} — every app then gets its own RevenueCat project automatically, and the panel rotates the token itself. Fallback per app: create the project by hand, paste its secret key (sk_…) with the app slug as label and the project id as identity.'
};

function untilLabel(value: Date): string {
  const minutes = Math.max(0, Math.round((value.getTime() - Date.now()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.round(hours / 24)} days`;
}

function quotaText(account: AccountView): string {
  const quota = account.quota as { used?: number; limit?: number; projects?: number; cycleResetAt?: string };
  if (account.provider === 'eas' && quota.limit) return `${quota.used ?? 0} / ${quota.limit} builds`;
  if (account.provider === 'supabase' && quota.limit) return `${quota.projects ?? 0} / ${quota.limit} projects`;
  if (account.provider === 'claude') return `${account.sessions7d} sessions · ${account.limits7d} limits (7d)`;
  return '—';
}

function StatusCell({ account }: Readonly<{ account: AccountView }>) {
  return (
    <div className="space-y-1">
      <Badge tone={accountAvailabilityTones[account.availability]}>
        {account.availability === 'limited' && account.limitedUntil
          ? `Limited · ${untilLabel(account.limitedUntil)}`
          : account.availability === 'in_use' || account.availability === 'full'
            ? `In use${account.maxConcurrency > 1 ? ` ${account.activeLeases}/${account.maxConcurrency}` : ''}`
            : accountAvailabilityLabels[account.availability]}
      </Badge>
      {account.availability === 'limited' && account.limitedUntil ? (
        <p className="text-caption text-text-tertiary">
          back {account.limitedUntil.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          {account.limitReason ? ` · ${account.limitReason}` : ''}
        </p>
      ) : null}
      {account.heldBy.length ? (
        <p className="text-caption text-text-tertiary">
          {account.heldBy.map((lease) => (
            <Link key={`${lease.runId}-${lease.purpose}`} href={`/internal/runs/${lease.runId}`} className="mr-2 underline">
              {lease.betSlug ?? lease.kind}
            </Link>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export default async function AccountsPage({ searchParams }: PageProps) {
  await requireAdmin();

  const { provider: raw } = await searchParams;
  const provider: AccountProvider = raw && isAccountProvider(raw) ? raw : 'claude';
  const [accounts, counts] = await Promise.all([listAccounts(provider), countAccountsByProvider()]);
  const vaultReady = isVaultConfigured();

  const free = accounts.filter((account) => account.availability === 'available' || (account.availability === 'in_use' && account.activeLeases < account.maxConcurrency)).length;
  const nextReset = accounts
    .filter((account) => account.availability === 'limited' && account.limitedUntil)
    .map((account) => account.limitedUntil as Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <Stack gap="lg">
      <div>
        <Heading level={1}>Accounts</Heading>
        <Body size="small" className="mt-1">
          The pools jobs draw from. Secrets are encrypted and write-only: you can paste or replace one, never read it back. Only a machine running a job receives it, for
          as long as the job holds the account.
        </Body>
      </div>

      {vaultReady ? null : (
        <Alert tone="error" title="The vault is not configured">
          Set <code>ACCOUNT_VAULT_KEY</code> (a random string of 32+ characters) on this deployment before adding accounts.
        </Alert>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Providers">
        {accountProviders.map((value) => (
          <Link
            key={value}
            href={`/internal/accounts?provider=${value}`}
            aria-current={provider === value ? 'page' : undefined}
            className={cn(
              'inline-flex items-center rounded-pill border px-3 py-1 text-sm transition-colors',
              provider === value ? 'border-brand bg-brand-subtle text-brand-strong' : 'border-border bg-surface text-text-secondary hover:bg-surface-subtle'
            )}
          >
            {accountProviderLabels[value]}
            <span className="ml-1.5 text-caption text-text-tertiary">
              {counts[value] ? `${counts[value]?.free}/${counts[value]?.total}` : '0'}
            </span>
          </Link>
        ))}
      </nav>

      <Surface className="p-5">
        <Stack gap="xs">
          <Heading level={3}>
            {accountProviderLabels[provider]} · {free} of {accounts.length} free{nextReset ? ` · next reset in ${untilLabel(nextReset)}` : ''}
          </Heading>
          <Body size="small">{providerHelp[provider]}</Body>
        </Stack>
      </Surface>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Account</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Usage</TableHeaderCell>
            <TableHeaderCell>Token</TableHeaderCell>
            <TableHeaderCell>Last used</TableHeaderCell>
            <TableHeaderCell>
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {accounts.length === 0 ? (
            <TableEmpty colSpan={6}>No {accountProviderLabels[provider]} accounts yet.</TableEmpty>
          ) : (
            accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <p className="font-medium text-text-primary">{account.label}</p>
                  <p className="text-caption text-text-tertiary">
                    {[account.identity, account.plan].filter(Boolean).join(' · ') || '—'}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusCell account={account} />
                </TableCell>
                <TableCell className="text-body-small">{quotaText(account)}</TableCell>
                <TableCell className="font-mono text-caption text-text-tertiary">{account.secretHint ?? '—'}</TableCell>
                <TableCell className="text-body-small">{account.lastUsedAt ? formatRelative(account.lastUsedAt) : 'never'}</TableCell>
                <TableCell>
                  <AccountRowActions id={account.id} label={account.label} status={account.status} limited={account.availability === 'limited'} inUse={account.activeLeases > 0} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {vaultReady ? <AddAccountForm provider={provider} /> : null}
    </Stack>
  );
}
