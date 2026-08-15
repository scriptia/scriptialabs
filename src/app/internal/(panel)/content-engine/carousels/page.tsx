import { Callout } from '@/components/feedback';
import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { getApps } from '@/server/content-engine';

import { AppSelector } from '../_components/app-selector';
import { resolveActiveApp, type ContentEngineSearchParams } from '../_components/active-app';
import { CarouselForm } from './carousel-form';

export default async function CarouselsPage({ searchParams }: Readonly<{ searchParams: Promise<ContentEngineSearchParams> }>) {
  await requireUser();

  const params = await searchParams;
  const apps = await getApps();
  const activeApp = resolveActiveApp(apps, params);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Carousels</Heading>
          <Body size="small" className="mt-1">
            Genera un carrusel completo (imágenes incluidas) a partir de una idea, aplicando{' '}
            <code>skills/carousel-production/carousel-playbook.md</code> — queda en Review al terminar.
          </Body>
        </div>
        {apps.length > 0 ? <AppSelector apps={apps} activeAppId={activeApp?.id ?? null} /> : null}
      </div>

      {!activeApp ? <Callout title="No apps yet">Nothing to generate without an app.</Callout> : <CarouselForm appId={activeApp.id} />}
    </Stack>
  );
}
