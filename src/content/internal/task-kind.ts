import type { BadgeTone } from '@/components/primitives';

// Most tasks are plain to-dos. `send_for_review` and `published` are milestone
// tasks tied to a bet's product lifecycle — they get a distinct badge/tone on
// the calendar so they stand out from the routine ones.
export const taskKinds = ['general', 'send_for_review', 'published'] as const;

export type TaskKind = (typeof taskKinds)[number];

export const taskKindLabels: Record<TaskKind, string> = {
  general: 'Task',
  send_for_review: 'Product Send for Review',
  published: 'Product Published'
};

export const taskKindTones: Record<TaskKind, BadgeTone> = {
  general: 'neutral',
  send_for_review: 'brand',
  published: 'success'
};

export function isTaskKind(value: string): value is TaskKind {
  return (taskKinds as readonly string[]).includes(value);
}
