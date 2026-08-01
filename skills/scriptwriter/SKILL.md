---
name: scriptwriter
description: Escribe el guion completo (vídeo o carrusel) a partir del ángulo ya decidido por strategist, y lo persiste como ContentPiece en status="scripted".
---

# Scriptwriter

## Responsabilidad

Convierte una decisión de `strategist` (content_type/angle/hook_type/
inspired_by_id/related_principle) en un guion completo y estructurado —
escenas con voiceover/visual_direction para reel/short, o slides con
headline/body/visual_direction para carousel — respetando el
brand/product/audience de la app y, si aplica, la mecánica de un
`TrendSource` concreto. Sustituye a `ScriptwriterAgent.write()`
(eliminado — era la llamada LLM directa desde Python).

**Esta Skill es la que persiste.** `strategist` solo decide; el
`POST /content-pieces` se llama una única vez, aquí, con el guion ya
completo — no hay paso intermedio de "crear vacío y completar después".

## Endpoints de la API que necesita

**Base URL y autenticación:** todas las llamadas van contra
`${CONTENT_ENGINE_API_BASE}` (env var; default `http://localhost:3000` en
dev) + la ruta indicada, con el header `Authorization: Bearer
${CONTENT_ENGINE_API_TOKEN}` en cada petición — sin ese header la API
responde 401 (o 503 si el token no está configurado). Antes esto
apuntaba a `localhost:8000` (FastAPI, `b2c-content-agent`); ahora son
los route handlers de `src/app/api/content-engine/*` en scriptialabs
(ver ADR-012).

- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/apps` — perfil
  completo de la app: `brandProfile` (incluye `tone` y `voiceExamples`,
  se asume que existen — sin lógica de fallback si faltan),
  `productProfile`, `audienceProfile`
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/trend-sources/{id}` —
  si `inspired_by_id` viene informado, trae su `extractedFormula` (y
  `sceneBreakdown`/`transcript` si hace falta más detalle de la mecánica)
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/knowledge?app_id={id}` —
  principios de estructura/hooks a respetar (mismo cruce de conflictos
  que documenta `strategist/SKILL.md`)
- ✅ `POST ${CONTENT_ENGINE_API_BASE}/api/content-engine/content-pieces`
  — persiste el guion completo (`content_type`, `angle`, `hook_type`,
  `hook_text`, `script`, `inspired_by_id`), creando directamente en
  `status="scripted"`. Esta Skill puede completar su trabajo de verdad
  contra scriptialabs.

## Procedimiento

### 1. Recibir input

Recibe de `strategist`, en la misma sesión: `content_type`, `angle`,
`hook_type`, `inspired_by_id` (puede ser `null`), `related_principle`
(puede ser `null`), y el `reasoning` breve. Junto a eso, obtén el perfil
completo de la app vía `GET /apps/` — en particular `brand_profile.tone`
y `brand_profile.voice_examples` para que el guion suene a esa marca y
no genérico, y `audience_profile`/`product_profile` para anclar el
contenido a algo relevante para esa audiencia concreta.

**`related_principle` es el texto COMPLETO del `principle` de la
`KnowledgeEntry` que decidió el `angle`/`hook_type` recibido — no un dato
opcional más, es la razón real detrás de la etiqueta.** Úsalo para
informar decisiones concretas de ejecución al escribir el guion (paso
3): energía visual de cada `visual_direction` (ej. un principio sobre
urgencia/dolor pide planos más cercanos y tensos, no un plano general
neutro), ritmo (escenas más cortas y con más corte si el principio habla
de mantener atención vs. tomas más largas si habla de construir
confianza), y tono del `voiceover`/`on_screen_text` (directo vs.
empático, según lo que el principio realmente diga). El `angle`/
`hook_type` por sí solos son una etiqueta — no basta con mirarlos y
asumir qué implican para la ejecución; hay que leer el `principle`
mismo.

Si `related_principle` viene `null`, o si hay `KnowledgeEntry` activas
adicionales relacionadas con este `hook_type` o `angle` que `strategist`
no citó como decisivas (`GET /knowledge?app_id=` filtrando por
`related_hook_type`/`related_angle`), respeta también lo que digan sobre
estructura/timing — misma jerarquía de desempate que usa `strategist` si
dos entradas se contradicen (mayor `confidence` → más `evidence` →
`source="observed"` sobre `"research"`).

**Caso real que motivó esto:** en un reel de Padelco, `strategist`
decidió bien el `hook_type` aplicando su jerarquía de desempate — pero
como antes solo llegaba aquí la etiqueta `hook_type` ganadora, sin el
texto del `principle` que la sustentaba, la escena 1 del guion resultante
tuvo un hook_type correcto en el papel pero una `visual_direction` que no
reflejaba el principio real detrás de esa decisión: nunca se llegó a leer
el porqué, solo la etiqueta. `related_principle` existe para que eso no
se repita.

### 2. Si hay inspired_by_id: preservar mecánica, no copiar contenido

Si `inspired_by_id` viene informado, `GET /trend-sources/{inspired_by_id}`
y lee su `extracted_formula` (ej. `hook_timing_s`,
`retention_trigger_interval_s`, `payoff_type`). Ajusta el guion para
conservar esa mecánica estructural:

- El hook debe aparecer en torno al mismo `hook_timing_s`.
- Los "retention triggers" (giros, preguntas, cambios de plano/ritmo)
  deben espaciarse aproximadamente cada `retention_trigger_interval_s`.
- El tipo de resolución final debe seguir el mismo `payoff_type`.

Nunca copiar texto literal, nombres, marca, ni detalles específicos del
vídeo original — solo la mecánica/estructura es transferible, el
contenido tiene que ser 100% propio de esta app y este angle.

### 3. Generar el guion (shape exacto)

**Para `content_type` en `"reel"`/`"short"`:**

```json
{
  "hook_text": "string",
  "scenes": [
    {
      "order": 1,
      "duration_s": 3,
      "voiceover": "string",
      "visual_direction": "string",
      "on_screen_text": "string",
      "source": "footage" | "generate"
    }
  ],
  "cta": "string"
}
```

**Para `content_type="carousel"`:**

```json
{
  "slides": [
    {
      "order": 1,
      "headline": "string",
      "body": "string",
      "visual_direction": "string"
    }
  ]
}
```

Genera 2-3 variantes de `hook_text` (para A/B testing ligero) y elige la
mejor para persistir como `hook_text` final — las descartadas no se
persisten, no hay campo para variantes no elegidas hoy.

**Sobre el campo `source` por escena (solo vídeo):** es una *intención*,
no una decisión final de si existe footage reutilizable — eso lo
resuelve después la Skill de producción contra la galería
(`GalleryItem`). Márcalo `"footage"` solo cuando el tipo de contenido
descrito sea razonable que ya exista en la librería propia de la app
(ej. "primer plano del founder hablando a cámara", "toma de la app en
uso real capturada antes"). Márcalo `"generate"` para todo lo demás
(cualquier escena que dependa del angle/guion concreto de hoy y no sea
un plano genérico reutilizable).

### 4. Persistir

`POST /content-pieces` con:

```json
{
  "app_id": "...",
  "content_type": "reel" | "short" | "carousel",
  "angle": "...",
  "hook_type": "...",
  "hook_text": "...",
  "script": { /* shape del paso 3 según content_type */ },
  "inspired_by_id": "..." | null
}
```

La pieza queda creada en `status="scripted"` (ya lo hace el endpoint).
No hace falta ningún otro paso de escritura — el siguiente paso
determinista es `POST /content/{id}/produce`, fuera del alcance de esta
Skill.
