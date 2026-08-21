'use client';

import { useTransition } from 'react';

import { Button, Select, Switch } from '@/components/primitives';
import { productStatuses, type ProductStatus } from '@/content/products';
import { publishProduct, setProductIndexable, setProductStatus, unpublishProduct } from '@/server/actions/products';

// The header row of the product editor: publish state, lifecycle status and
// whether search engines are told about the page.
export function PublishControls({
  id,
  slug,
  status,
  published,
  indexable
}: Readonly<{ id: string; slug: string; status: ProductStatus; published: boolean; indexable: boolean }>) {
  const [pending, startTransition] = useTransition();

  const submit = (action: (formData: FormData) => Promise<unknown>) => (formData: FormData) => {
    startTransition(async () => {
      await action(formData);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <form action={submit(published ? unpublishProduct : publishProduct)}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant={published ? 'secondary' : 'primary'} size="sm" disabled={pending}>
          {published ? 'Unpublish' : 'Publish'}
        </Button>
      </form>

      <form action={submit(setProductStatus)} className="flex items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <Select name="status" defaultValue={status} className="h-8 w-auto text-xs" aria-label="Product status" disabled={pending}>
          {productStatuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          Set status
        </Button>
      </form>

      <form action={submit(setProductIndexable)} className="flex items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <label htmlFor="indexable" className="flex cursor-pointer items-center gap-2">
          <Switch id="indexable" name="indexable" defaultChecked={indexable} />
          <span className="text-body-small text-text-primary">In sitemap</span>
        </label>
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          Save
        </Button>
      </form>

      <a href={`/en/${slug}`} target="_blank" rel="noreferrer" className="text-body-small text-brand hover:underline">
        View live →
      </a>
    </div>
  );
}
