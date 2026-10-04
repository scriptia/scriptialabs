---
name: seo-article
description: Planifica y redacta las guías SEO/GEO de una app (5–10 por app y por idioma) como borradores Markdown en content/articles/<app>/<locale>/, listos para revisión humana y para scripts/publish-articles.ts. Úsala cuando se pida "plan de artículos para <app>", "escribe la guía sobre <tema> para <app>" o "prepara contenido SEO/GEO de <app>".
---

# SEO article

## Responsabilidad

Producir artículos útiles de verdad para una app del estudio, que posicionen en
buscadores y que los motores de respuesta (ChatGPT, Perplexity, Claude, AI
Overviews) quieran citar. La arquitectura está en
[ADR-014](../../docs/adr/ADR-014-product-articles.md) y las reglas editoriales en
[docs/content-articles.md](../../docs/content-articles.md): léelas antes de
escribir.

**Esta Skill nunca publica.** Escribe ficheros con `status: draft`, ejecuta el
`--dry-run` y se para. Publicar (cambiar a `published` y lanzar el script) lo
decide una persona después de revisar.

## Modo 1 — Plan (una vez por app)

Salida: `content/articles/<app>/PLAN.md`.

1. Reúne las fuentes reales de la app — nunca inventes:
   - Ficha de la app: página `/{locale}/<app>` (o la fila `products`).
   - Palabras clave ASO: `Tools/asc/metadata.py` del repo de la app (keywords,
     subtítulo, descripción por idioma). Repos: `~/Desktop/Scriptia/DogTrain/Tailwise`
     (Pupdojo), `~/Desktop/Scriptia/CatTrain` (Purrdojo),
     `~/Desktop/Scriptia/Teleprompter` (Cuevo), etc. Si no sabes cuál, pregunta.
   - Contenido de la app (programas, lecciones, ejercicios, features): es lo que
     da a los artículos datos concretos que nadie más tiene.
2. Propón **5–10 temas por idioma** (`en`, `es` y, si tiene sentido, `ca`). Cada
   tema: la búsqueda real que responde (`targetQuery`), la intención (cómo
   hacer / qué es / comparativa / problema), el ángulo propio que aporta la app,
   el `slug` y el `translationKey`.
   - Prioriza preguntas de problema concreto ("cómo evitar que mi cachorro
     muerda") sobre temas genéricos ("adiestramiento canino").
   - No hagas dos artículos que respondan la misma búsqueda (canibalización).
   - En `es` y `ca` piensa en lo que se busca allí, no traduzcas la lista `en`.
     Comparte `translationKey` solo cuando sea el mismo artículo.
3. Presenta el plan y **espera aprobación** antes de redactar.

## Modo 2 — Redactar un artículo

Salida: `content/articles/<app>/<locale>/<slug>.md`, partiendo de
`content/articles/_TEMPLATE.md`, con `status: draft`.

Estructura obligatoria:

- **Primer párrafo = la respuesta** en 2–3 frases: qué funciona, en cuánto
  tiempo, el error que evitar. Es el fragmento que se cita.
- **4–7 secciones `##` formuladas como preguntas** que la gente busca.
- **Pasos numerados** con duraciones, repeticiones y señales de progreso.
- **Datos concretos** (edades, minutos, días, porcentajes) que salgan del
  contenido de la app o de conocimiento general contrastable. Nada de estudios,
  cifras o citas inventadas; si no estás seguro de un dato, no lo pongas.
- **Un enlace natural a la app** (`[Pupdojo](/pupdojo)`) donde ayude al lector,
  no como anuncio. Puede enlazar a otra guía de la misma app si existe.
- **`## FAQ` al final** con 3–5 preguntas `###`, cada respuesta autosuficiente en
  2–4 frases.
- 900–1.800 palabras. `title` ≤ 60 caracteres, `description` 120–160.
- Tono: el de la app, en segunda persona, sin relleno ni frases de IA genéricas
  ("en el mundo actual", "en conclusión", "sumérgete").

Después:

1. Ejecuta `npx tsx scripts/publish-articles.ts <app> --dry-run --only <translationKey>`
   y corrige errores y avisos razonables.
2. Entrega un resumen: búsqueda objetivo, palabras, secciones, qué datos vienen
   de la app y cualquier afirmación que convenga verificar.

## Lo que esta Skill NO hace

- No cambia `status` a `published` ni ejecuta el script sin `--dry-run`.
- No genera artículos en bloque: como mucho los del plan aprobado, uno a uno.
- No toca código del sitio; si el formato se queda corto (tablas, imágenes),
  lo propone como cambio aparte.
