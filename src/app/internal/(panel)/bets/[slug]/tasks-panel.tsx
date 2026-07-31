'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input, Select } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { taskKinds, taskKindLabels, type TaskKind } from '@/content/internal';
import { cn } from '@/lib/utils';
import { createTask, deleteTask, toggleTask, type DetailState } from '@/server/actions/tasks';

import { TaskKindBadge } from '../../_components/bet-status-badge';
import { formatDate } from '../../_components/format';

export type TaskRow = {
  id: string;
  title: string;
  kind: TaskKind;
  done: boolean;
  dueOn: string | null;
  assigneeName: string | null;
};

export function TasksPanel({ betId, tasks, owners }: Readonly<{ betId: string; tasks: TaskRow[]; owners: Array<{ id: string; name: string }> }>) {
  const [state, formAction, pending] = useActionState<DetailState, FormData>(createTask, {});
  const id = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <Stack gap="lg">
      <form ref={formRef} action={formAction} className="grid gap-3 rounded-lg border border-border bg-surface-subtle p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="betId" value={betId} />

        <Stack gap="xs">
          <Label htmlFor={`${id}-title`}>Task</Label>
          <Input id={`${id}-title`} name="title" placeholder="Record 3 TikToks for launch week" required />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-kind`}>Kind</Label>
          <Select id={`${id}-kind`} name="kind" defaultValue="general">
            {taskKinds.map((kind) => (
              <option key={kind} value={kind}>
                {taskKindLabels[kind]}
              </option>
            ))}
          </Select>
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-assignee`}>Assignee</Label>
          <Select id={`${id}-assignee`} name="assigneeId" defaultValue="">
            <option value="">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </Select>
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-due`}>Due</Label>
          <Input id={`${id}-due`} name="dueOn" type="date" />
        </Stack>

        <Button type="submit" loading={pending}>
          Add
        </Button>

        {state.error ? (
          <div className="sm:col-span-5">
            <Alert tone="error">{state.error}</Alert>
          </div>
        ) : null}
      </form>

      {tasks.length === 0 ? (
        <p className="text-body-small text-text-secondary">No tasks yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 px-4 py-3">
              {/* A submit button styled as a checkbox: a real <input> would need
                  client state to stay in sync with the server action's result. */}
              <form action={toggleTask}>
                <input type="hidden" name="id" value={task.id} />
                <button
                  type="submit"
                  aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-sm border transition-colors',
                    task.done ? 'border-brand bg-brand text-text-inverse' : 'border-border-strong hover:border-brand'
                  )}
                >
                  {task.done ? (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M2 6.5 4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </button>
              </form>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn('text-body-small', task.done ? 'text-text-tertiary line-through' : 'text-text-primary')}>{task.title}</p>
                  {task.kind !== 'general' ? <TaskKindBadge kind={task.kind} /> : null}
                </div>
                <p className="text-caption text-text-tertiary">
                  {task.assigneeName ?? 'Unassigned'}
                  {task.dueOn ? ` · due ${formatDate(task.dueOn)}` : ''}
                </p>
              </div>

              <form action={deleteTask}>
                <input type="hidden" name="id" value={task.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  );
}
