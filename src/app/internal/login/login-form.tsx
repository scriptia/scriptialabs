'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { login, type LoginState } from '@/server/actions/auth';

export function LoginForm({ next }: Readonly<{ next: string }>) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const formId = React.useId();

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="next" value={next} />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Stack gap="xs">
        <Label htmlFor={`${formId}-username`}>Username</Label>
        <Input id={`${formId}-username`} name="username" autoComplete="username" autoFocus required />
      </Stack>

      <Stack gap="xs">
        <Label htmlFor={`${formId}-password`}>Password</Label>
        <Input id={`${formId}-password`} name="password" type="password" autoComplete="current-password" required />
      </Stack>

      <Button type="submit" loading={pending} className="w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
