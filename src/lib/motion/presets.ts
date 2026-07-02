export const motionPresets = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
  },
  fadeUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
    transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] }
  },
  scale: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
    transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }
  },
  stagger: {
    container: {
      animate: {
        transition: { staggerChildren: 0.08, delayChildren: 0.05 }
      }
    },
    item: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
    }
  },
  hoverLift: {
    whileHover: { y: -2 },
    transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
  },
  hoverGlow: {
    whileHover: { boxShadow: '0 0 0 1px hsl(var(--color-brand) / 0.16), var(--shadow-medium)' },
    transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
  },
  press: {
    whileTap: { scale: 0.98 },
    transition: { duration: 0.08 }
  },
  pageTransition: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
  },
  scrollReveal: {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
  }
} as const;

export const prefersReducedMotion = '(prefers-reduced-motion: reduce)';
