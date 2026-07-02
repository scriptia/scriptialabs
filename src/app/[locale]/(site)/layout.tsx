import { MarketingLayout } from '@/components/layout';

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <MarketingLayout>{children}</MarketingLayout>;
}
