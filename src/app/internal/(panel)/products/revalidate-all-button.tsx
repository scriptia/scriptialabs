'use client';

import { useTransition } from 'react';

import { Button } from '@/components/primitives';
import { revalidateProductNow } from '@/server/actions/products';

export function RevalidateAllButton({ slug }: Readonly<{ slug?: string }>) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await revalidateProductNow(formData);
        });
      }}
    >
      {slug ? <input type="hidden" name="slug" value={slug} /> : null}
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? 'Revalidating…' : slug ? 'Revalidate now' : 'Revalidate all'}
      </Button>
    </form>
  );
}
