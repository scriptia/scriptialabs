import * as React from 'react';

import { cn } from '@/lib/utils';

export type DisplayProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level?: 'xl' | 'l' | 'm';
};

const levelClasses = {
  xl: 'text-display-xl leading-[1.02] tracking-[-0.04em]',
  l: 'text-display-l leading-[1.04] tracking-[-0.035em]',
  m: 'text-display-m leading-[1.05] tracking-[-0.03em]'
} as const;

export function Display({ className, level = 'xl', ...props }: DisplayProps) {
  return <h1 className={cn('font-display font-medium text-text-primary', levelClasses[level], className)} {...props} />;
}
