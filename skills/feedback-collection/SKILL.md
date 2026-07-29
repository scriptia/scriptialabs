---
name: feedback-collection
description: Recoge métricas reales de RRSS de piezas ya publicadas manualmente (yt-dlp para YouTube, scraping ligero para IG/TikTok) y las persiste.
---

# Feedback Collection

## Responsabilidad

Para piezas ya aprobadas y publicadas manualmente (Marc revisa/publica él
mismo, MVP sin automatizar distribución), recoge sus métricas reales de
RRSS — yt-dlp para YouTube, scraping ligero para Instagram/TikTok (no hay
API pública de metrics gratuita y estable para estas dos) — y las
persiste como `SocialMetric`, encadenada a su `Publication`. Cierra el
loop de iteración: sin esto, `knowledge-update` no tiene datos reales con
los que confirmar o descartar hipótesis.

## Endpoints de la API que necesita

**Base URL y autenticación:** todas las llamadas van contra
`${CONTENT_ENGINE_API_BASE}` (env var; default `http://localhost:3000` en
dev) + la ruta indicada, con el header `Authorization: Bearer
${CONTENT_ENGINE_API_TOKEN}` en cada petición. Antes esto apuntaba a
`localhost:8000` (FastAPI, `b2c-content-agent`); ahora son los route
handlers de `src/app/api/content-engine/*` en scriptialabs (ver ADR-012)
— de los 3 endpoints que necesita, solo 1 existe ahí hoy.

- ❌ **PENDIENTE (Fase 3)** `POST /content-pieces/{id}/publish` — lo usa
  quien publica manualmente (Marc, o una Skill futura vía Postiz) para
  registrar que una pieza salió de verdad: crea la `Publication` y pasa
  `ContentPiece.status` a `published`. `external_post_id` viene relleno
  solo si se publicó vía Postiz — esta Skill lo usa para decidir su
  propia fuente de datos (ver siguiente punto)
- ✅ `GET ${CONTENT_ENGINE_API_BASE}/api/content-engine/publications?app_id={id}&stale_hours=24` —
  qué `Publication` necesitan una métrica nueva (ninguna, o la última
  capturada hace más de `stale_hours`), con `hasExternalPostId`
  indicando si esta Skill puede usar `services/postiz.py` o necesita
  yt-dlp/scraping propio — es lo que esta Skill recorre en cada ejecución
- ❌ **PENDIENTE (Fase 3)** `POST /publications/{id}/social-metrics` —
  persiste un snapshot nuevo (no un update — se llama repetidamente
  sobre la misma Publication conforme pasan los días)

Sin los dos endpoints de escritura, esta Skill puede leer qué
`Publication` están stale (paso ya real) pero no puede persistir nada
todavía — el loop de feedback sigue incompleto hasta la Fase 3.

## Fuente de datos por Publication (decisión tomada)

Para cada `Publication` que devuelve `GET /publications?stale_hours=`, la
fuente de la métrica se decide así, sin ambigüedad:

- **`has_external_post_id=true`** (se publicó vía Postiz) → usar
  `services/postiz.py` (`get_post_analytics`/`get_platform_analytics`).
  Es la fuente más fiable y no depende de scraping frágil, así que tiene
  prioridad siempre que exista `external_post_id`.
- **`has_external_post_id=false`** (publicación manual, sin Postiz) → el
  `platform` de la `Publication` decide la herramienta:
  - `platform="youtube_shorts"` → yt-dlp (extrae views/likes/comments
    públicos sin necesitar API key)
  - `platform="instagram"` o `platform="tiktok"` → scraping ligero (no
    hay API pública de métricas gratuita y estable para ninguna de las
    dos)

En ambos casos, el resultado se persiste igual: `POST /publications/{id}/social-metrics`
con los campos que la fuente en cuestión pueda dar (yt-dlp y el scraping
ligero no siempre exponen `reach`/`saves`, por ejemplo — se omiten y la
columna cae a su default, no se inventa un valor).

## Camino yt-dlp — probado contra un vídeo real (YouTube)

Comando exacto, probado contra un vídeo público de pádel
(`https://www.youtube.com/watch?v=gFl3ADnFRtc`, "THE BEST PADEL POINTS
OF 2025... so far", canal Daily Padel):

```bash
yt-dlp --dump-json --no-warnings --skip-download "{permalink_de_la_Publication}"
```

`--skip-download` es obligatorio — solo hace falta el JSON de metadata,
nunca descargar el vídeo en sí. La salida es un único JSON por línea;
los campos que importan para `POST /publications/{id}/social-metrics`
son `view_count` → `views`, `like_count` → `likes`,
`comment_count` → `comments`. Resultado real de la prueba:

```json
{"view_count": 838440, "like_count": 2813, "comment_count": 24}
```

No expone `shares`/`saves`/`reach` — YouTube no los da vía metadata
pública. Esos campos se omiten al persistir (caen a su default en
`SocialMetric`, no se inventan).

Invocación equivalente en Python (si se prefiere sobre shell-out, mismo
resultado):

```python
import yt_dlp

with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
    info = ydl.extract_info(permalink, download=False)

views = info.get("view_count")
likes = info.get("like_count")
comments = info.get("comment_count")
```

## TODO

Esqueleto — sin lógica de razonamiento ni de scraping todavía (cada
cuánto correr esta Skill, y cuándo dejar de refrescar una Publication ya
vieja en vez de seguir haciéndolo para siempre).
