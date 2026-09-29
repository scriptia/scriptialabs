'use client';

import { useActionState, useState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input } from '@/components/primitives';
import { reimportFromAppStore, setProductStoreLinks, type ProductActionState } from '@/server/actions/products';

// The store listings, entered once the app is live. Saving an App Store link
// imports that listing's icon and iPhone screenshots onto the public page; the
// Play link is only ever a badge. The imported files show up in the Assets list
// below as "App Store icon" / "App Store screenshot".

const withState =
  (action: (formData: FormData) => Promise<ProductActionState>) =>
  async (_state: ProductActionState, formData: FormData): Promise<ProductActionState> =>
    action(formData);

const save = withState(setProductStoreLinks);
const reimport = withState(reimportFromAppStore);

function Outcome({ state }: Readonly<{ state: ProductActionState }>) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.warning) return <Alert tone="warning">{state.warning}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function StoreLinksForm({
  id,
  appStoreUrl,
  playStoreUrl,
  syncedLabel
}: Readonly<{ id: string; appStoreUrl: string | null; playStoreUrl: string | null; syncedLabel: string | null }>) {
  const [saveState, saveAction, saving] = useActionState<ProductActionState, FormData>(save, {});
  const [reimportState, reimportAction, reimporting] = useActionState<ProductActionState, FormData>(reimport, {});
  const busy = saving || reimporting;
  // Both buttons live in one form; only the most recent one's outcome is shown.
  const [last, setLast] = useState<'save' | 'reimport'>('save');

  return (
    <div className="space-y-4">
      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-caption uppercase tracking-[0.08em] text-text-tertiary">App Store</span>
            <Input
              name="appStoreUrl"
              type="url"
              inputMode="url"
              placeholder="https://apps.apple.com/es/app/…/id123456789"
              defaultValue={appStoreUrl ?? ''}
              key={appStoreUrl ?? ''}
              disabled={busy}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-caption uppercase tracking-[0.08em] text-text-tertiary">Google Play (link only)</span>
            <Input
              name="playStoreUrl"
              type="url"
              inputMode="url"
              placeholder="https://play.google.com/store/apps/details?id=…"
              defaultValue={playStoreUrl ?? ''}
              key={playStoreUrl ?? ''}
              disabled={busy}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={busy} onClick={() => setLast('save')}>
            {saving ? 'Saving and importing…' : 'Save'}
          </Button>
          {appStoreUrl ? (
            <Button type="submit" size="sm" variant="secondary" formAction={reimportAction} disabled={busy} onClick={() => setLast('reimport')}>
              {reimporting ? 'Importing…' : 'Re-import from App Store'}
            </Button>
          ) : null}
          <span className="text-caption text-text-tertiary">{syncedLabel ?? 'Nothing imported yet.'}</span>
        </div>
      </form>

      <Outcome state={last === 'save' ? saveState : reimportState} />
    </div>
  );
}
