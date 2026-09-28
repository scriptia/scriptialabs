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

  // `initial={false}`: no entrance on the first render. The server HTML is
  // therefore visible as delivered — before, the whole <main> shipped at
  // opacity:0 and stayed blank until hydration (slow JS, blocked scripts,
  // link-preview bots). Client-side route changes still cross-fade.
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={pathname} {...(reduceMotion ? {} : motionPresets.pageTransition)}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
