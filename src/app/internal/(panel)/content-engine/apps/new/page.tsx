import { Body, Heading } from '@/components/typography';
import { Stack } from '@/components/surfaces';
import { requireUser } from '@/server/auth/guard';

import { AppForm } from '../apps-form';

export default async function NewAppPage() {
  await requireUser();

  return (
    <Stack gap="lg" className="max-w-3xl">
      <div>
        <Heading level={1}>New app</Heading>
        <Body size="small" className="mt-1">
          Same fields as <code>POST /api/content-engine/apps/onboard</code> (what BRAND-AGENT will call), created directly here instead — for spinning up test apps while that integration doesn&rsquo;t exist yet.
        </Body>
      </div>
      <AppForm />
    </Stack>
  );
}
