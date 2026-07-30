'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input, Select } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { taskKinds, taskKindLabels } from '@/content/internal';
import { createTask, type DetailState } from '@/server/actions/tasks';

export type TaskFormOwner = { id: string; name: string };
export type TaskFormBet = { id: string; title: string };

export function CalendarTaskForm({ owners, bets }: Readonly<{ owners: TaskFormOwner[]; bets: TaskFormBet[] }>) {
  const [state, formAction, pending] = useActionState<DetailState, FormData>(createTask, {});
  const id = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-3 rounded-lg border border-border bg-surface-subtle p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] sm:items-end"
    >
      <Stack gap="xs">
        <Label htmlFor={`${id}-title`}>Task</Label>
        <Input id={`${id}-title`} name="title" placeholder="Send week 3 update to stakeholders" required />
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
        <Label htmlFor={`${id}-bet`}>Bet</Label>
        <Select id={`${id}-bet`} name="betId" defaultValue="">
          <option value="">No bet</option>
          {bets.map((bet) => (
            <option key={bet.id} value={bet.id}>
              {bet.title}
            </option>
          ))}
        </Select>
      </Stack>

      <Stack gap="xs">
        <Label htmlFor={`${id}-due`}>Due</Label>
        <Input id={`${id}-due`} name="dueOn" type="date" required />
      </Stack>

      <Button type="submit" loading={pending}>
        Add
      </Button>

      {state.error ? (
        <div className="sm:col-span-6">
          <Alert tone="error">{state.error}</Alert>
        </div>
      ) : null}
    </form>
  );
}
