import * as React from 'react';

import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-text-secondary',
  brand: 'bg-brand-subtle text-brand-strong',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error'
};

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return <span className={cn('inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium', toneClasses[tone], className)} {...props} />;
}
