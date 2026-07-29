---
name: orchestrator
description: Conoce el pipeline completo del Content Engine y decide qué Skill invocar y en qué orden para una app dada, en modo "daily" o "feedback".
---

# Orchestrator

## Responsabilidad

Conoce el pipeline completo (trend-analysis → strategist → scriptwriter
→ video-production/carousel-production → feedback-collection →
knowledge-update) y decide, para una app concreta, qué Skill invocar a
continuación y con qué datos — sustituye a la orquestación que antes
hacía `routers/pipeline.py` + `tasks/daily_pipeline.py` llamando a los
métodos `.run()` de los agentes en Python. No razona sobre contenido en
sí (eso lo hacen las demás Skills); decide secuencia.

**No invoca producción.** `video-production`/`carousel-production`
implican gasto real (Kling/Shotstack) y quedan siempre como paso manual
explícito, disparado por Marc después de revisar el guion en `/review`
(el botón "Copiar comando" de esa pantalla existe precisamente porque
este paso no se dispara solo).

## Endpoints de la API que necesita

**Base URL y autenticación:** todas las llamadas van contra
`${CONTENT_ENGINE_API_BASE}` (env var; default `http://localhost:3000` en
dev) + la ruta indicada, con el header `Authorization: Bearer
${CONTENT_ENGINE_API_TOKEN}` en cada petición. Antes esto apuntaba a
`localhost:8000` (FastAPI, `b2c-content-agent`); ahora son los route
handlers de `src/app/api/content-engine/*` en scriptialabs (ver ADR-012).

- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/apps` — qué apps
  existen y están activas
- ❌ **PENDIENTE (Fase 3)** `POST /trend-sources/from-link` — ingesta
  determinista de un link nuevo (modo daily). Sin esto, el paso
  condicional de trend-analysis en modo daily no puede ejecutarse de
  verdad todavía si hay un link nuevo que ingerir
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/content-pieces/performance-summary?app_id={id}&days=14` —
  input de strategist
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/publications?app_id={id}&stale_hours=168` —
  input de feedback-collection (modo feedback)

(El resto de endpoints que necesita cada paso ya están documentados en
el `SKILL.md` de esa Skill — el orchestrator no los llama directamente,
solo decide invocar esa Skill con qué argumento.)

## Modos

Esta Skill se invoca con `app_id` y un `mode`: `"daily"` o `"feedback"`.
Son secuencias completamente distintas — no hay un modo "hazlo todo",
para no acoplar el ciclo de generación (diario) al ciclo de medición
(semanal, tiene que esperar a que haya datos suficientes acumulados).

### Modo `"daily"`: generar las propuestas del día

1. **`trend-analysis`, solo condicional.** Se invoca únicamente si Marc
   pasa un link nuevo como argumento de esta misma invocación (ej.
   `mode=daily, new_trend_link=https://...`). No hay descubrimiento
   automático de links todavía (`TrendScoutAgent.discover()` sigue
   siendo un stub sin watchlist real — ver `PROJECT_BRIEF.md`), así que
   "pendiente" se define de la forma más simple posible: si no viene un
   link en el argumento, no hay nada pendiente y este paso se salta
   entero. No se consulta ningún otro estado para decidir esto.
2. **`strategist`, siempre.** Con o sin trend nuevo, strategist corre
   todos los días — decide las 2 propuestas del día (una reel/short, una
   carousel) cruzando `KnowledgeEntry` + performance + (si el paso 1
   corrió) el `TrendSource` recién analizado.
3. **`scriptwriter`, una vez por cada una de las 2 propuestas de
   strategist.** Dos invocaciones separadas, una por propuesta — cada
   una persiste su propio `ContentPiece` en `status="scripted"`.

Fin del modo daily. El orchestrator no continúa a producción — eso
espera a que Marc revise en `/review` y copie el comando de
`video-production`/`carousel-production` él mismo cuando decida
producir una pieza en concreto.

### Modo `"feedback"`: medir lo publicado

1. **`feedback-collection`, siempre**, sobre
   `GET /publications?app_id={id}&stale_hours=168` (una semana — el
   ciclo de feedback es semanal, no diario, para dar tiempo a que las
   métricas de RRSS maduren). Recoge métricas reales de cada
   `Publication` que lo necesite.
2. **`knowledge-update`, siempre después**, nunca antes — necesita las
   métricas recién recogidas por el paso 1 para poder confirmar o
   contradecir `KnowledgeEntry` existentes con evidencia fresca.

Fin del modo feedback. No toca `trend-analysis`/`strategist`/
`scriptwriter` — ese es el otro ciclo, con su propio disparador.

## TODO

Pendiente decidir si esta Skill se dispara manualmente (Marc la invoca
cuando quiere) o si se conecta a un disparador automático (ej.
`celery-beat` diario para modo `daily`, semanal para modo `feedback`) —
por ahora `celery-beat` solo dispara la parte determinista
(descubrimiento/ingesta vía `routers/pipeline.py`), no el razonamiento.
