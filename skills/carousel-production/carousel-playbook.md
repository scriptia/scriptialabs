# Playbook único: carruseles para Instagram + TikTok (2026)

> **Quién lee este fichero:** se embebe completo, no un resumen, cada
> vez que se hace una llamada relacionada con generar un carrusel:
> `scriptwriter` al escribir el guion de un `ContentPiece` con
> `content_type="carousel"` (hook, estructura, CTA, integración de
> app, esqueleto), y `carousel-production` al construir el prompt real
> de generación de imagen para cada slide que no tenga match en
> `GalleryItem`. Ver la referencia a este fichero en
> `skills/scriptwriter/SKILL.md` y `skills/carousel-production/SKILL.md`.

Un solo sistema de producción para las dos plataformas. Los dos algoritmos premian prácticamente las mismas señales (completion rate, guardados, envíos), así que en vez de tener dos manuales separados, esto es un único flujo con las pocas diferencias reales marcadas aparte para que no se pierdan.

---

## 0. Por qué se puede unificar

Instagram y TikTok en 2026 rankean carruseles por lo mismo: cuánta gente completa el carrusel, cuánta gente lo guarda o lo envía, y cuánto tiempo se queda en cada slide. Ninguna se fija en likes como señal principal. Eso significa que el 90% del trabajo — hook, estructura, diseño, CTA, integración de marketing — es idéntico en ambas. Lo único que cambia de verdad es el lienzo, el modo de subida y el tono del copy, y ni eso cambia mucho. Este documento trata todo como un sistema único y marca aparte, en un solo bloque al final, lo poco que sí hay que adaptar.

---

## 1. Cómo rankean ambas plataformas (lo que comparten)

- **La señal reina es el completion rate / swipe-through rate**: cuánta gente llega hasta el final del carrusel, no cuánta gente le da like.
- **Guardados y envíos pesan mucho más que likes** — en Instagram entre 3 y 5 veces más. En TikTok, guardados + comentarios son la señal fuerte tras el completion rate.
- **Cada slide es un evento de engagement individual**, no una imagen pasiva. El algoritmo mide swipe a swipe.
- **Ambas plataformas testean en oleadas**: Instagram vuelve a mostrar el post 24-48h después a quien no interactuó la primera vez si el completion rate fue bueno; TikTok testea primero con 200-500 usuarios y solo escala si las señales son fuertes. Consecuencia práctica idéntica en ambas: **el rendimiento de las primeras horas decide el alcance total**, así que conviene estar activo respondiendo comentarios justo tras publicar.
- El punto de fricción más importante en las dos es el mismo: la transición de la slide 1 a la 2. Si ahí no hay swipe, el post no se mueve más.

---

## 2. El sistema de archivo único (para reusar de verdad, no rehacer el diseño dos veces)

Esto es lo que te permite producir una vez y publicar en ambas sin doblar el trabajo:

1. **Diseña siempre en un lienzo de 1080×1920 px (formato TikTok, 9:16).**
2. **Mantén todo el contenido crítico — hook, texto, cara, elemento visual clave — dentro de una zona centrada de 1080×1350 px** (el formato 4:5 de Instagram). Esa zona central es exactamente lo que necesitas para exportar la versión de Instagram sin retocar nada.
3. **Exporta dos veces del mismo archivo:**
   - Versión completa 1080×1920 → sube nativa a TikTok (Photo Mode).
   - Recorte centrado 1080×1350 → sube nativa a Instagram (carrusel feed).
4. **Márgenes muertos que debes respetar siempre, en ambas plataformas:**
   - Nada crítico en el ~15-20% superior de la imagen (en Instagram lo tapa el nombre de usuario/inicio de caption; en TikTok es zona de header).
   - Nada crítico en el ~15-20% inferior (en Instagram lo tapan el corazón de like y la cinta de guardar y además se recorta en el grid de perfil; en TikTok lo tapa la caption).
   - Nada crítico en el 10-15% derecho si vas a subir también a TikTok — ahí van los iconos de perfil/like/comentar/compartir.

Con este método, el 100% del trabajo de copy, hook y estructura narrativa se hace una sola vez. Lo único que cambia entre plataformas es el recorte final y el modo de subida.

---

## 3. Slides: cuántos y por qué

