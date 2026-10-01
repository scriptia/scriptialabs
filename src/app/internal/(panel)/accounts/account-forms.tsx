'use client';

import { useActionState, useState, useTransition } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input, Textarea } from '@/components/primitives';
import { Stack, Surface } from '@/components/surfaces';
import { Heading } from '@/components/typography';
import { accountIdentityLabels, accountProviderLabels, type AccountProvider } from '@/content/internal';
import { addAccount, clearLimit, removeAccount, rotateAccountSecret, toggleAccount, type AccountActionState } from '@/server/actions/accounts';

const secretPlaceholder: Record<AccountProvider, string> = {
  claude: 'sk-ant-oat01-… (from `claude setup-token`)',
  eas: 'EXPO_TOKEN',
  supabase: 'sbp_… (personal access token)',
  apple: '{"issuerId":"…","keyId":"…","privateKey":"-----BEGIN PRIVATE KEY-----…","teamId":"…"}',
  revenuecat: '{"clientId":"…","clientSecret":"…","refreshToken":"rtk_…"} — or one project\'s sk_… key'
};

function Field({ label, hint, children }: Readonly<{ label: string; hint?: string; children: React.ReactNode }>) {
  return (
    <label className="block space-y-1">
      <span className="text-body-small font-medium text-text-primary">{label}</span>
      {children}
      {hint ? <span className="block text-caption text-text-tertiary">{hint}</span> : null}
    </label>
  );
}

export function AddAccountForm({ provider }: Readonly<{ provider: AccountProvider }>) {
  const [state, formAction, pending] = useActionState<AccountActionState, FormData>(addAccount, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div>
        <Button type="button" onClick={() => setOpen(true)}>
          Add {accountProviderLabels[provider]} account
        </Button>
      </div>
    );
  }

  return (
    <Surface className="p-5">
      <form action={formAction} key={state.ok ? state.id : 'form'}>
        <input type="hidden" name="provider" value={provider} />
        <Stack gap="md">
          <Heading level={3}>Add {accountProviderLabels[provider]} account</Heading>
          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state.ok ? <Alert tone="success">Added. It is available to the next claim.</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label" hint="Short and unique, e.g. max-3 or expo-studio2.">
              <Input name="label" required maxLength={60} autoComplete="off" />
            </Field>
            <Field label={accountIdentityLabels[provider]}>
              <Input name="identity" maxLength={200} autoComplete="off" />
            </Field>
            <Field label="Plan" hint={provider === 'claude' ? 'Max 5x, Max 20x…' : provider === 'eas' ? 'free, starter, production…' : undefined}>
              <Input name="plan" maxLength={60} autoComplete="off" />
            </Field>
            <Field label="Jobs at once" hint={provider === 'claude' ? 'Keep 1: parallel jobs on one subscription drain the same window.' : undefined}>
              <Input name="maxConcurrency" type="number" min={1} max={100} defaultValue={provider === 'apple' ? 100 : 1} />
            </Field>
          </div>
          <Field label={provider === 'apple' ? 'Secret bundle (JSON)' : 'Token'} hint="Encrypted on save. It cannot be shown again.">
            {provider === 'apple' ? (
              <Textarea name="secret" required rows={5} placeholder={secretPlaceholder[provider]} className="font-mono text-caption" />
            ) : (
              <Input name="secret" type="password" required autoComplete="off" placeholder={secretPlaceholder[provider]} />
            )}
          </Field>
          <Field label="Notes">
            <Input name="notes" maxLength={1000} autoComplete="off" />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add account'}
            </Button>
          </div>
        </Stack>
      </form>
    </Surface>
  );
}

export function AccountRowActions({
  id,
  label,
  status,
  limited,
  inUse
}: Readonly<{ id: string; label: string; status: 'active' | 'disabled'; limited: boolean; inUse: boolean }>) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotateState, rotateAction, rotatePending] = useActionState<AccountActionState, FormData>(rotateAccountSecret, {});

  const run = (action: (formData: FormData) => Promise<AccountActionState>, extra: Record<string, string> = {}, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    const formData = new FormData();
    formData.set('id', id);
    for (const [key, value] of Object.entries(extra)) formData.set(key, value);
    startTransition(async () => {
      const result = await action(formData);
      setError(result.error ?? null);
    });
  };

  if (rotating && !rotateState.ok) {
    return (
      <form action={rotateAction} className="flex min-w-64 flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <Input name="secret" type="password" required autoComplete="off" placeholder="New token" />
        {rotateState.error ? <span className="text-caption text-error">{rotateState.error}</span> : null}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={rotatePending}>
            {rotatePending ? 'Saving…' : 'Replace'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRotating(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {limited ? (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(clearLimit)}>
          Clear limit
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setRotating(true)}>
        Replace token
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(toggleAccount, { status: status === 'active' ? 'disabled' : 'active' }, status === 'active' && inUse ? `"${label}" is in use. Disabling it stops new jobs taking it; the running one keeps it until it pauses or finishes.` : undefined)}
      >
        {status === 'active' ? 'Disable' : 'Enable'}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending || inUse} onClick={() => run(removeAccount, {}, `Delete "${label}"? Its session history stays; the token is destroyed.`)}>
        Delete
      </Button>
      {error ? <span className="basis-full text-right text-caption text-error">{error}</span> : null}
    </div>
  );
}
