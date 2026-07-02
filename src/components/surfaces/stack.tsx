import * as React from 'react';

import { cn } from '@/lib/utils';

export type StackProps = React.HTMLAttributes<HTMLDivElement> & {
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
};

const gapClasses = {
  xs: 'gap-2',
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8'
} as const;

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch'
} as const;

export function Stack({ className, gap = 'md', align = 'stretch', ...props }: StackProps) {
  return <div className={cn('flex flex-col', gapClasses[gap], alignClasses[align], className)} {...props} />;
}
