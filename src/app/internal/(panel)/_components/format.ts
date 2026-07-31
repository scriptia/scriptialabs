// The panel is English-only and has no next-intl provider (it sits outside the
// locale tree), so formatting is done here rather than via useFormatter.
// 'en-GB' gives day-first dates, which is what the team reads.
const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return '—';
  }

  // `date` columns come back as 'YYYY-MM-DD' strings; parsing them directly
  // would apply the local timezone and can shift the day. Build a UTC date.
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : value;

  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatDateTime(value: Date | null | undefined) {
  return value ? dateTimeFormatter.format(value) : '—';
}

export function formatRelative(value: Date | null | undefined) {
  if (!value) {
    return 'never';
  }

  const days = Math.floor((Date.now() - value.getTime()) / (24 * 60 * 60 * 1000));

  if (days <= 0) {
    return 'today';
  }

  if (days === 1) {
    return 'yesterday';
  }

  if (days < 30) {
    return `${days} days ago`;
  }

  const months = Math.floor(days / 30);

  return months === 1 ? 'a month ago' : `${months} months ago`;
}

// Metric values are numeric columns, which drizzle returns as strings to avoid
// float precision loss. Render them without inventing decimals they don't have.
export function formatMetricValue(value: string, unit: string | null) {
  const numeric = Number(value);
  const formatted = Number.isFinite(numeric) ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(numeric) : value;

  return unit ? `${formatted} ${unit}` : formatted;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export type MonthGridDay = { iso: string; day: number; inMonth: boolean };

// Built from plain UTC date math rather than a calendar library — the repo
// has no date-fns/dayjs dependency anywhere and every other date in the panel
// already goes through native Date + Intl. `month` is 1-indexed to match the
// calendar page's ?month= search param.
export function buildMonthGrid(year: number, month: number): { label: string; weeks: MonthGridDay[][] } {
  const first = new Date(Date.UTC(year, month - 1, 1));
  // getUTCDay() is Sunday-first (0-6); shift so Monday=0..Sunday=6, since the
  // grid is meant to read Monday-first. Rotating whole rows after the fact
  // (an earlier version of this) pulls the wrong Sunday — the one from the
  // previous calendar week, not the one that closes the current row.
  const startWeekday = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const days: MonthGridDay[] = [];

  for (let i = 0; i < totalCells; i += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - startWeekday + i));

    days.push({ iso: date.toISOString().slice(0, 10), day: date.getUTCDate(), inMonth: date.getUTCMonth() === month - 1 });
  }

  const weeks: MonthGridDay[][] = [];

  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);

  return { label, weeks };
}
