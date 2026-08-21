'use client';

import { useRef, useTransition } from 'react';

import { rescheduleTask } from '@/server/actions/tasks';

// Moves a task to another day.
//
// A native date input that submits on change, not drag-and-drop: it works on
// touch, it is keyboard- and screen-reader accessible for free, it needs no DnD
// library, and — unlike dragging — it can move a task into a month that is not
// currently on screen. Same reasoning as bets/board/status-select.tsx.
export function TaskMove({ id, dueOn, title }: Readonly<{ id: string; dueOn: string; title: string }>) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          await rescheduleTask(formData);
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input
        type="date"
        name="dueOn"
        // Remounts when the server confirms a new date, so the control never
        // shows a value the database disagrees with.
        key={dueOn}
        defaultValue={dueOn}
        disabled={pending}
        aria-label={`Move "${title}" to another day`}
        title="Move to another day"
        onChange={() => formRef.current?.requestSubmit()}
        className="w-full rounded-sm border border-transparent bg-transparent px-0.5 py-0 text-[10px] leading-4 text-text-tertiary transition-colors hover:border-border hover:text-text-secondary focus-visible:border-brand focus-visible:text-text-primary focus-visible:outline-none disabled:opacity-50"
      />
    </form>
  );
}
