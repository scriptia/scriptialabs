---
name: trend-analysis
description: Dado el link de un vídeo viral, lo transcribe y analiza (Twelve Labs), extrae su fórmula transferible, y la persiste.
---

# Trend Analysis

## Responsabilidad

Dado un vídeo viral (pegado a mano vía `/review` en el dashboard, o
descubierto por `TrendScoutAgent.discover()` cuando exista watchlist),
transcribe y analiza su contenido visual (ya hecho de forma determinista
por `TrendScoutAgent.ingest()` vía Twelve Labs) y razona sobre el
transcript/scene_breakdown resultante para extraer la "fórmula
transferible" — hook_type, timing, intervalo de retention triggers,
payoff, y qué elementos NO son copiables (marca, cara del creador, guion
literal). Persiste su conclusión, nunca inventa cifras que no pueda
justificar con la evidencia del propio vídeo.

## Endpoints de la API que necesita

**Base URL y autenticación:** todas las llamadas van contra
`${CONTENT_ENGINE_API_BASE}` (env var; default `http://localhost:3000` en
dev) + la ruta indicada, con el header `Authorization: Bearer
${CONTENT_ENGINE_API_TOKEN}` en cada petición. Antes esto apuntaba a
`localhost:8000` (FastAPI, `b2c-content-agent`); ahora son los route
handlers de `src/app/api/content-engine/*` en scriptialabs (ver ADR-012)
— los 4 endpoints ya existen (Fase 3, bloque 2).

- ⚠️ ✅-con-matiz `POST ${CONTENT_ENGINE_API_BASE}/api/content-engine/trend-sources/from-link` —
  body `{app_id, url, platform, raw_metrics?}`. Crea el `TrendSource` de
  verdad (`niche` se resuelve del `app_id`), pero **no llama a Twelve
  Labs** — no existe ese executor en este backend todavía (mismo tipo
  de gap que Kling/Shotstack en `video-production`). El `TrendSource`
  creado tiene `transcript`/`sceneBreakdown` vacíos. Esta Skill sigue
  necesitando obtener el transcript/scene_breakdown ella misma (Twelve
  Labs directo, fuera de este proceso) antes de poder razonar sobre
  algo — el endpoint solo registra el link, no lo analiza
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/trend-sources?niche=&limit=` —
  trends recientes del nicho, por si hace falta contexto de qué más se
  ha analizado últimamente
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/trend-sources/{id}` —
  releer un TrendSource que no se creó en esta misma invocación (ej. uno
  ingerido por otra persona hace días)
- ✅ `PATCH ${CONTENT_ENGINE_API_BASE}/api/content-engine/trend-sources/{id}/formula` —
  body `{extracted_formula: {...}}`. Persiste la conclusión —
  sobreescritura simple, sin versionado (a diferencia de
  `KnowledgeEntry`/`IntegrationConfig`): corregir el análisis de un
  vídeo concreto corrige ese mismo registro, no crea una versión nueva
  de una creencia pasada

## TODO

Esqueleto — sin lógica de razonamiento todavía (qué heurísticas usar
sobre el transcript/scene_breakdown para separar mecánica transferible de
elementos no copiables).
