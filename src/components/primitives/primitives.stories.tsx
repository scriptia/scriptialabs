import type { Meta, StoryObj } from '@storybook/react';

import { Avatar, Badge, Button, Checkbox, Chip, Divider, Input, Link, Radio, Select, Switch, Textarea } from './index';

const meta = {
  title: 'Design System/Primitives',
  component: Button,
  tags: ['autodocs']
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="text">Text</Button>
      <Button variant="danger">Danger</Button>
    </div>
  )
};

export const Fields: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <Input placeholder="Input" />
      <Textarea placeholder="Textarea" />
      <Select defaultValue="one">
        <option value="one">One</option>
        <option value="two">Two</option>
      </Select>
      <div className="flex items-center gap-3">
        <Checkbox />
        <Radio />
        <Switch />
      </div>
    </div>
  )
};

export const Tokens: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge>Neutral</Badge>
      <Badge tone="brand">Brand</Badge>
      <Badge tone="success">Success</Badge>
      <Badge tone="warning">Warning</Badge>
      <Badge tone="error">Error</Badge>
      <Chip>Chip</Chip>
      <Avatar />
      <Divider className="my-2" />
      <Link href="#">Link</Link>
    </div>
  )
};
