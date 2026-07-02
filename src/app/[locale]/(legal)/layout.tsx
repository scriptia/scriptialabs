import { LegalLayout } from '@/components/layout';

export default function LegalLayoutRoute({ children }: Readonly<{ children: React.ReactNode }>) {
  return <LegalLayout>{children}</LegalLayout>;
}
