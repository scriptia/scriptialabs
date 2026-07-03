import type { Meta, StoryObj } from '@storybook/react';

import { LegalDocumentView } from './index';

const meta: Meta = {
  title: 'Design System/Legal',
  component: LegalDocumentView,
  tags: ['autodocs']
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Document: Story = {
  render: () => (
    <LegalDocumentView
      title="Privacy Policy"
      description="How Scriptia Labs collects, uses, and protects information across our products."
      lastUpdatedLabel="Last updated July 3, 2026"
      tocLabel="On this page"
      sections={[
        { id: 'introduction', title: 'Introduction', body: ['This policy explains what we collect and why.'] },
        { id: 'personal-information', title: 'Personal information', body: ['Information you give us directly, such as your name and email.'] },
        { id: 'usage-information', title: 'Usage information', body: ['Information about how you interact with our products.'] },
        { id: 'contact', title: 'Contact', body: ['Questions about this policy can be sent to our privacy team.'] }
      ]}
    />
  )
};
