---
name: video-production
description: Por cada escena de un reel/short ya guionizado, decide reusar un GalleryItem existente o generar de cero, y dispara la ejecución determinista con esa decisión ya tomada.
---

# Video Production

## Responsabilidad

Para una `ContentPiece` de tipo reel/short ya guionizada (`status="scripted"`),
resuelve cada escena: decide si hay un `GalleryItem` reutilizable antes de
generar nada nuevo con IA — evita gastar en Kling cuando ya hay un asset
que sirve. **Esta Skill es quien decide** (reuse vs generate, y qué url o
qué prompt exactamente); `ProducerAgent` ya no decide nada, solo ejecuta
la resolución que esta Skill le entrega.

## Endpoints de la API que necesita

**Base URL y autenticación:** todas las llamadas van contra
`${CONTENT_ENGINE_API_BASE}` (env var; default `http://localhost:3000` en
dev) + la ruta indicada, con el header `Authorization: Bearer
${CONTENT_ENGINE_API_TOKEN}` en cada petición. Antes esto apuntaba a
`localhost:8000` (FastAPI, `b2c-content-agent`); ahora son los route
handlers de `src/app/api/content-engine/*` en scriptialabs (ver ADR-012)
— los 3 existen desde Fase 3 bloque 1. **Importante:** el contrato de
`POST .../produce` no es un port literal del original — ver el matiz en
el paso 4 antes de construir el body.

- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/gallery/search?app_id={id}&query={texto libre}&asset_type=clip` —
  busca en la galería de la app un asset que encaje con la descripción de
  una escena concreta. **Filtra siempre por `asset_type=clip`** — sin
  este filtro, un `carousel_image` puede colarse en el ranking solo por
  coincidencia de palabras genéricas, y no sirve como clip de vídeo.
  **Importante:** esto NO es lo mismo que
  `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/gallery` — ese es
  un listado simple por `app_id`/`asset_type`, sin el matching por texto
  libre contra `description`/`tags` que esta Skill necesita para decidir
  reuse vs. generate
- ⚠️ ✅-con-matiz `POST ${CONTENT_ENGINE_API_BASE}/api/content-engine/content/{id}/produce` —
  persiste el asset ya terminado y pasa la pieza a `ready_for_review`.
  **No ejecuta generación ni montaje** — no hay `ProducerAgent` en este
  backend. El body ya no es `resolved_scenes` con `action`/`prompt`
  (ver paso 4, cambió de contrato)
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/content/review-queue?app_id={id}` —
  piezas `ready_for_review` (distinto de
  `GET /api/content-engine/content-pieces`, que lista por rango de días,
  no por status)

Esta Skill **ya puede ejecutarse de verdad** contra scriptialabs — con
el matiz del paso 4: la generación (Kling) y el montaje final (Shotstack)
los hace esta Skill llamando a esas APIs ella misma, directamente desde
tu portátil; el endpoint solo persiste el resultado ya terminado.

## Procedimiento

### 1. Leer el guion

Obtén la `ContentPiece` (su `script.scenes`, ya persistido por
`scriptwriter`). Cada escena trae `order`, `duration_s`, `visual_direction`,
y el campo `source` ("footage" | "generate") que `scriptwriter` ya marcó
como intención.

### 2. Resolver cada escena, en orden

Para cada escena:

- **Si `source="generate"`** → no busques en la galería, ve directa a
  "generar" (paso 3). La intención ya descartó que exista footage
  reutilizable para este tipo de plano.
- **Si `source="footage"`** → primero
  `GET /gallery/search?app_id={app_id}&asset_type=clip&query={visual_direction}`
  (usa el `visual_direction` de la escena tal cual como `query`, es la
  descripción más rica que existe de lo que hace falta).
  - **Si hay un match razonable** (el primer resultado describe realmente
    lo que la escena pide — no basta con que la búsqueda devuelva *algo*,
    hay que leer su `description`/`tags` y confirmar que encaja de verdad):
    marca esta escena como `action="reuse"` con la `url` de ese `GalleryItem`.
  - **Si no hay match razonable** (lista vacía, o el resultado más
    parecido no describe lo mismo que pide la escena) → cae a "generar"
    (paso 3) igual que si `source` hubiera sido `"generate"`. La
    intención original del guion no es una garantía, solo una pista.

### 3. Generar cuando no hay reuse

Para las escenas sin match: llama a Kling **tú misma, directamente**
(no hay `ProducerAgent` en scriptialabs que lo haga por ti) con
`prompt` = el `visual_direction` de la escena. Obtén la url real del
clip generado antes de seguir al paso 4.

### 4. Montar y persistir (contrato real, distinto del original)

A diferencia del `b2c-content-agent` original, `POST .../produce` en
scriptialabs **no recibe una decisión por escena** (nada de
`resolved_scenes`/`action`/`prompt`) — recibe el **vídeo final ya
montado**. Tú (la Skill) tienes que:

1. Tener ya, para cada escena, una url real: la del `GalleryItem`
   reusado, o la que acabas de generar con Kling en el paso 3.
2. Llamar a Shotstack **tú misma, directamente** para montar esas
   escenas (en orden) en un único vídeo final. El montaje siempre hace
   falta, incluso si todas las escenas son reuse — un vídeo final es la
   unión de clips, no un clip suelto.
3. Con esa única url final, llamar:

```json
POST /content/{id}/produce
{
  "asset": {
    "url": "https://.../final-montado.mp4",
    "production_method": "ai_generated" | "edited_from_footage" | "dry_run",
    "generation_provider": "kling",
    "generation_cost_usd": 2.6
  }
}
```

`production_method` refleja el mix real: `"ai_generated"` si hubo
alguna escena generada, `"edited_from_footage"` si todas fueron reuse.
El endpoint persiste el `ContentAsset` (`asset_type="final_video"`),
registra un `GalleryItem` nuevo automáticamente (para que una futura
ejecución sí pueda encontrarlo vía `gallery/search`), y pasa la pieza a
`status="ready_for_review"`. No llama a Kling ni a Shotstack — si le
mandas un `prompt` en vez de una `url`, lo rechaza (422).

## TODO

`GET /gallery/search` hace match por keywords sobre `description`+`tags`
— nada semántico todavía. Si con más volumen de galería empieza a dar
falsos positivos/negativos frecuentes, evolucionar a embeddings (mismo
gap que señalaba `ProducerAgent.match_footage()` antes de eliminarse).
