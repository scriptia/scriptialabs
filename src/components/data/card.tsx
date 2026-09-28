import * as React from 'react';

import { cn } from '@/lib/utils';
import { Surface } from '@/components/surfaces';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export function Card({ className, interactive = false, ...props }: CardProps) {
  return <Surface className={cn('p-5', interactive && 'transition-[background-color,border-color,box-shadow] duration-300 hover:border-border-strong hover:bg-surface-elevated hover:shadow-glow', className)} {...props} />;
}
