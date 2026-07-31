import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { betTasks } from '@/server/db/schema';
import { sendOverdueTaskEmail } from '@/server/email/resend';
import { getOverdueTasks } from '@/server/queries/tasks';

// Called daily by Vercel Cron (see vercel.json). Same auth pattern as
// /api/ingest/bets: a hashed, timing-safe bearer-token comparison, and a 503
// (not 401) when the secret isn't configured at all — that's an operator
// error, not an intruder.
export const runtime = 'nodejs';

function tokenMatches(supplied: string, expected: string) {
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();

  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json({ ok: false, error: 'Cron is not configured on this deployment.' }, { status: 503 });
  }

  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!supplied || !tokenMatches(supplied, expected)) {
    return NextResponse.json({ ok: false, error: 'Invalid or missing bearer token.' }, { status: 401 });
  }

  const overdue = await getOverdueTasks();
  let notified = 0;

  for (const task of overdue) {
    if (!task.assigneeEmail || !task.dueOn) {
      continue;
    }

    await sendOverdueTaskEmail({ to: task.assigneeEmail, taskTitle: task.title, dueOn: task.dueOn, betTitle: task.betTitle });
    await db.update(betTasks).set({ notifiedOverdueAt: new Date() }).where(eq(betTasks.id, task.id));
    notified += 1;
  }

  return NextResponse.json({ ok: true, checked: overdue.length, notified });
}
