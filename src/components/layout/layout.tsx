import * as React from 'react';
import Link from 'next/link';

import { Button } from '@/components/primitives';
import { Body, Heading } from '@/components/typography';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { Container, Section, Stack, Surface } from '@/components/surfaces';
import { Spinner } from '@/components/feedback/spinner';
import { PageTransition } from './page-transition';

export type ActionLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type AnnouncementBannerProps = Readonly<{
  label: string;
  title?: string;
  href?: string;
}>;

export type GlobalCTAProps = Readonly<{
  eyebrow?: string;
  title: string;
  description: string;
  primary: ActionLink;
  secondary?: ActionLink;
}>;

export type BreadcrumbItem = {
  label: React.ReactNode;
  href?: string;
};

export type EmptyStateLayoutProps = Readonly<{
  title: string;
  description: string;
  primaryAction?: ActionLink;
  secondaryAction?: ActionLink;
}>;

export type LoadingStateProps = Readonly<{
  title: string;
  description: string;
}>;

export type ErrorStateProps = Readonly<{
  title: string;
  description: string;
  action?: ActionLink;
}>;

export type LayoutWrapperProps = Readonly<{
  children: React.ReactNode;
}>;

export type StackSectionProps = LayoutWrapperProps & {
  spacing?: 'sm' | 'md' | 'lg';
};

export type PageLayoutProps = LayoutWrapperProps & {
  breadcrumbs?: BreadcrumbItem[];
};

export function SkipLink({ href = '#main-content', children = 'Skip to content' }: Readonly<{ href?: string; children?: React.ReactNode }>) {
  return (
    <a
      className="absolute left-4 top-4 z-[60] -translate-y-20 rounded-pill bg-brand px-4 py-2 text-body-small font-medium text-text-inverse shadow-medium transition-transform focus-visible:translate-y-0"
      href={href}
    >
      {children}
    </a>
  );
}

export function AnnouncementBanner({ label, title, href }: AnnouncementBannerProps) {
  return (
    <Surface className="border-x-0 border-t-0 rounded-none bg-surface-subtle/80 px-4 py-2 text-center backdrop-blur-md">
      <Container size="content">
        {href ? (
          <a className="inline-flex items-center gap-2 text-body-small text-text-secondary transition-colors hover:text-text-primary" href={href}>
            <span className="font-medium text-brand">{label}</span>
            {title ? <span>{title}</span> : null}
          </a>
        ) : (
          <div className="text-body-small text-text-secondary">
            <span className="font-medium text-brand">{label}</span>
            {title ? <span className="ml-2">{title}</span> : null}
          </div>
        )}
      </Container>
    </Surface>
  );
}

export function GlobalCTA({ eyebrow, title, description, primary, secondary }: GlobalCTAProps) {
  const renderAction = (action: ActionLink) =>
    action.external ? (
      <a href={action.href}>{action.label}</a>
    ) : (
      <Link href={action.href}>{action.label}</Link>
    );

  return (
    <Section spacing="sm">
      <Container size="content">
        <Surface className="border-border/80 bg-surface-elevated p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <Stack gap="sm">
              {eyebrow ? <div className="text-caption font-medium uppercase tracking-[0.12em] text-text-tertiary">{eyebrow}</div> : null}
              <Heading level={2}>{title}</Heading>
              <Body>{description}</Body>
            </Stack>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Button asChild>
                {renderAction(primary)}
              </Button>
              {secondary ? (
                <Button variant="secondary" asChild>
                  {renderAction(secondary)}
                </Button>
              ) : null}
            </div>
          </div>
        </Surface>
      </Container>
    </Section>
  );
}

export function SectionLayout({ children, spacing = 'md' }: StackSectionProps) {
  return (
    <Section spacing={spacing}>
      <Container size="content">
        <Stack gap="lg">{children}</Stack>
      </Container>
    </Section>
  );
}

export function HeroLayout({ children }: LayoutWrapperProps) {
  return (
    <Section spacing="lg">
      <Container size="hero">
        <Stack gap="xl">{children}</Stack>
      </Container>
    </Section>
  );
}

