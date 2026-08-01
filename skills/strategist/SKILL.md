---
name: strategist
description: Decide el ángulo y formato de contenido del día para una app, cruzando conocimiento acumulado, trends recientes y performance histórica propia. No persiste — entrega su decisión a scriptwriter en la misma sesión.
---

# Strategist

## Responsabilidad

Decide el ángulo (y formato: reel/carousel/short) de contenido del día
para una app concreta, cruzando: `KnowledgeEntry` activas (globales +
específicas de esa app), `TrendSource` recientes del mismo nicho, y
performance histórica propia de la app (qué angle/hook_type ya le
funcionó). Prioriza siempre lo que ya ha funcionado para ESA app sobre
teoría general, y evita repetir angle/hook_type de los últimos días.
Sustituye a `StrategistAgent.decide()` (eliminado — era la llamada LLM
directa desde Python).

**Esta Skill no persiste nada en la API.** Solo decide y entrega su
decisión como input directo a `scriptwriter` en la misma sesión —
`scriptwriter` es quien llama a `POST /content-pieces` con el guion ya
completo.

## Endpoints de la API que necesita

**Base URL y autenticación:** todas las llamadas van contra
`${CONTENT_ENGINE_API_BASE}` (env var; default `http://localhost:3000` en
dev) + la ruta indicada, con el header `Authorization: Bearer
${CONTENT_ENGINE_API_TOKEN}` en cada petición — sin ese header la API
responde 401 (o 503 si el token no está configurado en el servidor).
Antes esto apuntaba a `localhost:8000` (el FastAPI de `b2c-content-agent`,
el repo original); ahora son los route handlers de
`src/app/api/content-engine/*` en este mismo repo (scriptialabs, ver
ADR-012). Los 5 endpoints de esta Skill son de solo lectura y **ya
existen todos** — strategist no tiene ningún gap pendiente.

- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/apps` — perfil
  completo de la app (brand/product/audience/business_goals); filtra tú
  mismo por `id` en la respuesta, es la lista completa
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/trend-sources?niche={niche}&limit=15` —
  trends recientes del mismo nicho
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/knowledge?app_id={id}` —
  principios activos (globales + de esta app)
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/content-pieces/performance-summary?app_id={id}&days=14` —
  performance propia agregada por angle y por hook_type (piece_count,
  avg y avg_per_reach cuando hay reach>0 registrado; si no, solo avg
  absoluto — ver `note` de la propia respuesta)
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/content-pieces?app_id={id}&days=14` —
  piezas recientes (cualquier status) para detectar angle/hook_type ya
  usado y no repetirlo

## Procedimiento

### 1. Recogida de contexto

Con `app_id` como input, obtén en este orden (todo de solo lectura):

1. `GET /apps/` → filtra la app cuyo `id` coincide con `app_id`. Extrae
   `niche`, `brand_profile`, `product_profile`, `audience_profile`,
   `business_goals`.
2. `GET /trend-sources?niche={niche}&limit=15` → trends recientes de ese
   mismo nicho, con su `extracted_formula` si ya existe.
3. `GET /knowledge?app_id={app_id}` → principios activos aplicables
   (globales + específicos de esta app).
4. `GET /content-pieces/performance-summary?app_id={app_id}&days=14` →
   qué angle/hook_type está funcionando mejor ahora mismo para esta app
   en concreto.
5. `GET /content-pieces?app_id={app_id}&days=14` → piezas ya decididas
   en los últimos 14 días (cualquier status), para construir el set de
   `(angle, hook_type)` ya usados que hay que evitar repetir.

### 2. Resolver conflictos entre KnowledgeEntry

Dos `KnowledgeEntry` "compiten" cuando comparten el mismo
`related_angle` o el mismo `related_hook_type` pero apuntan a
conclusiones distintas o contradictorias (ej. una dice que un hook_type
funciona bien y otra dice que funciona mal). Cuando eso pasa, la
jerarquía de desempate es esta, EXACTA y en este orden — no la resumas
ni la sustituyas por criterio propio:

1. **Gana la de mayor `confidence`.**
2. **Empate en `confidence`** → gana la que tenga más items en
   `evidence` (más señal respaldándola).
3. **Empate también en eso** → gana `source="observed"` sobre
   `source="research"` (evidencia real de la app pesa más que research
   genérico sin verificar).

Si tras aplicar los 3 niveles sigue habiendo empate exacto, trata ambas
como válidas simultáneamente (no hay base para preferir una).

Cuando una `KnowledgeEntry` concreta sea la que decide un `angle` o
`hook_type` (ya sea porque ganó un desempate, o porque fue la única
relevante), retén el texto completo de su `principle` — no solo el
`angle`/`hook_type` que confirma. Hace falta para el paso 4: pasárselo
íntegro a `scriptwriter`, no solo la etiqueta (ver ahí el caso real que
motivó esto).

### 3. Decidir EXACTAMENTE 2 propuestas

Una propuesta con `content_type="reel"` (o `"short"`, según lo que la
app use — revisa `product_profile`/histórico si hay ambigüedad) y una
con `content_type="carousel"`. Nunca el mismo `angle` + `hook_type` para
las dos — deben ser dos ideas distintas, no la misma idea en dos
formatos.

Para cada propuesta, antes de fijarla como definitiva:

- Cruza `(angle, hook_type)` candidato contra el set de pares ya usados
  en los últimos 14 días (paso 1.5). Si coincide, descarta esa
  combinación y decide otra — no se permite repetir angle+hook_type
  reciente aunque haya funcionado bien (esa señal ya se refleja en el
  peso que le das a `performance-summary` al elegir, no en repetir
  literalmente la misma pieza).
- Prioriza combinaciones respaldadas por `performance-summary` propio
  (avg_per_reach alto en ese angle/hook_type) sobre las respaldadas solo
  por `KnowledgeEntry` de `source="research"` — es la aplicación directa
  de "prioriza lo que ya funcionó para ESTA app sobre teoría general".
- Si un `TrendSource` reciente encaja con el angle elegido, resulta
  natural, y no está inspirado en algo que ya se usó, considera fijar
  `inspired_by_id` a ese `TrendSource`. No es obligatorio — muchas
  propuestas no tienen un trend concreto detrás.

### 4. Entregar la decisión

Para cada una de las 2 propuestas, entrega esta estructura como input
directo para `scriptwriter` (no se persiste aquí):

```
{
  "content_type": "reel" | "short" | "carousel",
  "angle": str,
  "hook_type": str,
  "inspired_by_id": str | null,
  "related_principle": str | null,  # texto COMPLETO del principle de la
                                     # KnowledgeEntry que decidió este angle/
                                     # hook_type (ver paso 2) — nunca solo su
                                     # angle/hook_type como si fuera la
                                     # decisión entera. null si ninguna
                                     # KnowledgeEntry concreta fue decisiva
                                     # (la propuesta salió solo de trend/
                                     # performance-summary).
  "reasoning": str  # 1-3 frases: qué evidencia (performance/knowledge/trend)
                    # pesó más y por qué se descartaron alternativas repetidas
}
```

`reasoning` es para trazabilidad humana en el review, no se persiste
como campo estructurado — si se quiere guardar, cabe en
`ContentPiece.generated_by` cuando scriptwriter cree la pieza.

**Por qué `related_principle` va como texto completo, no como
angle/hook_type:** en un reel de Padelco, esta Skill decidió bien el
`hook_type` aplicando la jerarquía de desempate del paso 2 — pero como
antes solo se le pasaba a `scriptwriter` la etiqueta `hook_type` ganadora
(no el texto del `principle` que la sustentaba), la escena 1 del guion
resultante tuvo un hook_type correcto en el papel pero una
`visual_direction` que no reflejaba el principio real detrás de esa
decisión: `scriptwriter` nunca llegó a leer el porqué, solo la etiqueta.
Pasar el texto completo es lo que le permite a `scriptwriter` traducir
ese principio a decisiones de ejecución (energía visual, ritmo, tono),
no solo a elegir la misma etiqueta que ya eligió esta Skill.
