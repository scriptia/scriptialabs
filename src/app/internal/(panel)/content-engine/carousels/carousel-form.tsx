'use client';

import * as React from 'react';
import { useActionState, useTransition } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input, Select, Textarea } from '@/components/primitives';
import { Grid, Stack } from '@/components/surfaces';
import { Body, Label } from '@/components/typography';
import { carouselSkeletonIds, carouselSkeletons, resizeSkeletonSlides, type CarouselSkeletonId } from '@/content/content-engine';
import { downloadCarouselZip, generateCarousel, type GenerateCarouselFormState } from '@/server/actions/carousels';

function FieldError({ message }: Readonly<{ message?: string }>) {
  return message ? <p className="text-caption text-error">{message}</p> : null;
}

// Valid app-mention positions for a given skeleton/slide-count combination —
// pure structural math (same resizeSkeletonSlides() the Server Action uses),
// safe to run in the browser so the position <select> can update live as the
// user changes skeleton or slide count, without a round trip.
function appMentionPositions(skeletonId: CarouselSkeletonId, slideCount: number): number[] {
  const resized = resizeSkeletonSlides(carouselSkeletons[skeletonId], slideCount);

  return resized.filter((slide) => slide.role === 'app_mention').map((slide) => slide.order);
}

export function CarouselForm({ appId }: Readonly<{ appId: string }>) {
  const [state, formAction, pending] = useActionState<GenerateCarouselFormState, FormData>(generateCarousel, {});
  const id = React.useId();
  const errors = state.fieldErrors ?? {};

  const [skeletonId, setSkeletonId] = React.useState<CarouselSkeletonId>('A');
  const [slideCount, setSlideCount] = React.useState(carouselSkeletons.A.defaultSlideCount);
  const [mentionApp, setMentionApp] = React.useState<'yes' | 'no'>('yes');

  const positions = appMentionPositions(skeletonId, slideCount);
  const [position, setPosition] = React.useState(positions[0]);

  const onSkeletonChange = (nextId: CarouselSkeletonId) => {
    setSkeletonId(nextId);
    setSlideCount(carouselSkeletons[nextId].defaultSlideCount);
    setPosition(appMentionPositions(nextId, carouselSkeletons[nextId].defaultSlideCount)[0]);
  };

  const onSlideCountChange = (nextCount: number) => {
    setSlideCount(nextCount);
    setPosition(appMentionPositions(skeletonId, nextCount)[0]);
  };

  const [zipPending, startZipTransition] = useTransition();
  const [zipError, setZipError] = React.useState<string | null>(null);

  const onDownloadZip = () => {
    if (!state.result) return;

    startZipTransition(async () => {
      const zip = await downloadCarouselZip(state.result!.slides.map((slide) => ({ order: slide.order, dataUrl: slide.dataUrl })));

      if ('error' in zip) {
        setZipError(zip.error);
        return;
      }

      setZipError(null);

      const bytes = Uint8Array.from(atob(zip.base64), (char) => char.charCodeAt(0));
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
      const link = document.createElement('a');

      link.href = blobUrl;
      link.download = zip.filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
    });
  };

  return (
    <Stack gap="lg">
      <form action={formAction} className="grid gap-6">
        <input type="hidden" name="appId" value={appId} />

        {state.error ? <Alert tone="error">{state.error}</Alert> : null}

        <Stack gap="xs">
          <Label htmlFor={`${id}-idea`}>Idea / tema</Label>
          <Textarea id={`${id}-idea`} name="idea" rows={3} required placeholder="3 errores que te lesionan la rodilla jugando al pádel" />
          <FieldError message={errors.idea} />
        </Stack>

        <Grid cols={3} gap="md">
          <Stack gap="xs">
            <Label htmlFor={`${id}-skeleton`}>Esqueleto</Label>
            <Select id={`${id}-skeleton`} name="skeletonId" value={skeletonId} onChange={(event) => onSkeletonChange(event.target.value as CarouselSkeletonId)}>
              {carouselSkeletonIds.map((skid) => (
                <option key={skid} value={skid}>
                  {carouselSkeletons[skid].label}
                </option>
              ))}
            </Select>
            <Body size="small" className="text-text-tertiary">
              {carouselSkeletons[skeletonId].summary}
            </Body>
            <FieldError message={errors.skeletonId} />
          </Stack>

          <Stack gap="xs">
            <Label htmlFor={`${id}-slideCount`}>Número de slides (7-10)</Label>
            <Input
              id={`${id}-slideCount`}
              name="slideCount"
              type="number"
              min={7}
              max={10}
              value={slideCount}
              onChange={(event) => onSlideCountChange(Number(event.target.value))}
            />
            <FieldError message={errors.slideCount} />
          </Stack>

          <Stack gap="xs">
            <Label htmlFor={`${id}-mentionApp`}>Menciona la app</Label>
            <Select id={`${id}-mentionApp`} name="mentionApp" value={mentionApp} onChange={(event) => setMentionApp(event.target.value as 'yes' | 'no')}>
              <option value="yes">Sí</option>
              <option value="no">No</option>
            </Select>
          </Stack>
        </Grid>

        {mentionApp === 'yes' ? (
          <Stack gap="xs" className="max-w-xs">
            <Label htmlFor={`${id}-position`}>Posición de la mención</Label>
            <Select
              id={`${id}-position`}
              name="appMentionPosition"
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
            >
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  Slide {pos} de {slideCount}
                </option>
              ))}
            </Select>
            <FieldError message={errors.appMentionPosition} />
          </Stack>
        ) : null}

        <div>
          <Button type="submit" loading={pending}>
            {pending ? 'Generando…' : 'Generar carrusel'}
          </Button>
        </div>
      </form>

      {state.result ? (
        <Stack gap="md">
          <div className="flex items-center justify-between">
            <Body className="text-text-primary">Carrusel generado — {state.result.slides.length} slides, en Review.</Body>
            <Button variant="secondary" size="sm" onClick={onDownloadZip} loading={zipPending}>
              {zipPending ? 'Preparando…' : 'Descargar .zip'}
            </Button>
          </div>

          {zipError ? <Alert tone="error">{zipError}</Alert> : null}

          <Grid cols={4} gap="sm">
            {state.result.slides
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((slide) => (
                // eslint-disable-next-line @next/next/no-img-element -- data: url, not a static/local asset
                <img key={slide.order} src={slide.dataUrl} alt={slide.headline} className="aspect-[2/3] w-full rounded-md object-cover" />
              ))}
          </Grid>
        </Stack>
      ) : null}
    </Stack>
  );
}