- **Rango universal: 7-10 slides.** Es el punto que maximiza dwell time sin que caiga el completion rate, y funciona bien tanto en Instagram como en TikTok.
- Si el contenido es ligero o TikTok es la plataforma principal de ese post, puedes bajar a **5-7** sin perder nada — TikTok es algo más impaciente que Instagram.
- Si es una guía profunda, tutorial paso a paso o storytelling serializado, puedes subir a **12-15** en Instagram (en TikTok no conviene pasar de 10-12).
- Regla que manda sobre cualquier número: **cada slide tiene que aportar algo que la anterior no daba.** Rellenar para llegar a un número "óptimo" baja el completion rate y por tanto el alcance en las dos plataformas por igual.

---

## 4. El hook (slide 1): universal, con un matiz

Las fórmulas de hook son las mismas en ambas plataformas porque el cerebro humano no cambia de red social. El único matiz real:

- En **Instagram** tienes 2-3 segundos: si no hay swipe inmediato, el post prácticamente no se mueve más.
- En **TikTok** el hook es algo más perdonavidas porque el usuario ya está deslizando activamente cuando llega a tu carrusel (a diferencia del vídeo, donde te juegas todo en 1,5 segundos). Aun así, un hook débil sigue siendo la primera causa de carruseles muertos en las dos.

**Conclusión práctica: trata el hook siempre como crítico.** No hace falta versión distinta por plataforma.

### Fórmulas que funcionan (con datos, no genéricas)
1. **Resultado específico, no tema genérico.** "El sistema de 7 pasos que me llevó de 0 a 10K en 90 días" convierte 3-7x más en guardados que "Cómo crecer en redes".
2. **Brecha de curiosidad.** Prometer algo concreto sin resolverlo todavía.
3. **Half-reveal / seam split.** Partir una imagen o titular justo en la costura entre slide 1 y 2, obligando al swipe para "completar" lo que se ve.
4. **Contrarian / mito desmontado.** "Todo lo que te dijeron sobre [tema] ya no es verdad".
5. **Error señalado.** "5 errores de [actividad] que te están costando [resultado]" — la gente escanea buscando si comete ese error.
6. **Dato duro / benchmark.** Una cifra concreta rinde mejor que un hook puramente emocional, sobre todo en audiencias más analíticas.
7. **Pre-manejo de la objeción dentro del hook.** "Aunque odies [parte tediosa], esto funciona igual" — capta justo al público que normalmente pasaría de largo.
8. **Comando + guardar primed.** Empezar con "Guarda esto:" activa el comportamiento de guardado antes de que se evalúe el contenido.

### Reglas visuales (más importantes que el copy)
- Máximo 8-10 palabras, tipografía enorme, la más grande de todo el carrusel.
- Alto contraste siempre.
- Primer plano de cara humana o expresiva > paisaje o gráfico abstracto.
- El diseño tiene que parar el scroll antes de que nadie lea una palabra.

---

## 5. Mantener el hilo: slides 2 a N-1 (universal)

- **Una idea por slide.** Amontonar conceptos rompe el ritmo de swipe en ambas plataformas por igual.
- **Open loops.** Cada slide deja algo pendiente para la siguiente ("pero el paso 3 es el que cambia todo").
- **El "wait for it" payoff.** El dato más fuerte va en la última o penúltima slide, nunca al principio — así fuerzas el completion rate.
- **Regla del 20% de texto.** Ninguna slide con más del 20% de superficie cubierta de texto.
- **Elementos interactivos** (mini-quiz, "esto o lo otro") en las slides 3-5, que es donde más se abandona.
- **Varía la composición, mantén la identidad.** Mezcla primeros planos, texto grande, capturas, diagramas — pero con la misma paleta y tipografía en todo el carrusel.
- **Indicador de progreso** ("3/8") en la esquina si el carrusel es largo o tipo tutorial: reduce el abandono porque da una expectativa clara.

---

## 6. Diseño: tipografía, colores, fondos (universal)

- Sans-serif como base: más legible en pantallas pequeñas que serif.
- Máximo 2 fuentes por carrusel: una condensada/display en mayúsculas para hooks y titulares + una sans-serif neutra para el cuerpo.
- Fondo o borde consistente en todas las slides — "cose" el carrusel visualmente y hace que se perciba como una pieza, no como imágenes sueltas.
- **Tendencia dominante en 2026 en ambas plataformas: lo "en bruto" gana a lo sobre-producido.** Capturas de pantalla reales (notas del móvil, DMs, reviews), estética scrapbook (papel rasgado, cinta, Polaroid) y contenido con pinta de haber salido del móvil superan sistemáticamente al gráfico de agencia muy pulido — que cada vez se lee más como anuncio y se salta en las dos plataformas por igual.
- Carruseles mixtos (foto + clip de vídeo corto dentro del mismo carrusel) rinden por encima de los que son solo imágenes, tanto en Instagram como en TikTok.

