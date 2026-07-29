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
`localhost:8000` (FastAPI, `b2c-content-agent`); ahora sería
`src/app/api/content-engine/*` en scriptialabs (ver ADR-012) —
**pero ninguno de los 3 endpoints que esta Skill necesita existe
todavía ahí.** Solo se migraron los 8 endpoints de lectura listados en
ADR-012 (`apps`, `knowledge`, `trend-sources` ×2, `content-pieces` ×2,
`publications`, `gallery` en su variante de listado simple) — ninguno
cubre lo que video-production necesita.

- ❌ **PENDIENTE (Fase 3)** `GET /gallery/search?app_id={id}&query={texto libre}&asset_type=clip` —
  busca en la galería de la app un asset que encaje con la descripción de
  una escena concreta. **Filtra siempre por `asset_type=clip`** — sin
  este filtro, un `carousel_image` puede colarse en el ranking solo por
  coincidencia de palabras genéricas, y no sirve como clip de vídeo.
  **Importante:** esto NO es lo mismo que `GET /api/content-engine/gallery`
  (que sí existe) — ese es un listado simple por `app_id`/`asset_type`,
  sin el matching por texto libre contra `description`/`tags` que esta
  Skill necesita para decidir reuse vs. generate
- ❌ **PENDIENTE (Fase 3)** `POST /content/{id}/produce` — ejecuta la
  resolución ya decidida (`resolved_scenes`, ver shape abajo) y monta el
  vídeo final vía `ProducerAgent`/Shotstack
- ❌ **PENDIENTE (Fase 3)** `GET /content/review-queue?app_id={id}` —
  piezas `scripted` pendientes de producir (distinto de
  `GET /api/content-engine/content-pieces`, que sí existe pero lista
  por rango de días, no filtra por status)

Esta Skill **no puede ejecutarse de verdad todavía** contra scriptialabs
— los 3 endpoints que necesita son de escritura/búsqueda semántica, y
esta fase solo migró lectura simple.

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

Para las escenas sin match: `action="generate"` con `prompt` = el
`visual_direction` de la escena (es el prompt que `ProducerAgent` pasará
a Kling).

### 4. Ejecutar

Construye la lista `resolved_scenes` — un item por cada escena del
guion, mismo `order`:

```json
{
  "resolved_scenes": [
    {"order": 1, "action": "generate", "prompt": "...", "duration_s": 5},
    {"order": 3, "action": "reuse", "url": "https://.../clip123.mp4"}
  ]
}
```

`POST /content/{id}/produce` con este body. Debe cubrir *todas* las
escenas del guion (mismo set de `order`) — si falta una, el endpoint
responde 400. La pieza queda en `status="ready_for_review"` al terminar;
el `GalleryItem` de las escenas generadas de cero se registra
automáticamente al ejecutar (para que una futura ejecución sí pueda
encontrarlo).

## TODO

`GET /gallery/search` hace match por keywords sobre `description`+`tags`
— nada semántico todavía. Si con más volumen de galería empieza a dar
falsos positivos/negativos frecuentes, evolucionar a embeddings (mismo
gap que señalaba `ProducerAgent.match_footage()` antes de eliminarse).
