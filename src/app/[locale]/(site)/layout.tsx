// Pass-through: pages under (site) compose their own section layout
// (multi-section pages like the homepage need per-section backgrounds and
// spacing that a single shared MarketingLayout wrapper can't express).
// Simple single-column pages can still opt into MarketingLayout/ContentLayout
// from '@/components/layout' themselves.
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
