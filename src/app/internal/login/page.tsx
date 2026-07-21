import { Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';

import { LoginForm } from './login-form';

// Reads searchParams, so this page is dynamic and never prerendered — which is
// what we want: nothing under /internal should end up in the static output.
export default async function InternalLoginPage({ searchParams }: Readonly<{ searchParams: Promise<{ next?: string }> }>) {
  const { next } = await searchParams;
  const target = next && next.startsWith('/internal') && !next.startsWith('//') ? next : '/internal';

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <Surface className="w-full max-w-sm p-8" elevated>
        <Heading level={2}>Scriptia Labs</Heading>
        <Body size="small" className="mt-1 mb-6">
          Internal panel. Accounts are created by an admin.
        </Body>
        <LoginForm next={target} />
      </Surface>
    </main>
  );
}
