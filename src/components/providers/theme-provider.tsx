'use client';

import * as React from 'react';

export type ThemeProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <>{children}</>;
}
