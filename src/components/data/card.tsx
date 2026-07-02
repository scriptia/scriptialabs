import * as React from 'react';

import { cn } from '@/lib/utils';
import { Surface } from '@/components/surfaces';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export function Card({ className, interactive = false, ...props }: CardProps) {
  return <Surface className={cn('p-5', interactive && 'transition-colors hover:bg-surface-elevated', className)} {...props} />;
}
