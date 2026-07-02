import * as React from 'react';

import { cn } from '@/lib/utils';

export type SpinnerProps = React.HTMLAttributes<HTMLSpanElement> & {
  size?: 'sm' | 'md' | 'lg';
};

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6'
} as const;

export function Spinner({ className, size = 'md', ...props }: SpinnerProps) {
  return <span aria-hidden="true" className={cn('inline-block animate-spin rounded-full border-2 border-border border-t-brand', sizeClasses[size], className)} {...props} />;
}
