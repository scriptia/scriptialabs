import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// This layout only sets the noindex signal and the panel's own font/background
// context. Auth is enforced by middleware.ts plus requireUser() in each page —
// a layout cannot reliably guard its children in the App Router.
export const metadata: Metadata = {
  title: 'Internal — Scriptia Labs',
  robots: { index: false, follow: false }
};

export default function InternalRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="min-h-screen bg-background text-text-primary">{children}</div>;
}
