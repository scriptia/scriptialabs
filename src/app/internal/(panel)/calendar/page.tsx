import Link from 'next/link';

import { Button } from '@/components/primitives';
import { Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { listActiveUsers } from '@/server/queries/bets';
import { getCalendarTasks, listBetsForSelect, type CalendarTaskRow } from '@/server/queries/tasks';
import { deleteTask, toggleTask } from '@/server/actions/tasks';
import { cn } from '@/lib/utils';

import { TaskKindBadge } from '../_components/bet-status-badge';
import { buildMonthGrid, todayIso } from '../_components/format';
import { CalendarTaskForm } from './task-form';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// buildMonthGrid starts weeks on Sunday (native getUTCDay()); rotate the
// labels and each week's cells to a Monday start, which is what the team reads.
function toMondayFirst<T>(week: T[]): T[] {
  return [...week.slice(1), week[0]];
}

export default async function CalendarPage({ searchParams }: Readonly<{ searchParams: Promise<{ year?: string; month?: string }> }>) {
  await requireUser();

  const params = await searchParams;
  const today = new Date();
  const year = Number(params.year) || today.getUTCFullYear();
  const month = Number(params.month) || today.getUTCMonth() + 1;

  const { label, weeks: rawWeeks } = buildMonthGrid(year, month);
  const weeks = rawWeeks.map(toMondayFirst);
  const from = weeks[0][0].iso;
  const to = weeks[weeks.length - 1][6].iso;

  const [tasks, owners, bets] = await Promise.all([getCalendarTasks({ from, to }), listActiveUsers(), listBetsForSelect()]);

  const tasksByDay = new Map<string, CalendarTaskRow[]>();

  for (const task of tasks) {
    if (!task.dueOn) {
      continue;
    }

    const bucket = tasksByDay.get(task.dueOn) ?? [];

    bucket.push(task);
    tasksByDay.set(task.dueOn, bucket);
  }

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const today0 = todayIso();

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Calendar</Heading>
          <Body size="small" className="mt-1">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} in {label}.
          </Body>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/internal/calendar?year=${prevYear}&month=${prevMonth}`}>Previous</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/internal/calendar">Today</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/internal/calendar?year=${nextYear}&month=${nextMonth}`}>Next</Link>
          </Button>
        </div>
      </div>

      <CalendarTaskForm owners={owners} bets={bets} />

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="min-w-[840px]">
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((weekday) => (
              <div key={weekday} className="px-1 text-caption font-medium uppercase tracking-[0.08em] text-text-tertiary">
                {weekday}
              </div>
            ))}
          </div>

          <Stack gap="sm" className="mt-2">
            {weeks.map((week) => (
              <div key={week[0].iso} className="grid grid-cols-7 gap-2">
                {week.map((cell) => {
                  const dayTasks = tasksByDay.get(cell.iso) ?? [];

                  return (
                    <Surface
                      key={cell.iso}
                      className={cn('min-h-[110px] p-2', !cell.inMonth && 'opacity-50', cell.iso === today0 && 'ring-2 ring-brand/50')}
                    >
                      <p className="text-caption text-text-tertiary">{cell.day}</p>
                      <Stack gap="xs" className="mt-1">
                        {dayTasks.map((task) => (
                          <div key={task.id} className="rounded-md border border-border bg-surface-subtle p-1.5">
                            <div className="flex items-start gap-1.5">
                              <form action={toggleTask}>
                                <input type="hidden" name="id" value={task.id} />
                                <button
                                  type="submit"
                                  aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                                  className={cn(
                                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
                                    task.done ? 'border-brand bg-brand text-text-inverse' : 'border-border-strong hover:border-brand'
                                  )}
                                >
                                  {task.done ? (
                                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
                                      <path d="M2 6.5 4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  ) : null}
                                </button>
                              </form>

                              <div className="min-w-0 flex-1">
                                <p className={cn('text-caption', task.done ? 'text-text-tertiary line-through' : 'text-text-primary')}>{task.title}</p>
                                {task.kind !== 'general' ? <TaskKindBadge kind={task.kind} /> : null}
                                <p className="text-caption text-text-tertiary">
                                  {task.assigneeName ?? 'Unassigned'}
                                  {task.betSlug ? (
                                    <>
                                      {' · '}
                                      <Link href={`/internal/bets/${task.betSlug}`} className="hover:text-brand hover:underline">
                                        {task.betTitle}
                                      </Link>
                                    </>
                                  ) : null}
                                </p>
                              </div>

                              <form action={deleteTask}>
                                <input type="hidden" name="id" value={task.id} />
                                <button type="submit" aria-label={`Remove "${task.title}"`} className="text-caption text-text-tertiary hover:text-error">
                                  ×
                                </button>
                              </form>
                            </div>
                          </div>
                        ))}
                      </Stack>
                    </Surface>
                  );
                })}
              </div>
            ))}
          </Stack>
        </div>
      </div>
    </Stack>
  );
}
