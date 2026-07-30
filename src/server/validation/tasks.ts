import { z } from 'zod';

import { taskKinds } from '@/content/internal';

import { optionalDate, optionalUuid } from './bets';

// betId is optional: a task can stand alone on the calendar or be linked to a
// bet (rendered inside that bet's detail page too).
export const taskSchema = z.object({
  betId: optionalUuid,
  title: z.string().trim().min(1, 'Describe the task.').max(240),
  kind: z.enum(taskKinds),
  assigneeId: optionalUuid,
  dueOn: optionalDate
});

export type TaskInput = z.infer<typeof taskSchema>;