---

## 7. Tono de copy: el único dial que de verdad hay que mover

- **TikTok:** minúsculas, conversacional, resultados concretos ("me ahorró 340€ sin darme cuenta" en vez de "ahorra dinero fácilmente").
- **Instagram:** puede permitirse un pelín más de pulido, pero la tendencia 2026 va exactamente en la misma dirección — el contenido crudo y auténtico gana terreno también aquí.
- **Regla práctica: escribe siempre en el tono casual/específico de TikTok por defecto.** Funciona nativo en TikTok y en Instagram no pierde nada — más bien gana, porque es la dirección en la que se mueve la plataforma. No hace falta reescribir el copy dos veces.

---

## 8. Caption y CTA (universal, con una nota de hashtags)

- La caption complementa el hook de la slide 1, no lo repite palabra por palabra.
- CTA de la última slide siempre pidiendo una acción concreta, nunca genérica:
  - "Guarda esto para la próxima vez que [situación específica]"
  - "Envíaselo a la persona que se encarga de [tarea específica]"
  - "Comenta [PALABRA] y te lo mando por DM"
  - "Desliza para ver la diferencia"
- CTAs con palabra clave + automatización de DM convierten 5-15%, frente al 1-3% de "link en bio" — funciona igual de bien en ambas plataformas.
- Prioriza siempre CTAs que empujen a guardar/enviar por encima de solo comentar o dar like: es la señal que más pesa en las dos.
- **Única diferencia real de esta sección — hashtags:** TikTok, 3-8 relevantes, mezclando algunos amplios y algunos de nicho. Instagram, pocos pero muy relevantes; el texto en la slide y la caption ya hacen de etiqueta semántica, los hashtags son un apoyo menor.

---

## 9. Cómo meter marketing de app sin que parezca anuncio (idéntico en ambas)

El patrón que funciona es el mismo en Instagram y TikTok, porque el mecanismo psicológico (detectar publicidad y saltarla) no cambia de plataforma:

- **Valor primero, mención única y en medio.** El carrusel tiene que tener valor real aunque se elimine la mención de la app. Si al quitarla el post se queda vacío, está mal construido.
- **Regla 80/20**: 80% valor puro, máximo 20% promoción.
- **Nunca abrir con el nombre o el logo de la app en la slide 1** — activa el "esto es un anuncio" al instante en las dos plataformas.
- **La app se menciona una sola vez**, en el punto donde una persona real la nombraría de forma natural, con un resultado concreto, no una lista de funciones ("la que más uso yo, me ahorró X" en vez de "esta app tiene IA y notificaciones").

### Formato estrella: listicle con la app como una opción entre varias reales
1. Todas las demás entradas de la lista tienen que ser útiles de verdad — si son relleno, se detecta el truco y cae el completion rate en las dos plataformas.
2. La app **no va en la posición #1**: mejor en medio (posición 3-5 de 7) o casi al final, para que se sienta como un descubrimiento dentro de la lista.
3. Presentada como recomendación personal con resultado concreto, no como feature dump.
4. El resto del carrusel (hook, estructura, CTA) sigue exactamente las mismas reglas que cualquier carrusel de valor puro — no se relaja la calidad por ser contenido promocional.

### Otros esqueletos que funcionan igual en ambas
- **Problema → soluciones reales sin producto → mención en medio → CTA suave.**
- **Antes/después con capturas reales de la app** como prueba social (funciona muy bien como formato de guardado: la gente lo guarda para comparar su propio progreso).
- **"Herramientas que uso"** con la app junto a otras herramientas/hábitos reales — cuanto más parezca un dump personal auténtico y menos un catálogo, mejor.
- **Mito/error con la app como corrección**: uno de los errores de la lista es justo el problema que resuelve la app, y ahí entra la mención con naturalidad.

---

## 10. Las pocas diferencias reales entre plataformas (todo lo demás es igual)

Esto es literalmente todo lo que no se puede unificar:

