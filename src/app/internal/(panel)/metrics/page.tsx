import { Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';

export default async function MetricsPage() {
  await requireUser();

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Heading level={1}>Metrics</Heading>
        <Body className="text-text-secondary">Mobile apps performance and growth metrics.</Body>
      </Stack>

      <Surface className="p-6">
        <Body className="text-text-secondary">No metrics configured yet.</Body>
      </Surface>
    </Stack>
  );
}
