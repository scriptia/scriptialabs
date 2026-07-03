import * as React from 'react';

import { cn } from '@/lib/utils';

export type AccordionItem = {
  title: React.ReactNode;
  content: React.ReactNode;
};

export type AccordionProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  items: AccordionItem[];
};

// Native <details>/<summary> gives keyboard operability, screen-reader
// semantics, and open/close state for free, with zero JavaScript — the
// right tool here instead of a hand-rolled ARIA accordion.
export function Accordion({ items, className, ...props }: AccordionProps) {
  return (
    <div className={cn('divide-y divide-border rounded-lg border border-border', className)} {...props}>
      {items.map((item, index) => (
        <details key={index} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-body font-medium text-text-primary marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
            {item.title}
            <span aria-hidden="true" className="shrink-0 text-text-tertiary transition-transform duration-200 group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="pt-3 text-body-small leading-[1.55] text-text-secondary">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