| Elemento | Instagram | TikTok |
|---|---|---|
| Lienzo de exportación | 1080×1350 (recorte centrado del máster) | 1080×1920 (máster completo) |
| Modo de subida | Carrusel nativo del flujo Feed | Photo Mode nativo (nunca como slideshow de vídeo) |
| Sonido | Opcional | Añadir audio ambiente ayuda a la distribución incluso en fotos |
| Hashtags | Pocos, muy relevantes | 3-8, mezclando amplios y de nicho |
| Máximo de slides | 20 | ~35 (pero el óptimo real sigue siendo 5-10) |

Nada de esto afecta al copy, al hook, a la estructura narrativa, al diseño ni a cómo se integra la app. Todo eso se produce una sola vez.

---

## 11. Workflow de producción (paso a paso, reusable para cualquier app)

1. Elige esqueleto: listicle / problema-solución / antes-después (sección 13).
2. Escribe el hook y la estructura completa en tono casual/específico (sirve para las dos plataformas sin reescritura).
3. Diseña en lienzo 1080×1920 manteniendo todo lo crítico dentro de la zona centrada 1080×1350.
4. Si hay app, insértala en la posición correcta según el esqueleto elegido (nunca slide 1, nunca más de una mención).
5. Exporta dos versiones desde el mismo archivo: completa para TikTok, recorte centrado para Instagram.
6. Añade audio ambiente en TikTok.
7. Publica con caption que complementa (no repite) el hook, y CTA orientado a guardar/enviar.
8. Responde comentarios activamente en las primeras horas — decide el alcance total en ambas plataformas.
9. A las 24-48h revisa completion rate por slide (Meta Business Suite / TikTok Analytics). Si es alto, no hace falta hacer nada más: el propio algoritmo re-empuja el post. Si cae mucho en una slide concreta, esa es la que hay que rehacer la próxima vez.

---

## 12. Checklist único antes de publicar

- [ ] Hook: resultado específico, menos de 10 palabras, tipografía enorme, alto contraste
- [ ] Contenido crítico dentro de la zona segura centrada 1080×1350 del máster 1080×1920
- [ ] Nada importante en el 15-20% superior/inferior ni en el 10-15% derecho (icons TikTok)
- [ ] 7-10 slides (5-7 si es TikTok-first y ligero, hasta 15 si es guía profunda solo-IG)
- [ ] Cada slide aporta algo nuevo, ninguna supera el 20% de texto
- [ ] Mismo estilo visual (color, tipografía, fondo/borde) en todas las slides
- [ ] Si hay app: una sola mención, en medio, con resultado concreto, nunca en slide 1
- [ ] El carrusel tiene valor real sin la mención de la app
- [ ] CTA final específico orientado a guardar/enviar
- [ ] Caption complementa el hook, no lo repite
- [ ] Exportado en ambos formatos desde el mismo máster, subido nativo en cada plataforma
- [ ] Audio ambiente añadido en la versión TikTok

---

## 13. Esqueletos reutilizables

**A — Listicle con mención en medio (7-9 slides)**
1. Hook: "[Número] formas de [resultado deseado] en [tiempo/contexto]"
2. Punto 1 real y útil
3. Punto 2 real y útil
4. Punto 3 real y útil
5. Mención de la app: "la [posición] es la que más uso yo — [resultado concreto]"
6. Punto 5 real y útil
7. Punto 6 real y útil
8. (opcional) Punto 7
9. Cierre + CTA: resumen + "guarda esto para [situación]"

**B — Problema/solución con mención tardía (6-8 slides)**
1. Hook: el problema específico, sin insinuar la solución
2. Por qué pasa esto (agitar el problema)
3. Solución/tip 1 (sin producto)
4. Solución/tip 2 (sin producto)
5. "Lo que a mí me funcionó fue [app] porque [resultado]"
6. Cómo se ve el resultado (captura real, dato)
7. Cierre + CTA suave

**C — Antes/después con prueba social (5-7 slides)**
1. Hook: "de [punto de partida] a [resultado] en [tiempo]"
2. El punto de partida (contexto real)
3. Qué cambió (proceso)
4. Captura real del progreso dentro de la app
5. Resultado final con cifra concreta
6. Mención directa de la app como herramienta usada
7. CTA: "guarda esto si estás en el punto 2"

Ajusta el número de slides dentro del rango de la sección 3 según cuánta profundidad tenga el tema — la estructura y el orden se mantienen igual.
