'use client';

import { useRef, useTransition } from 'react';

import { Select } from '@/components/primitives';
import { betStatusLabels, betStatuses, type BetStatus } from '@/content/internal';
import { setBetStatus } from '@/server/actions/bets';

// A select rather than drag-and-drop: it works on touch, it is keyboard- and
// screen-reader accessible for free, and it needs no client-side DnD library.
// Moving a bet between columns is a two-tap operation either way.
export function StatusSelect({ betId, status }: Readonly<{ betId: string; status: BetStatus }>) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(() => setBetStatus(formData));
      }}
    >
      <input type="hidden" name="id" value={betId} />
      <Select
        name="status"
        defaultValue={status}
        disabled={pending}
        aria-label="Change status"
        className="h-8 w-full text-xs"
        onChange={() => formRef.current?.requestSubmit()}
      >
        {betStatuses.map((value) => (
          <option key={value} value={value}>
            {betStatusLabels[value]}
          </option>
        ))}
      </Select>
    </form>
  );
}
