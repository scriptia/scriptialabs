// The 3 reusable skeletons from skills/carousel-production/carousel-playbook.md
// section 13, transcribed literally — same "closed vocabulary as a content-layer
// constant" pattern as src/content/internal/bet-status.ts, not a markdown
// parser: these 3 skeletons don't change daily, and a parser would be a lot of
// fragility for something this stable. If section 13 of the playbook ever
// changes, update this file by hand to match.
//
// `role` tags each slide so the Server Action that builds the actual
// generation prompt can combine it with the hook/CTA/app-integration RULES
// read live from carousel-playbook.md (not duplicated here) — this file only
// carries the structural shape and the literal example copy, never the rules
// themselves.
export type CarouselSkeletonId = 'A' | 'B' | 'C';

export type CarouselSkeletonSlideRole = 'hook' | 'point' | 'app_mention' | 'cta';

export type CarouselSkeletonSlide = {
  order: number;
  role: CarouselSkeletonSlideRole;
  template: string;
};

export type CarouselSkeleton = {
  id: CarouselSkeletonId;
  label: string;
  summary: string;
  // Slide count the skeleton is written for in the playbook — the form's
  // slide-count field (bounded 7-10 across all three, per the playbook's
  // universal range in section 3) defaults to this per skeleton, and pads or
  // trims `point` slides to match if the user picks a different count.
  defaultSlideCount: number;
  slides: CarouselSkeletonSlide[];
};

export const carouselSkeletons: Record<CarouselSkeletonId, CarouselSkeleton> = {
  A: {
    id: 'A',
    label: 'A — Listicle con mención en medio',
    summary: '7-9 slides. La app aparece como una entrada más de la lista, en medio.',
    defaultSlideCount: 9,
    slides: [
      { order: 1, role: 'hook', template: '[Número] formas de [resultado deseado] en [tiempo/contexto]' },
      { order: 2, role: 'point', template: 'Punto 1 real y útil' },
      { order: 3, role: 'point', template: 'Punto 2 real y útil' },
      { order: 4, role: 'point', template: 'Punto 3 real y útil' },
      { order: 5, role: 'app_mention', template: 'La [posición] es la que más uso yo — [resultado concreto]' },
      { order: 6, role: 'point', template: 'Punto 5 real y útil' },
      { order: 7, role: 'point', template: 'Punto 6 real y útil' },
      { order: 8, role: 'point', template: '(opcional) Punto 7' },
      { order: 9, role: 'cta', template: 'Cierre + CTA: resumen + "guarda esto para [situación]"' }
    ]
  },
  B: {
    id: 'B',
    label: 'B — Problema/solución con mención tardía',
    summary: '6-8 slides. La app aparece tarde, casi al final, como lo que de verdad funcionó.',
    defaultSlideCount: 7,
    slides: [
      { order: 1, role: 'hook', template: 'El problema específico, sin insinuar la solución' },
      { order: 2, role: 'point', template: 'Por qué pasa esto (agitar el problema)' },
      { order: 3, role: 'point', template: 'Solución/tip 1 (sin producto)' },
      { order: 4, role: 'point', template: 'Solución/tip 2 (sin producto)' },
      { order: 5, role: 'app_mention', template: 'Lo que a mí me funcionó fue [app] porque [resultado]' },
      { order: 6, role: 'point', template: 'Cómo se ve el resultado (captura real, dato)' },
      { order: 7, role: 'cta', template: 'Cierre + CTA suave' }
    ]
  },
  C: {
    id: 'C',
    label: 'C — Antes/después con prueba social',
    summary: '5-7 slides. Progreso real con la app como prueba, mención directa cerca del cierre.',
    defaultSlideCount: 7,
    slides: [
      { order: 1, role: 'hook', template: 'De [punto de partida] a [resultado] en [tiempo]' },
      { order: 2, role: 'point', template: 'El punto de partida (contexto real)' },
      { order: 3, role: 'point', template: 'Qué cambió (proceso)' },
      { order: 4, role: 'app_mention', template: 'Captura real del progreso dentro de la app' },
      { order: 5, role: 'point', template: 'Resultado final con cifra concreta' },
      { order: 6, role: 'app_mention', template: 'Mención directa de la app como herramienta usada' },
      { order: 7, role: 'cta', template: 'CTA: "guarda esto si estás en el punto 2"' }
    ]
  }
};

export const carouselSkeletonIds = Object.keys(carouselSkeletons) as CarouselSkeletonId[];

export function isCarouselSkeletonId(value: string): value is CarouselSkeletonId {
  return value in carouselSkeletons;
}

// Slide count is a global 7-10 field in the form (playbook section 3's
// universal range), independent of which skeleton is picked — this resizes a
// skeleton's canonical slide list to match by padding/trimming `point` slides
// only. `hook`/`cta`/`app_mention` slides are never added, removed, or
// reordered relative to each other; only how many generic `point` slides sit
// between them changes.
export function resizeSkeletonSlides(skeleton: CarouselSkeleton, targetCount: number): CarouselSkeletonSlide[] {
  const slides = skeleton.slides.map((slide) => ({ ...slide }));

  while (slides.length > targetCount) {
    const lastPointIndex = slides.map((slide) => slide.role).lastIndexOf('point');

    if (lastPointIndex === -1) break;

    slides.splice(lastPointIndex, 1);
  }

  while (slides.length < targetCount) {
    const ctaIndex = slides.findIndex((slide) => slide.role === 'cta');
    const insertAt = ctaIndex === -1 ? slides.length : ctaIndex;

    slides.splice(insertAt, 0, { order: 0, role: 'point', template: 'Punto adicional real y útil' });
  }

  return slides.map((slide, index) => ({ ...slide, order: index + 1 }));
}

// Removes the app-mention slide(s) entirely (converted to generic points) —
// used when the user picks "no mencionar la app" in the form. The playbook's
// 80/20 and "nunca slide 1" rules only apply when there IS a mention; a pure
// value carousel with no app mention at all is also a valid, explicitly
// supported case, not an error state.
export function withoutAppMention(slides: CarouselSkeletonSlide[]): CarouselSkeletonSlide[] {
  return slides.map((slide) => (slide.role === 'app_mention' ? { ...slide, role: 'point', template: 'Punto real y útil' } : slide));
}
