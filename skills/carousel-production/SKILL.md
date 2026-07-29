---
name: carousel-production
description: Por cada slide de un carousel ya guionizado, decide reusar un GalleryItem existente como fondo o generar de cero, y dispara la ejecución determinista con esa decisión ya tomada.
---

# Carousel Production

## Responsabilidad

Para una `ContentPiece` de tipo carousel ya guionizada (`status="scripted"`),
resuelve el fondo de cada slide: decide si hay un `GalleryItem`
(`asset_type="carousel_image"`) reutilizable antes de generar uno nuevo
vía OpenAI/Gemini. Mismo principio que `video-production` — priorizar
reutilización sobre gasto en generación. **Esta Skill es quien decide**;
`ProducerAgent` ya no decide nada, solo ejecuta (genera si hace falta,
compone fondo+headline+body vía Shotstack).

## Endpoints de la API que necesita

**Base URL y autenticación:** todas las llamadas van contra
`${CONTENT_ENGINE_API_BASE}` (env var; default `http://localhost:3000` en
dev) + la ruta indicada, con el header `Authorization: Bearer
${CONTENT_ENGINE_API_TOKEN}` en cada petición. Antes esto apuntaba a
`localhost:8000` (FastAPI, `b2c-content-agent`); ahora sería
`src/app/api/content-engine/*` en scriptialabs (ver ADR-012) — **pero
ninguno de los 3 endpoints que esta Skill necesita existe todavía ahí**,
mismo gap que `video-production`.

- ❌ **PENDIENTE (Fase 3)** `GET /gallery/search?app_id={id}&query={texto libre}&asset_type=carousel_image` —
  busca en la galería de la app una imagen que encaje con el fondo
  pedido por un slide concreto. **Filtra siempre por
  `asset_type=carousel_image`** — sin este filtro, un `clip` de vídeo
  puede colarse en el ranking solo por coincidencia de palabras
  genéricas, y no sirve como fondo de slide. **Importante:** distinto de
  `GET /api/content-engine/gallery` (que sí existe) — ese es un listado
  simple, sin el matching por texto libre que hace falta aquí
- ❌ **PENDIENTE (Fase 3)** `POST /content/{id}/produce` — ejecuta la
  resolución ya decidida (`resolved_slides`, ver shape abajo) y compone
  cada slide vía `ProducerAgent`/Shotstack
- ❌ **PENDIENTE (Fase 3)** `GET /content/review-queue?app_id={id}` —
  piezas `scripted` pendientes de producir (distinto de
  `GET /api/content-engine/content-pieces`, que lista por rango de días,
  no por status)

Esta Skill **no puede ejecutarse de verdad todavía** contra
scriptialabs — mismo motivo que `video-production`.

## Procedimiento

### 1. Leer el guion

Obtén la `ContentPiece` (su `script.slides`, ya persistido por
`scriptwriter`). Cada slide trae `order`, `headline`, `body`,
`visual_direction` — a diferencia de las escenas de vídeo, los slides
**no** tienen un campo `source`: `scriptwriter` no marca intención de
reutilización para carousel, así que aquí no hay atajo — toca buscar
para cada slide.

### 2. Resolver cada slide, en orden

Para cada slide:
`GET /gallery/search?app_id={app_id}&asset_type=carousel_image&query={visual_direction}`
usando el `visual_direction` del slide como `query`.

- **Si hay un match razonable** (lee `description`/`tags` del resultado
  y confirma que describe de verdad el mismo fondo que pide el slide —
  no basta con que la búsqueda devuelva algo): marca `action="reuse"`
  con la `url` de ese `GalleryItem`.
- **Si no hay match razonable** (lista vacía, o nada encaja de verdad):
  `action="generate"` con `prompt` = el `visual_direction` del slide.

`headline`/`body` no se resuelven aquí — vienen del guion tal cual y los
compone `ProducerAgent` al renderizar el slide final; esta Skill solo
decide el fondo.

### 3. Ejecutar

Construye `resolved_slides` — un item por slide del guion, mismo `order`:

```json
{
  "resolved_slides": [
    {"order": 1, "action": "generate", "prompt": "..."},
    {"order": 2, "action": "reuse", "url": "https://.../bg42.jpg"}
  ]
}
```

`POST /content/{id}/produce` con este body. Debe cubrir *todos* los
slides del guion (mismo set de `order`) — si falta uno, el endpoint
responde 400. La pieza queda en `status="ready_for_review"` al terminar;
cada slide final (fondo + headline + body ya compuestos) se registra
automáticamente como `GalleryItem` nuevo, para que una futura ejecución
sí pueda encontrarlo.

## TODO

Mismo gap que `video-production`: `GET /gallery/search` hace match por
keywords, nada semántico. Evolucionar a embeddings si el volumen de
galería lo justifica.
