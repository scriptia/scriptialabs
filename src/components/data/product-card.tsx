import * as React from 'react';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Card } from './card';

export type ProductCardProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  title: React.ReactNode;
  description: React.ReactNode;
  badge?: React.ReactNode;
};

// The arrow reacts to a `group` ancestor (the grid wraps each card in a link),
// so the whole tile reads as one target.
export function ProductCard({ title, description, badge, className, ...props }: ProductCardProps) {
  return (
    <Card interactive className={cn('flex flex-col', className)} {...props}>
      <div className="mb-4 flex min-h-6 items-start justify-between gap-3">
        <div>{badge}</div>
        <ArrowUpRight
          aria-hidden="true"
          strokeWidth={1.5}
          className="h-5 w-5 shrink-0 text-text-tertiary transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text-primary"
        />
      </div>
      <h3 className="text-h3 font-medium text-text-primary">{title}</h3>
      <p className="mt-2 text-body-small leading-[1.6] text-text-secondary">{description}</p>
    </Card>
  );
}
