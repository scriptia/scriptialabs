import type { Meta, StoryObj } from '@storybook/react';

import { Fade, FadeUp, HoverGlow, HoverLift, PressAnimation, Scale, ScrollReveal, Stagger } from './index';

const meta: Meta = {
  title: 'Design System/Motion',
  component: Fade,
  tags: ['autodocs']
};

export default meta;

type Story = StoryObj<typeof meta>;

export const MotionPrimitives: Story = {
  render: () => (
    <div className="grid gap-4">
      <Fade>Fade</Fade>
      <FadeUp>Fade Up</FadeUp>
      <Scale>Scale</Scale>
      <Stagger><div>Stagger</div></Stagger>
      <HoverLift>Hover Lift</HoverLift>
      <HoverGlow>Hover Glow</HoverGlow>
      <PressAnimation>Press</PressAnimation>
      <ScrollReveal>Scroll Reveal</ScrollReveal>
    </div>
  )
};
