import * as React from 'react';

import { IdionMark } from '@/components/media/logo';
import { cn } from '@/lib/utils';

export type OrbitFieldProps = Readonly<{
  className?: string;
}>;

// The hero visual: the Idion mark at the centre of a wider orbital system.
// Two faint outer orbits, a sage satellite travelling the inner one, and the
// mark's own broken ring turning slowly. Pure CSS motion, disabled under
// prefers-reduced-motion via `motion-safe:`.
export function OrbitField({ className }: OrbitFieldProps) {
  return (
    <div aria-hidden="true" className={cn('relative aspect-square w-full', className)}>
      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,hsl(var(--color-brand)/0.22),transparent_65%)] blur-2xl" />

      <div className="absolute inset-0 rounded-full border border-orbit/[0.06]" />
      <div className="absolute inset-[11%] rounded-full border border-dashed border-orbit/[0.09]" />

      <div className="absolute inset-0 motion-safe:animate-orbit-slow">
        <span className="absolute left-[14.6%] top-[14.6%] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orbit/50" />
      </div>
      <div className="absolute inset-[11%] motion-safe:animate-orbit-reverse">
        <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand shadow-glow" />
      </div>

      <div className="absolute inset-[24%]">
        <IdionMark animated weight="fine" className="h-full w-full text-orbit" />
      </div>
    </div>
  );
}
