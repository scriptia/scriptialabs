import * as React from 'react';

import { AppShell as Shell, type AppShellProps } from './layout';

export type SiteShellProps = AppShellProps;

export function SiteShell({ children, navbar, footer, announcement, globalCta }: SiteShellProps) {
  return <Shell navbar={navbar} footer={footer} announcement={announcement} globalCta={globalCta}>{children}</Shell>;
}
