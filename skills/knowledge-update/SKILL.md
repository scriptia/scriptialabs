---
name: knowledge-update
description: Revisa performance nueva y TrendSource analizados recientemente, y añade o corrige entradas de KnowledgeEntry — nunca borra, marca las superadas.
---

# Knowledge Update

## Responsabilidad

Revisa la performance real recogida por feedback-collection y los
`TrendSource` analizados recientemente por trend-analysis, y decide si
esa evidencia confirma, refina o contradice principios existentes en
`KnowledgeEntry`. Nunca borra una entrada: si algo cambia, crea una
versión nueva con `supersedes_id` apuntando a la anterior (que queda
`is_active=False`), preservando el historial completo de cómo evolucionó
cada creencia. Es la pieza que hace que el research genérico
(`source="research"`, cifras sin verificar) se vaya sustituyendo por
conocimiento propio (`source="observed"`, con evidencia real de cada
app) con el tiempo.

## Endpoints de la API que necesita

**Base URL y autenticación:** todas las llamadas van contra
`${CONTENT_ENGINE_API_BASE}` (env var; default `http://localhost:3000` en
dev) + la ruta indicada, con el header `Authorization: Bearer
${CONTENT_ENGINE_API_TOKEN}` en cada petición. Antes esto apuntaba a
`localhost:8000` (FastAPI, `b2c-content-agent`); ahora son los route
handlers de `src/app/api/content-engine/*` en scriptialabs (ver ADR-012)
— los 4 endpoints ya existen (Fase 3, bloque 3). Esta Skill puede
completar su trabajo de verdad contra scriptialabs.

- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/knowledge?app_id={id}` —
  principios activos actuales (para saber qué podría necesitar
  actualización); pásale `include_inactive=true` si además hace falta
  ver el historial de versiones superadas
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/content-pieces/performance-summary?app_id={id}&days=` —
  performance nueva agregada por angle/hook_type, con la que confirmar o
  contradecir un principio existente
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/trend-sources?niche=&limit=` —
  trends analizados recientemente
- ✅ `POST ${CONTENT_ENGINE_API_BASE}/api/content-engine/knowledge` —
  crea la nueva versión (con `supersedes_id` si reemplaza una entrada
  existente). Mismo patrón de versionado que el resto del sistema:
  nunca se hace `UPDATE` in-place — la entrada anterior queda
  `is_active=false` con `superseded_by_id` apuntando a la nueva, que
  nace `is_active=true`. Verificado con `curl` real: v1 (`research`,
  global) superada por v2 (`observed`, específica de una app), v1
  confirmada en DB con `is_active=false` y `superseded_by_id` correcto.

## TODO

Esqueleto — sin lógica de razonamiento todavía (qué umbral de evidencia
hace falta para subir/bajar `confidence`, cada cuánto correr esta Skill,
y cómo relacionar una entrada de `KnowledgeEntry` con el `angle`/
`hook_type` concreto de `performance-summary` que la confirma o
contradice — hoy `KnowledgeEntry.evidence` es JSON libre, sin un campo
estructurado tipo `related_angle` que haga ese cruce trivial).
