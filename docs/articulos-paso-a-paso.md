# Cómo subir artículos SEO/GEO — paso a paso

Guía práctica para publicar las guías de cada app en
`https://www.idionlabs.com/{idioma}/{app}/guides/{articulo}`. La referencia
técnica está en [content-articles.md](content-articles.md) y el porqué en
[ADR-014](adr/ADR-014-product-articles.md).

---

## A. Puesta en marcha (una sola vez)

Hasta completar estos cuatro pasos los artículos no se pueden publicar.

### 1. Crear la tabla en la base de datos de producción

Desde la carpeta `scriptialabs`, con la `DATABASE_URL` de Neon (producción):

```bash
DATABASE_URL='postgresql://…neon.tech/neondb?sslmode=require' npx drizzle-kit push
```

Te enseña el SQL y pide confirmación. **Solo debe aparecer** un
`CREATE TABLE "product_articles"`, su clave foránea a `products` y tres
`CREATE … INDEX "product_articles_…"`. Si aparece cualquier `DROP` o `ALTER` de
otra tabla, responde que no y revisadlo antes.

### 2. Crear el token de publicación

Genera un valor aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- En **Vercel → scriptialabs → Settings → Environment Variables** añade
  `ARTICLE_INGEST_TOKEN` con ese valor (Production) y vuelve a desplegar.
- En tu ordenador, añade la misma línea a `scriptialabs/.env.local`:
  `ARTICLE_INGEST_TOKEN=…`. Ese fichero no se sube a git.

### 3. Desplegar el código

Fusiona la rama `feat/product-articles` en `master` (PR en GitHub) para que
Vercel despliegue las páginas `/guides`, `/llms.txt` y el nuevo `robots.txt`.
Haz el paso 1 **antes** de fusionar: el código nuevo lee la tabla.

### 4. Search Console y Bing

- Añade `www.idionlabs.com` a **Google Search Console** y envía
  `https://www.idionlabs.com/sitemap.xml`.
- Haz lo mismo en **Bing Webmaster Tools**: Bing alimenta la búsqueda de
  ChatGPT y Copilot.

---

## B. Publicar los artículos de una app (cada vez)

### 1. Plan de temas

Abre Claude Code en `scriptialabs` y pide:

> Usa la skill seo-article y haz el plan de artículos para **pupdojo**.

Claude lee la ficha de la app, sus palabras clave ASO y su contenido, y propone
5–10 temas por idioma en `content/articles/pupdojo/PLAN.md`. Revísalo: quita
temas que se solapen y comprueba que cada uno responde algo que la gente busca
de verdad. Aprueba el plan.

### 2. Redactar

> Escribe el artículo **stop-puppy-biting** del plan, en inglés y en español.

Crea los ficheros como borradores:

```
content/articles/pupdojo/en/stop-puppy-biting.md
content/articles/pupdojo/es/como-evitar-que-tu-cachorro-muerda.md
```

Mismo artículo en dos idiomas = mismo `translationKey`. El nombre del fichero
es la URL.

También los puedes escribir a mano partiendo de
[`content/articles/_TEMPLATE.md`](../content/articles/_TEMPLATE.md).

### 3. Revisar (una persona, siempre)

Antes de publicar, comprueba que:

- el primer párrafo responde la pregunta directamente;
- los datos (edades, tiempos, cifras) son correctos y no hay nada inventado;
- el tono es el de la app y hay un único enlace natural a ella (`/pupdojo`);
- el `title` tiene unos 60 caracteres y la `description` entre 120 y 160;
- hay una sección final `## FAQ` (o `## Preguntas frecuentes`).

Cuando esté bien, cambia en la cabecera `status: draft` por `status: published`.

### 4. Comprobar sin publicar

```bash
npx tsx scripts/publish-articles.ts pupdojo --dry-run
```

Muestra cada artículo con sus palabras, el número de preguntas del FAQ y los
avisos (`!`). Los errores bloquean y hay que corregirlos. Los avisos son
recomendaciones: léelos y decide.

### 5. Publicar

```bash
npx tsx scripts/publish-articles.ts pupdojo
```

Para publicar uno solo: `--only stop-puppy-biting`. Al acabar imprime las URLs.
Las páginas están en línea en segundos, sin redesplegar.

### 6. Verificar

- Abre las URLs que ha imprimido el script.
- Abre `https://www.idionlabs.com/en/pupdojo`: abajo aparece la sección
  **Guides** con los artículos.
- Comprueba los datos estructurados de un artículo en
  https://search.google.com/test/rich-results.

### 7. Que aparezcan en Google

Los artículos solo entran en el sitemap y en `/llms.txt`, y solo dejan de ser
`noindex`, cuando la app tiene activado **Indexable** en el panel
(`/internal/products/pupdojo`). Normalmente se activa al lanzar la app. Si ya
está activado, no hay que hacer nada más.

### 8. Guardar en git

```bash
git add content/articles/pupdojo
git commit -m "content: pupdojo guides"
git push
```

Así cada texto publicado queda en el historial.

---

## C. Tareas habituales

| Quiero… | Qué hacer |
|---|---|
| Corregir un artículo | Edita el `.md` y vuelve a ejecutar el paso B5. Solo cambia la fecha de "actualizado" si cambia el texto. |
| Despublicar un artículo | Pon `status: draft` y vuelve a publicar. Borrar el fichero **no** lo quita de la web. |
| Cambiar la URL | Renombra el fichero manteniendo el `translationKey`. La URL vieja dará 404, así que evítalo si ya está indexado. |
| Añadir otro idioma | Crea el fichero en `es/` o `ca/` con el mismo `translationKey`. |
| Probar en local | Arranca `npm run dev` y añade `--base-url http://localhost:3000`. |

## D. Si algo falla

| Mensaje | Causa y solución |
|---|---|
| `ARTICLE_INGEST_TOKEN is not set` | Falta en `.env.local` (paso A2). |
| `401 Invalid or missing bearer token` | El token local no coincide con el de Vercel. |
| `503 … is not configured` | Falta `ARTICLE_INGEST_TOKEN` en Vercel o no se ha redesplegado. |
| `404 No product with slug` | La app no existe en la web. Usa el slug de su URL (`pupdojo`, `purrdojo`, `cuevo`…). |
| `409 … already belongs to article` | Esa URL ya la usa otro artículo del mismo idioma: cambia el nombre del fichero. |
| `422` o errores de validación | El script indica el fichero y el campo: título demasiado largo, falta un campo en la cabecera, slug con mayúsculas, etc. |
| La página da 404 después de publicar | El artículo está en `draft`, o la app no está publicada en el panel. |
| No sale en Google | La app no tiene **Indexable** activado, o Google aún no lo ha rastreado (puede tardar días). |
