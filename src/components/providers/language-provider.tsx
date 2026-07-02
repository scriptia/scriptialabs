'use client';

import * as React from 'react';

export type LanguageProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export function LanguageProvider({ children }: LanguageProviderProps) {
  return <>{children}</>;
}
