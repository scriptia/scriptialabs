'use client';

import { useActionState, useRef } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Select, Switch } from '@/components/primitives';
import { productStatuses, type ProductStatus } from '@/content/products';
import { publishProduct, setProductIndexable, setProductStatus, unpublishProduct, type ProductActionState } from '@/server/actions/products';

// The header row of the product editor.
//
// Every control auto-submits on change and reports what happened. The earlier
// version wrapped each action in a bare `startTransition` that DISCARDED the
// returned state, so an action answering `{ error: … }` looked exactly like an
// action that worked — which is why changing a status appeared to do nothing.
// Each control now owns a `useActionState`, so a refusal is visible.
//
// Auto-submit rather than a paired "Set status" / "Save" button: those existed
// only because there was no feedback, and two submit buttons sitting in one row
// next to a third form read as three unrelated things. Same pattern as
// bets/board/status-select.tsx.

function useAutoSubmit(action: (state: ProductActionState, formData: FormData) => Promise<ProductActionState>) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ProductActionState, FormData>(action, {});
  return { ref, state, formAction, pending, submit: () => ref.current?.requestSubmit() };
}

// useActionState wants (state, formData); the actions take formData alone.
const withState =
  (action: (formData: FormData) => Promise<ProductActionState>) =>
  async (_state: ProductActionState, formData: FormData): Promise<ProductActionState> =>
    action(formData);

export function PublishControls({
  id,
  slug,
  status,
  published,
  indexable
}: Readonly<{ id: string; slug: string; status: ProductStatus; published: boolean; indexable: boolean }>) {
  const publish = useAutoSubmit(withState(published ? unpublishProduct : publishProduct));
  const statusControl = useAutoSubmit(withState(setProductStatus));
  const index = useAutoSubmit(withState(setProductIndexable));

  const errors = [publish.state.error, statusControl.state.error, index.state.error].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <form ref={publish.ref} action={publish.formAction}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant={published ? 'secondary' : 'primary'} size="sm" disabled={publish.pending}>
            {publish.pending ? '…' : published ? 'Unpublish' : 'Publish'}
          </Button>
        </form>

        <form ref={statusControl.ref} action={statusControl.formAction} className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <label htmlFor="product-status" className="text-body-small text-text-secondary">
            Status
          </label>
          <Select
            id="product-status"
            name="status"
            // Remounts when the server sends a different status, so the control
            // always shows what is actually stored rather than a stale
            // defaultValue left over from the previous render.
            key={status}
            defaultValue={status}
            disabled={statusControl.pending}
            className="h-8 w-auto text-xs"
            onChange={statusControl.submit}
          >
            {productStatuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </form>

        <form ref={index.ref} action={index.formAction}>
          <input type="hidden" name="id" value={id} />
          <label htmlFor="indexable" className="flex cursor-pointer items-center gap-2">
            <Switch id="indexable" name="indexable" key={String(indexable)} defaultChecked={indexable} disabled={index.pending} onChange={index.submit} />
            <span className="text-body-small text-text-primary">In sitemap</span>
          </label>
        </form>

        <a href={`/en/${slug}`} target="_blank" rel="noreferrer" className="text-body-small text-brand hover:underline">
          View live →
        </a>
      </div>

      {errors.map((error) => (
        <Alert key={error} tone="error">
          {error}
        </Alert>
      ))}
    </div>
  );
}
