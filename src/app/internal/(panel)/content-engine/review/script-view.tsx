import { Badge } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Body, Label } from '@/components/typography';

// `script` is opaque jsonb (see docs/content-engine.md) — a Skill wrote it,
// nothing in this schema enforces its shape. These types describe the two
// shapes scriptwriter actually produces (reel/short vs. carousel), read
// defensively rather than assumed.
type Scene = {
  order?: number;
  duration_s?: number;
  voiceover?: string;
  visual_direction?: string;
  on_screen_text?: string;
  source?: 'footage' | 'generate';
};

type Slide = {
  order?: number;
  headline?: string;
  body?: string;
  visual_direction?: string;
};

type Script = {
  hook_text?: string;
  scenes?: Scene[];
  slides?: Slide[];
  cta?: string;
};

// No JSON.stringify — a human reviewing a piece needs to read the scenes/
// slides as a script, not parse a data structure.
export function ScriptView({ script }: Readonly<{ script: unknown }>) {
  const parsed = (script ?? {}) as Script;

  if (!parsed.scenes?.length && !parsed.slides?.length) {
    return <Body size="small">Empty script.</Body>;
  }

  return (
    <Stack gap="sm">
      {parsed.hook_text ? (
        <div>
          <Label>Hook</Label>
          <Body size="small" className="mt-0.5 text-text-primary">
            {parsed.hook_text}
          </Body>
        </div>
      ) : null}

      {parsed.scenes?.map((scene, index) => (
        <div key={scene.order ?? index} className="rounded-md border border-border p-3">
          <div className="flex items-center gap-2">
            <Label>Scene {scene.order ?? index + 1}</Label>
            {scene.duration_s ? <span className="text-caption text-text-tertiary">{scene.duration_s}s</span> : null}
            {scene.source ? <Badge tone={scene.source === 'footage' ? 'brand' : 'neutral'}>{scene.source}</Badge> : null}
          </div>
          {scene.voiceover ? <Body size="small" className="mt-1 text-text-primary">{scene.voiceover}</Body> : null}
          {scene.visual_direction ? <Body size="small" className="mt-1 italic">{scene.visual_direction}</Body> : null}
          {scene.on_screen_text ? <Body size="small" className="mt-1 text-text-tertiary">On screen: {scene.on_screen_text}</Body> : null}
        </div>
      ))}

      {parsed.slides?.map((slide, index) => (
        <div key={slide.order ?? index} className="rounded-md border border-border p-3">
          <Label>Slide {slide.order ?? index + 1}</Label>
          {slide.headline ? <Body size="small" className="mt-1 font-medium text-text-primary">{slide.headline}</Body> : null}
          {slide.body ? <Body size="small" className="mt-1 text-text-primary">{slide.body}</Body> : null}
          {slide.visual_direction ? <Body size="small" className="mt-1 italic">{slide.visual_direction}</Body> : null}
        </div>
      ))}

      {parsed.cta ? (
        <div>
          <Label>CTA</Label>
          <Body size="small" className="mt-0.5 text-text-primary">
            {parsed.cta}
          </Body>
        </div>
      ) : null}
    </Stack>
  );
}
