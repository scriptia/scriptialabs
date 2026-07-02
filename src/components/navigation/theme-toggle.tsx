import * as React from 'react';

import { Button } from '@/components/primitives';

export type ThemeToggleProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed?: boolean;
};

export function ThemeToggle({ pressed = false, children = 'Theme', ...props }: ThemeToggleProps) {
  return (
    <Button type="button" variant="ghost" size="sm" aria-pressed={pressed} aria-label="Toggle theme" {...props}>
      {children}
    </Button>
  );
}
