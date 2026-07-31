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
`localhost:8000` (FastAPI, `b2c-content-agent`); ahora son los route
handlers de `src/app/api/content-engine/*` en scriptialabs (ver ADR-012)
— los 3 existen desde Fase 3 bloque 1. **Importante:** el contrato de
`POST .../produce` no es un port literal del original — ver el matiz en
el paso 3 antes de construir el body.

- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/gallery/search?app_id={id}&query={texto libre}&asset_type=carousel_image` —
  busca en la galería de la app una imagen que encaje con el fondo
  pedido por un slide concreto. **Filtra siempre por
  `asset_type=carousel_image`** — sin este filtro, un `clip` de vídeo
  puede colarse en el ranking solo por coincidencia de palabras
  genéricas, y no sirve como fondo de slide. **Importante:** distinto de
  `GET /api/content-engine/gallery` — ese es un listado simple, sin el
  matching por texto libre que hace falta aquí
- ⚠️ ✅-con-matiz `POST ${CONTENT_ENGINE_API_BASE}/api/content-engine/content/{id}/produce` —
  persiste los slides ya terminados y pasa la pieza a
  `ready_for_review`. **No compone nada** — no hay `ProducerAgent` en
  este backend. El body ya no es `resolved_slides` con `action`/`prompt`
  (ver paso 3, cambió de contrato)
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/content/review-queue?app_id={id}` —
  piezas `ready_for_review` (distinto de
  `GET /api/content-engine/content-pieces`, que lista por rango de días,
  no por status)

Esta Skill **ya puede ejecutarse de verdad** contra scriptialabs — con
el matiz del paso 3: la generación del fondo (OpenAI/Gemini) y la
composición fondo+headline+body (Shotstack) las hace esta Skill llamando
a esas APIs ella misma, directamente desde tu portátil; el endpoint solo
persiste el resultado ya terminado por slide.

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
  no basta con que la búsqueda devuelva algo): el fondo es la `url` de
  ese `GalleryItem`.
- **Si no hay match razonable** (lista vacía, o nada encaja de verdad):
  genera el fondo llamando **tú misma, directamente** a OpenAI/Gemini
  (no hay `ProducerAgent` en scriptialabs que lo haga por ti) con
  `prompt` = el `visual_direction` del slide. Obtén la url real del
  fondo generado.

### 3. Componer y persistir (contrato real, distinto del original)

A diferencia del `b2c-content-agent` original, `POST .../produce` en
scriptialabs **no recibe una decisión por slide** (nada de
`resolved_slides`/`action`/`prompt`) — recibe cada **slide ya
compuesto**. `GalleryItem` solo guarda el fondo, nunca `headline`/`body`
horneados encima — así que para cada slide, reuse o generate, sigue
haciendo falta:

1. Llamar a Shotstack **tú misma, directamente** para componer
   fondo + `headline` + `body` (ambos ya vienen en el guion, no hay que
   inventarlos) en la imagen final de ese slide.
2. Con la url final de cada slide, construir `slide_assets` — un item
   por slide del guion, mismo `order`:

```json
POST /content/{id}/produce
{
  "slide_assets": [
    {"order_index": 1, "url": "https://.../slide1-final.jpg", "production_method": "ai_generated", "generation_provider": "openai", "generation_cost_usd": 0.04},
    {"order_index": 2, "url": "https://.../slide2-final.jpg", "production_method": "edited_from_footage"}
  ]
}
```

Debe cubrir *todos* los slides del guion (mismo set de `order`) — si
falta uno, el endpoint responde 400. El endpoint persiste un
`ContentAsset` por slide (`asset_type="carousel_slide"`), registra un
`GalleryItem` nuevo por slide automáticamente (`description` = el
`visual_direction` de ESE slide, nunca su `headline`/`body`), y pasa la
pieza a `status="ready_for_review"`. No llama a OpenAI/Gemini ni a
Shotstack — si le mandas un `prompt` en vez de una `url`, lo rechaza (422).

## TODO

Mismo gap que `video-production`: `GET /gallery/search` hace match por
keywords, nada semántico. Evolucionar a embeddings si el volumen de
galería lo justifica.
