import type { Meta, StoryObj } from '@storybook/react';

import { ArticleBody } from './index';

const meta: Meta = {
  title: 'Design System/Article',
  component: ArticleBody,
  tags: ['autodocs']
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Body: Story = {
  render: () => (
    <div className="max-w-reading">
      <ArticleBody
        locale="en"
        locales={['en', 'es', 'ca']}
        siteUrl="https://idionlabs.com"
        markdown={[
          'Puppies bite because they explore the world with their mouths. The fix is to **redirect, not punish**, for five minutes at a time.',
          '## Why do puppies bite?',
          'Teething peaks between *12 and 16 weeks*, and play-biting is how littermates learn bite inhibition.',
          '## A five-minute routine',
          '1. Offer a chew toy the moment teeth touch skin.',
          '2. If biting continues, end the game for 30 seconds.',
          '3. Praise calm mouths.',
          '> Consistency matters more than any single technique.',
          'The [Pupdojo app](/pupdojo) turns this into a guided daily session.'
        ].join('\n\n')}
      />
    </div>
  )
};
