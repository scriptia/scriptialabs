import * as React from 'react';

import { cn } from '@/lib/utils';

export type Stat = Readonly<{
  value: React.ReactNode;
  label: string;
}>;

export type StatStripProps = Readonly<{
  stats: Stat[];
  className?: string;
}>;

// Hairline-ruled row of headline figures. Only ever fed numbers the site can
// prove — counts read from the product table, not marketing estimates.
export function StatStrip({ stats, className }: StatStripProps) {
  return (
    <dl className={cn('grid grid-cols-3 divide-x divide-border border-y border-border', className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-2 px-4 py-5 first:pl-0 sm:px-6">
          <dt className="order-2 font-mono text-[0.6875rem] uppercase leading-[1.5] tracking-[0.16em] text-text-tertiary sm:text-caption">{stat.label}</dt>
          <dd className="order-1 font-display text-display-m font-light leading-none tracking-[-0.02em] text-text-primary">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
