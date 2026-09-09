// Shared between the server-only queries module and client form components,
// so it cannot itself import 'server-only'.
export const FUNNEL_STAGES = [
  { key: 'tiktokViews', label: 'TikTok views' },
  { key: 'tiktokProfileVisits', label: 'Profile visits' },
  { key: 'tiktokLinkClicks', label: 'Link clicks' },
  { key: 'appStoreProductPageViews', label: 'App Store page views' },
  { key: 'appStoreDownloads', label: 'Downloads' }
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGES)[number]['key'];
