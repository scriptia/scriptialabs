import * as React from 'react';

import { cn } from '@/lib/utils';

export type GridProps = React.HTMLAttributes<HTMLDivElement> & {
  cols?: 1 | 2 | 3 | 4 | 6;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
};

const colsClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
} as const;

const gapClasses = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8'
} as const;

export function Grid({ className, cols = 3, gap = 'md', ...props }: GridProps) {
  return <div className={cn('grid', colsClasses[cols], gapClasses[gap], className)} {...props} />;
}
