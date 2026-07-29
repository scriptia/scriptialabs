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
— las 2 lecturas ya existen, las 2 escrituras no.

- ❌ **PENDIENTE (Fase 3)** `POST /trend-sources/from-link` — ingesta
  determinista (Twelve Labs); la respuesta ya incluye
  `transcript`/`sceneBreakdown` del TrendSource recién creado. Sin esto
  no hay forma de dar de alta un TrendSource nuevo — esta Skill no
  puede arrancar su trabajo todavía contra scriptialabs
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/trend-sources?niche=&limit=` —
  trends recientes del nicho, por si hace falta contexto de qué más se
  ha analizado últimamente
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/trend-sources/{id}` —
  releer un TrendSource que no se creó en esta misma invocación (ej. uno
  ingerido por otra persona hace días)
- ❌ **PENDIENTE (Fase 3)** `PATCH /trend-sources/{id}/formula` —
  persiste `extractedFormula`. Sin esto, aunque se pudiera leer un
  TrendSource, esta Skill no podría guardar su conclusión.

## TODO

Esqueleto — sin lógica de razonamiento todavía (qué heurísticas usar
sobre el transcript/scene_breakdown para separar mecánica transferible de
elementos no copiables).
