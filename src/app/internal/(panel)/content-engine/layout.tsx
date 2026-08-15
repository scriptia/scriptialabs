import type { ReactNode } from 'react';

import { Stack } from '@/components/surfaces';

import { ContentEngineNav } from './_components/content-engine-nav';

export default function ContentEngineLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Stack gap="lg">
      <ContentEngineNav />
      {children}
    </Stack>
  );
}
