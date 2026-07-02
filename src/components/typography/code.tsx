import * as React from 'react';

import { cn } from '@/lib/utils';

export type CodeProps = React.HTMLAttributes<HTMLElement>;

export function Code({ className, ...props }: CodeProps) {
  return <code className={cn('rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-[0.9em] text-text-primary', className)} {...props} />;
}
