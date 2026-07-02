import * as React from 'react';

import { cn } from '@/lib/utils';

export type DividerProps = React.HTMLAttributes<HTMLHRElement> & {
  orientation?: 'horizontal' | 'vertical';
};

export function Divider({ className, orientation = 'horizontal', ...props }: DividerProps) {
  return (
    <hr
      className={cn(orientation === 'horizontal' ? 'h-px w-full border-0 bg-border' : 'w-px self-stretch border-0 bg-border', className)}
      {...props}
    />
  );
}
