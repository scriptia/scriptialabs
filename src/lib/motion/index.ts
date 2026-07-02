export const motionDurations = {
  fast: 120,
  normal: 220,
  slow: 360
} as const;

export const motionEasings = {
  standard: 'cubic-bezier(0.16, 1, 0.3, 1)',
  emphasized: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
} as const;