export function CenteredLayout({ children }: LayoutWrapperProps) {
  return (
    <Section spacing="lg">
      <Container size="reading">
        <div className="grid min-h-[60dvh] place-items-center">
          <Stack gap="lg" align="center" className="text-center">
            {children}
          </Stack>
        </div>
      </Container>
    </Section>
  );
}

export function ContentLayout({ children }: LayoutWrapperProps) {
  return (
    <Section spacing="md">
      <Container size="content">{children}</Container>
    </Section>
  );
}

export function ReadingLayout({ children }: LayoutWrapperProps) {
  return (
    <Section spacing="md">
      <Container size="reading">{children}</Container>
    </Section>
  );
}

export function MarketingLayout({ children }: LayoutWrapperProps) {
  return (
    <Section spacing="lg">
      <Container size="hero">
        <Stack gap="xl">{children}</Stack>
      </Container>
    </Section>
  );
}

export function LegalLayout({ children }: LayoutWrapperProps) {
  return <ReadingLayout>{children}</ReadingLayout>;
}

export function SimpleLayout({ children }: LayoutWrapperProps) {
  return (
    <Section spacing="sm">
      <Container size="content">{children}</Container>
    </Section>
  );
}

export function FutureBlogLayout({ children }: LayoutWrapperProps) {
  return <ReadingLayout>{children}</ReadingLayout>;
}

export function EmptyStateLayout({ title, description, primaryAction, secondaryAction }: EmptyStateLayoutProps) {
  const renderAction = (action: ActionLink) =>
    action.external ? (
      <a href={action.href}>{action.label}</a>
    ) : (
      <Link href={action.href}>{action.label}</Link>
    );

  return (
    <CenteredLayout>
      <Stack gap="md" align="center">
        <Heading level={2}>{title}</Heading>
        <Body className="max-w-reading text-text-secondary">{description}</Body>
      </Stack>
      <div className="flex flex-wrap justify-center gap-3">
        {primaryAction ? (
          <Button asChild>
            {renderAction(primaryAction)}
          </Button>
        ) : null}
        {secondaryAction ? (
          <Button variant="secondary" asChild>
            {renderAction(secondaryAction)}
          </Button>
        ) : null}
      </div>
    </CenteredLayout>
  );
}

export function LoadingState({ title, description }: LoadingStateProps) {
  return (
    <CenteredLayout>
      <Stack gap="md" align="center">
        <Spinner size="lg" />
        <Heading level={2}>{title}</Heading>
        <Body>{description}</Body>
      </Stack>
    </CenteredLayout>
  );
}

export function ErrorState({ title, description, action }: ErrorStateProps) {
  const renderAction = (value: ActionLink) =>
    value.external ? (
      <a href={value.href}>{value.label}</a>
    ) : (
      <Link href={value.href}>{value.label}</Link>
    );

  return (
    <CenteredLayout>
      <Stack gap="md" align="center">
        <Heading level={2}>{title}</Heading>
        <Body className="max-w-reading text-text-secondary">{description}</Body>
        {action ? (
          <Button asChild>
            {renderAction(action)}
          </Button>
        ) : null}
      </Stack>
    </CenteredLayout>
  );
}

export function Breadcrumbs({ items }: Readonly<{ items: BreadcrumbItem[] }>) {
  return (
    <Container size="content">
      <div className="py-4">
        <Breadcrumb items={items} />
      </div>
    </Container>
  );
}

export type AppShellProps = Readonly<{
  children: React.ReactNode;
  navbar: React.ReactNode;
  footer: React.ReactNode;
  announcement?: React.ReactNode;
  globalCta?: React.ReactNode;
}>;

export function AppShell({ children, navbar, footer, announcement, globalCta }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-text-primary">
      <SkipLink />
      {announcement}
      {navbar}
      <PageTransition>
        <main id="main-content" className="relative flex-1">
          {children}
        </main>
      </PageTransition>
      {globalCta}
      {footer}
    </div>
  );
}
