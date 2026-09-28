'use client';

import * as React from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

import { motionPresets } from '@/lib/motion';

export type MotionPresetProps = Readonly<{
  children: React.ReactNode;
}>;

export function Fade({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  return <motion.div {...(reduceMotion ? {} : motionPresets.fade)}>{children}</motion.div>;
}

// Pure CSS entrance, so it plays from the server HTML with no JS at all and
// can never leave content stuck invisible. Used for above-the-fold heroes.
export function FadeUp({ children }: MotionPresetProps) {
  return <div className="motion-safe:animate-fade-up">{children}</div>;
}

export function Scale({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  return <motion.div {...(reduceMotion ? {} : motionPresets.scale)}>{children}</motion.div>;
}

export function Stagger({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <>{children}</>;
  }

  return <motion.div {...motionPresets.stagger.container}>{children}</motion.div>;
}

export function HoverLift({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  return <motion.div {...(reduceMotion ? {} : motionPresets.hoverLift)}>{children}</motion.div>;
}

export function HoverGlow({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  return <motion.div {...(reduceMotion ? {} : motionPresets.hoverGlow)}>{children}</motion.div>;
}

export function PressAnimation({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  return <motion.div {...(reduceMotion ? {} : motionPresets.press)}>{children}</motion.div>;
}

// Route-level page transitions are owned by
// @/components/layout/page-transition (keyed by pathname); this file only
// covers element-level presets, so no PageTransition export lives here.

// Visible by default: the server renders content as-is, and only an element
// that starts below the fold is hidden (before first paint, so nothing
// flashes) and then revealed as it scrolls in. Without JS, with reduced
// motion, or above the fold, nothing is ever hidden. `amount: 'some'` rather
// than a fraction, because a fraction of a very tall wrapper (a long grid on
// mobile) can exceed the viewport and never trigger.
export function ScrollReveal({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const [armed, setArmed] = React.useState(false);
  const inView = useInView(ref, { once: true, amount: 'some', margin: '0px 0px -12% 0px' });

  React.useLayoutEffect(() => {
    if (reduceMotion || !ref.current) return;
    if (ref.current.getBoundingClientRect().top > window.innerHeight) setArmed(true);
  }, [reduceMotion]);

  const hidden = armed && !inView;
  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={hidden ? { opacity: 0, y: 16 } : { opacity: 1, y: 0 }}
      transition={hidden ? { duration: 0 } : motionPresets.scrollReveal.transition}
    >
      {children}
    </motion.div>
  );
}
