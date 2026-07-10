import * as React from 'react';

import { cn } from '@/lib/utils';

export type LogoProps = React.HTMLAttributes<HTMLSpanElement> & {
  label?: string;
  /** Hide the mark and render the wordmark alone. */
  showMark?: boolean;
};

// Scriptia Labs wordmark: the name set in the serif display face (the brand's
// literary register) beside a small bookmark mark in brand green. The mark
// uses `text-brand` so it tracks the active theme scope; the wordmark inherits
// its colour from the surrounding link so hover/active states just work.
export function Logo({ label = 'Scriptia Labs', showMark = true, className, ...props }: LogoProps) {
  return (
    <span aria-label={label} className={cn('inline-flex items-center gap-2', className)} {...props}>
      {showMark ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[1.15em] w-[1.15em] shrink-0 text-brand" fill="currentColor">
          <path d="M6.5 2.75h11a1.25 1.25 0 0 1 1.25 1.25v16.9a.85.85 0 0 1-1.29.73L12 18.28l-5.46 4.35A.85.85 0 0 1 5.25 21.9V4A1.25 1.25 0 0 1 6.5 2.75Z" />
        </svg>
      ) : null}
      <span className="font-display text-[1.05em] font-medium tracking-[-0.01em]">{label}</span>
    </span>
  );
}
