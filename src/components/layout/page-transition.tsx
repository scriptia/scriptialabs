'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

import { motionPresets } from '@/lib/motion';

export type PageTransitionProps = Readonly<{
  children: React.ReactNode;
}>;

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div key={pathname} {...(reduceMotion ? {} : motionPresets.pageTransition)}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
