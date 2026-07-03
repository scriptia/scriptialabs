import type { Meta, StoryObj } from '@storybook/react';

import { LanguageProvider, ThemeProvider } from './index';

const meta: Meta = {
  title: 'Design System/Providers',
  component: ThemeProvider,
  tags: ['autodocs']
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Providers: Story = {
  render: () => (
    <ThemeProvider>
      <LanguageProvider>Providers</LanguageProvider>
    </ThemeProvider>
  )
};
