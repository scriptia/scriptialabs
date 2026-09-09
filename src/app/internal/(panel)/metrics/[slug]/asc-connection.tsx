'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Badge, Button, Input, Textarea } from '@/components/primitives';
import { Grid, Stack } from '@/components/surfaces';
import { Body, Label } from '@/components/typography';
import { deleteAppStoreConnectConfig, saveAppStoreConnectConfig, syncAppStoreConnect, type AscFormState, type SyncState } from '@/server/actions/app-store-connect';

export type AscConfigSummary = {
  keyId: string;
  vendorNumber: string;
  ascAppId: string;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
} | null;

export function AscConnection({ appId, config }: Readonly<{ appId: string; config: AscConfigSummary }>) {
  const [saveState, saveAction, saving] = useActionState<AscFormState, FormData>(saveAppStoreConnectConfig, {});
  const [syncState, syncAction, syncing] = useActionState<SyncState, FormData>(syncAppStoreConnect, {});
  const [editing, setEditing] = React.useState(!config);
  const id = React.useId();

  return (
    <Stack gap="md">
      {config ? (
        <Stack gap="sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={config.lastSyncError ? 'error' : 'success'}>{config.lastSyncError ? 'Sync error' : 'Connected'}</Badge>
            <Body className="text-xs text-text-tertiary">
              Key {config.keyId} · vendor {config.vendorNumber} · Apple ID {config.ascAppId}
            </Body>
          </div>

          <Body className="text-xs text-text-secondary">
            {config.lastSyncedAt ? `Last synced ${config.lastSyncedAt.toLocaleString()}` : 'Never synced.'}
          </Body>

          {config.lastSyncError ? <Alert tone="error">{config.lastSyncError}</Alert> : null}

          <div className="flex flex-wrap gap-2">
            <form action={syncAction}>
              <input type="hidden" name="appId" value={appId} />
              <Button type="submit" size="sm" loading={syncing}>
                Sync downloads now
              </Button>
            </form>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing((value) => !value)}>
              {editing ? 'Cancel' : 'Update credentials'}
            </Button>
            <form action={deleteAppStoreConnectConfig}>
              <input type="hidden" name="appId" value={appId} />
              <Button type="submit" variant="ghost" size="sm">
                Disconnect
              </Button>
            </form>
          </div>

          {syncState.error ? <Alert tone="error">{syncState.error}</Alert> : null}
          {syncState.synced ? <Alert tone="success">Synced downloads through week of {syncState.synced}.</Alert> : null}
        </Stack>
      ) : (
        <Body className="text-sm text-text-secondary">
          Connect an App Store Connect API key to pull weekly downloads automatically instead of typing them in. Product page views and TikTok
          numbers stay manual for now.
        </Body>
      )}

      {editing ? (
        <form action={saveAction} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle p-4">
          <input type="hidden" name="appId" value={appId} />

          <Grid cols={2} gap="sm">
            <Stack gap="xs">
              <Label htmlFor={`${id}-issuer`}>Issuer ID</Label>
              <Input id={`${id}-issuer`} name="issuerId" placeholder="69a6de..." required />
            </Stack>
            <Stack gap="xs">
              <Label htmlFor={`${id}-key`}>Key ID</Label>
              <Input id={`${id}-key`} name="keyId" placeholder="2X9R4..." required />
            </Stack>
            <Stack gap="xs">
              <Label htmlFor={`${id}-vendor`}>Vendor number</Label>
              <Input id={`${id}-vendor`} name="vendorNumber" placeholder="8..." required />
            </Stack>
            <Stack gap="xs">
              <Label htmlFor={`${id}-appid`}>Apple App ID</Label>
              <Input id={`${id}-appid`} name="ascAppId" placeholder="1234567890" required />
            </Stack>
          </Grid>

          <Stack gap="xs">
            <Label htmlFor={`${id}-pk`}>Private key (.p8 content)</Label>
            <Textarea id={`${id}-pk`} name="privateKeyPem" rows={5} placeholder="-----BEGIN PRIVATE KEY-----..." required className="font-mono text-xs" />
          </Stack>

          <div>
            <Button type="submit" size="sm" loading={saving}>
              Save connection
            </Button>
          </div>

          {saveState.error ? <Alert tone="error">{saveState.error}</Alert> : null}
        </form>
      ) : null}
    </Stack>
  );
}
