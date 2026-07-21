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
