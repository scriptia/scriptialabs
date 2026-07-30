import 'server-only';

import { Resend } from 'resend';

import { formatDate } from '@/app/internal/(panel)/_components/format';

let client: Resend | null = null;

function getClient() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  client ??= new Resend(process.env.RESEND_API_KEY);

  return client;
}

export async function sendOverdueTaskEmail(task: { to: string; taskTitle: string; dueOn: string; betTitle: string | null }) {
  const resend = getClient();

  if (!resend) {
    console.warn('[email] RESEND_API_KEY is not set — skipping overdue reminder for', task.to);

    return;
  }

  const from = process.env.EMAIL_FROM ?? 'tasks@scriptialabs.com';
  const context = task.betTitle ? ` (${task.betTitle})` : '';

  await resend.emails.send({
    from,
    to: task.to,
    subject: `Overdue: ${task.taskTitle}`,
    text: `"${task.taskTitle}"${context} was due ${formatDate(task.dueOn)} and is still not marked done.\n\nOpen the calendar: ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/internal/calendar`
  });
}
