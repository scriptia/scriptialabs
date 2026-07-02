'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { motionPresets } from '@/lib/motion';

export type MotionPresetProps = Readonly<{
  children: React.ReactNode;
}>;

export function Fade({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  return <motion.div {...(reduceMotion ? {} : motionPresets.fade)}>{children}</motion.div>;
}

export function FadeUp({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  return <motion.div {...(reduceMotion ? {} : motionPresets.fadeUp)}>{children}</motion.div>;
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

export function PageTransition({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  return <motion.div {...(reduceMotion ? {} : motionPresets.pageTransition)}>{children}</motion.div>;
}

export function ScrollReveal({ children }: MotionPresetProps) {
  const reduceMotion = useReducedMotion();
  return <motion.div {...(reduceMotion ? {} : motionPresets.scrollReveal)}>{children}</motion.div>;
}
