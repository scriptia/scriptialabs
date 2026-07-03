import * as React from 'react';

import { cn } from '@/lib/utils';

export type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3;
};

const headingClasses = {
  1: 'text-h1 leading-[1.1] tracking-[-0.03em]',
  2: 'text-h2 leading-[1.12] tracking-[-0.025em]',
  3: 'text-h3 leading-[1.14] tracking-[-0.02em]'
} as const;

const headingTags = {
  1: 'h1',
  2: 'h2',
  3: 'h3'
} as const;

export function Heading({ className, level = 2, ...props }: HeadingProps) {
  const Tag = headingTags[level];
  return <Tag className={cn('font-display font-medium text-text-primary', headingClasses[level], className)} {...props} />;
}
