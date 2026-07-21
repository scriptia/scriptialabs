import * as React from 'react';

import { cn } from '@/lib/utils';

export type TableProps = React.TableHTMLAttributes<HTMLTableElement>;

// The wrapper owns the horizontal scroll so a wide table never forces the page
// body to scroll sideways on narrow viewports.
export function Table({ className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-subtle text-xs uppercase tracking-wide text-text-secondary', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />;
}

export type TableRowProps = React.HTMLAttributes<HTMLTableRowElement> & {
  interactive?: boolean;
};

export function TableRow({ className, interactive = false, ...props }: TableRowProps) {
  return <tr className={cn(interactive && 'transition-colors hover:bg-surface-subtle', className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn('whitespace-nowrap px-4 py-3 font-medium', className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle text-text-primary', className)} {...props} />;
}

export type TableEmptyProps = {
  colSpan: number;
  children: React.ReactNode;
};

export function TableEmpty({ colSpan, children }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-text-secondary">
        {children}
      </td>
    </tr>
  );
}
