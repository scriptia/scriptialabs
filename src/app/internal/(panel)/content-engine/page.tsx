import Link from 'next/link';

import { StatCard } from '@/components/data';
import { Callout } from '@/components/feedback';
import { Button } from '@/components/primitives';
import { Grid, Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { getApps, getKnowledgeEntries, getReviewQueue } from '@/server/content-engine';

import { AppSelector } from './_components/app-selector';
import { resolveActiveApp, type ContentEngineSearchParams } from './_components/active-app';

// Entry point for the whole content-engine section — not one more tab among
// several. Picking an app here (via the URL, see AppSelector) is what every
// other page in this section reads from `searchParams`.
export default async function ContentEnginePage({ searchParams }: Readonly<{ searchParams: Promise<ContentEngineSearchParams> }>) {
  await requireUser();

  const params = await searchParams;
  const apps = await getApps();
  const activeApp = resolveActiveApp(apps, params);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Content Engine</Heading>
          <Body size="small" className="mt-1">
            Data + API for the Claude Code Skills and BRAND-AGENT — see <code>docs/content-engine.md</code>.
          </Body>
        </div>
        <div className="flex items-center gap-2">
          {apps.length > 0 ? <AppSelector apps={apps} activeAppId={activeApp?.id ?? null} /> : null}
          <Button asChild size="sm">
            <Link href="/internal/content-engine/apps/new">New app</Link>
          </Button>
        </div>
      </div>

      {!activeApp ? (
        <Callout title="No apps yet">
          No app has been onboarded (<code>POST /api/content-engine/apps/onboard</code>, BRAND-AGENT&rsquo;s route) or created manually yet — nothing to show for any
          app-scoped section until one exists.{' '}
          <Link href="/internal/content-engine/apps/new" className="font-medium text-brand hover:text-brand-strong">
            Create one →
          </Link>
        </Callout>
      ) : (
        <ContentEngineOverview appId={activeApp.id} />
      )}
    </Stack>
  );
}

async function ContentEngineOverview({ appId }: Readonly<{ appId: string }>) {
  const [reviewQueue, knowledgeEntries] = await Promise.all([getReviewQueue({ appId }), getKnowledgeEntries({ appId })]);

  return (
    <Grid cols={2} gap="md">
      <Link href={`/internal/content-engine/review?app_id=${appId}`} className="block transition-colors hover:bg-surface-elevated rounded-lg">
        <StatCard value={reviewQueue.length} label={`${reviewQueue.length === 1 ? 'piece' : 'pieces'} ready for review →`} />
      </Link>
      <Link href={`/internal/content-engine/knowledge?app_id=${appId}`} className="block transition-colors hover:bg-surface-elevated rounded-lg">
        <StatCard value={knowledgeEntries.length} label={`active knowledge ${knowledgeEntries.length === 1 ? 'entry' : 'entries'} (global + this app) →`} />
      </Link>
    </Grid>
  );
}
