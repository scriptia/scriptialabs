import * as React from 'react';

import { cn } from '@/lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn('text-caption font-medium uppercase tracking-[0.08em] text-text-tertiary', className)} {...props} />;
}
