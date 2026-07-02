import type { Meta, StoryObj } from '@storybook/react';

import { Alert, Callout, Progress, Skeleton, Spinner } from './index';

const meta = {
  title: 'Design System/Feedback',
  component: Alert,
  tags: ['autodocs']
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <div className="grid gap-4">
      <Alert title="Info">Informational alert.</Alert>
      <Alert tone="success" title="Success">Success alert.</Alert>
      <Callout title="Callout">Supporting note.</Callout>
      <Progress value={68} />
      <div className="flex items-center gap-3"><Spinner /><Skeleton className="h-4 w-32" /></div>
    </div>
  )
};
