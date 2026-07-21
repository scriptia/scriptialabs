import type { ReactNode } from 'react';
import Link from 'next/link';

import { Button } from '@/components/primitives';
import { Container } from '@/components/surfaces';
import { requireUser } from '@/server/auth/guard';
import { logout } from '@/server/actions/auth';

import { PanelNav } from './panel-nav';

// Every page in this group also calls requireUser() for its own data, but doing
// it here too means the shell never renders for a signed-out or deactivated
// account even if a page forgets.
export default async function PanelLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <Container size="hero" className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/internal" className="font-display text-sm font-medium tracking-tight">
              Scriptia Labs <span className="text-text-tertiary">/ internal</span>
            </Link>
            <PanelNav />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-text-secondary sm:inline">{user.name}</span>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </Container>
      </header>

      <main className="flex-1 py-8">
        <Container size="hero">{children}</Container>
      </main>
    </div>
  );
}
