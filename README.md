# Contracorriente: prototipo jugable

Un juego online de un solo control: cada minuto, todos los jugadores caen juntos por el mismo túnel. Cuando el túnel se divide, **el camino que eligió más gente se derrumba**.

Este prototipo responde una sola pregunta: **¿la bifurcación genera tensión y dan ganas de jugar otra ronda?**

## Publicarlo en una URL

El workflow `.github/workflows/pages.yml` arma el juego y lo publica en GitHub Pages en cada cambio. Para activarlo, en GitHub entrá a **Settings → Pages → Source** y elegí **GitHub Actions**. GitHub Pages en repositorios privados requiere un plan pago; si el repo es privado y gratis, se puede publicar gratis en Netlify o Cloudflare Pages conectando el repo, con el comando `npm run build` y la carpeta `dist/site`.

Una vez publicado, desde el celular se puede instalar como app (Ajustes → Instalar como app, o "Agregar a pantalla de inicio") y funciona sin conexión.

## Cómo probarlo

Abrí `index.html` en cualquier navegador, en el celular o en la PC. No necesita instalación ni servidor.

- **Celular:** arrastrá el dedo a izquierda o derecha.
- **PC:** mouse, flechas ← → o las teclas A y D.

## Qué incluye

- Túnel con cinco tipos de muro: **fijo**, **móvil**, **doble**, **puertas** que se alternan y **pinza** (dos muros seguidos).
- 6 bifurcaciones por ronda, de 2, 3 o 4 caminos. El más poblado colapsa.
- Variantes: **camino dorado** (x2), **angosto**, **niebla** e **inversión** (esa vez cae el camino con menos gente).
- Chispas coleccionables, pasadas justas con combos y cámara lenta en cada colapso.
- Música generativa que se intensifica con la tensión, efectos de sonido y vibración.
- Ranked con ligas y ventajas por liga, 27 skins y 15 estelas, tienda, misiones diarias, recompensa diaria y pase de temporada.
- Muerte súbita hasta que queda un solo ganador, fondo que cambia por etapa y música progresiva.
- Rival por ronda, feed en vivo, hitos de top 100/50/10/3, 17 logros y récords.
- Tarjeta de resultado para compartir.

## Novedades

### v0.6
- **Impulso**: dentro de los carriles podés pasarte al camino vecino a último momento (botones en pantalla, o Q / E / Espacio en la compu). Empezás con 1 y cada 10 chispas ganás otro (máximo 2).
- **Flechas de tendencia**: arriba de cada porcentaje se ve si ese camino está ganando o perdiendo gente.
- **Más habilidad, menos suerte**: medido sobre 40 rondas por estrategia, elegir al azar sobrevive el 51% de las bifurcaciones y leer la tendencia más usar el Impulso, el 86%.
- **Primera partida guiada**: en la primera ronda las 3 primeras bifurcaciones y los muros perdonan; en la segunda, la primera bifurcación. Tutorial del Impulso.
- **Predicciones**: cuando caés, apostás qué camino cae y ganás destellos si acertás.
- **Otra ronda al instante**: desde la vista de espectador se guarda el resultado y arranca la siguiente.
- **Instalable como app** (con conexión o sin ella) cuando se publica en una URL. Workflow listo para GitHub Pages.
- 2 logros nuevos: Último segundo y Oráculo.

### v0.5
- **Recompensa diaria corregida**: al reclamar se muestra el premio en grande y el botón cierra la ventana. Antes el reclamo se guardaba, pero la ventana quedaba igual y el botón "Volvé mañana" no hacía nada.
- **Estelas separadas de las skins**: 15 estelas con su propio catálogo (burbujas, rayo, constelación, cola de cometa, vacío y más), combinables con cualquier skin.
- **27 skins**, con dos formas nuevas (cuadrado y hexágono) y una rareza nueva: **Mítica**.
- **Ligas altas que valen la pena**: bonus de destellos (+5% en Plata hasta +50% en Leyenda), aura alrededor del jugador (halo, halo doble, órbita y corona), marco brillante en el perfil y skins y estelas exclusivas por liga.
- **Fondo animado**: el túnel cambia de color en cada bifurcación, con nebulosas, estelas de velocidad y una grilla que late con la música. Al sobrevivir hay onda expansiva y confeti.
- **Música progresiva**: cada bifurcación acelera el ritmo, sube la tonalidad y suma capas (hi-hats, arpegio, redoblante, melodía). Hay un crescendo al entrar en los carriles y un golpe al sobrevivir.
- **Muerte súbita**: si después de la sexta bifurcación queda más de uno, siguen tramos cada vez más difíciles hasta que haya **un solo ganador**. Si nadie se separa, la corriente se lleva a la mitad.
- El rival se ve marcado en rojo entre la multitud.
- Tienda con 2 skins y 2 estelas por día.

### v0.4
- **Ranked**: ligas Bronce, Plata, Oro, Platino y Diamante (con divisiones III, II, I), Maestro y Leyenda. Los PR suben o bajan según a cuántos superaste, y hay protección de liga. Animación de ascenso.
- **16 skins** con rarezas (común, rara, épica, legendaria), 4 formas (orbe, diamante, anillo, estrella) y 6 estelas animadas (puntos, chispas, fuego, cinta, glitch, arcoíris).
- **Destellos** (moneda del juego) y **tienda** con 3 ofertas por día, una rebajada.
- **Misiones diarias**: 3 por día, iguales para todos, con recompensa al reclamarlas.
- **Recompensa diaria** de 7 días (el día 7 da la skin Aurora).
- **Pase de temporada** gratuito hasta el nivel 20.
- **Rival**: en cada ronda se te asigna un rival; durar más que él da PR y destellos extra.
- **Feed en vivo** de la ronda e **hitos** "Top 100, 50, 10 y 3" con puntos extra.
- **Racha de caminos** entre rondas y estadística de **Instinto** (porcentaje histórico de bifurcaciones superadas).
- 3 logros nuevos (17 en total). Perfil con pestañas de Resumen, Logros y Récords.
- Menú con rango, moneda y avisos de cosas para reclamar.

### v0.3
- **Menú rediseñado**: centrado, sin scroll, con perfil, secciones y estadísticas. Ventanas para Reglas, Estelas, Logros, Récords, Perfil y Ajustes.
- **Muros nuevos**: doble, puertas alternas y pinza. Bifurcaciones de **4 caminos**.
- **Inversión**: en algunas rondas, una bifurcación hace caer el camino con MENOS gente.
- **Música generativa** que acompaña la tensión de la ronda (se puede apagar aparte del sonido).
- **14 logros** con avisos, **récords** (tus 5 mejores rondas) y **compartir** resultado con imagen y texto.
- HUD nuevo con el progreso de las 6 bifurcaciones y el combo.
- **Código profesional**: módulos separados (simulación, render, audio, interfaz), simulación determinista y tests automáticos.

### v0.2
- **Chispas doradas** para juntar. Si agarrás varias seguidas, valen más (hasta x5).
- **Cuenta regresiva** 3, 2, 1 antes de cada ronda.
- **Tutorial guiado** en las dos primeras rondas.
- **Niveles y XP**: cada ronda suma experiencia. Los títulos van de Chispa a Outlier.
- **Estelas desbloqueables**: 6 colores que se ganan subiendo de nivel (Ámbar, Menta, Rosa, Hielo, Solar y Prisma).
- **Racha diaria** de días jugados.
- **Más impacto visual**: fondo con estelas en movimiento, muros con brillo, explosiones de partículas y destellos de pantalla.
- **Resultados animados**: el puesto baja hasta el tuyo, la barra de XP se llena y aparece un aviso de récord personal.
- Opción para apagar la vibración. Sonido y vibración se recuerdan entre sesiones.

### v0.1
- Primer prototipo jugable: túnel, bifurcaciones, variantes y 1.200 bots.

## Qué está simulado

La multitud son **1.200 bots** que corren en el navegador; todavía no hay servidor. En cada bifurcación, cada bot usa una de cuatro estrategias:

| Estrategia | Proporción | Comportamiento |
| --- | --- | --- |
| Manada | 35% | Va hacia el camino con más gente |
| Contreras | 25% | Va hacia el camino con menos gente (y cambia de idea) |
| Tercos | 25% | Elige una vez y no cambia |
| De último momento | 15% | Cambia al camino con menos gente justo antes de entrar |

En pruebas automáticas, cada bifurcación elimina cerca de la mitad, las rondas duran unos 43 segundos y quedan entre 2 y 20 sobrevivientes. Un jugador que solo sigue a la minoría pierde más de la mitad de las veces en la primera bifurcación: hay que leer cómo se mueve la multitud, no solo mirar el porcentaje.

## Para desarrolladores

El juego se escribe en módulos dentro de `src/` y se arma en un solo `index.html` autocontenido:

```bash
npm install      # una sola vez
npm test         # tests de simulación y progreso
npm run build    # genera index.html (y dist/artifact.html)
```

| Carpeta | Qué hay |
| --- | --- |
| `src/config.js` | Todos los parámetros de balance (bots, velocidad, estrategias, probabilidades) |
| `src/sim/` | Simulación pura y determinista: nivel, muros, multitud y ronda. No usa el DOM. |
| `src/game/progress.js` | Niveles, logros, récords, racha, guardado y aplicación de cada ronda |
| `src/game/ranks.js` | Ligas, divisiones y cálculo de PR |
| `src/game/skins.js` | Catálogo de skins y estelas, y cómo se consigue cada una |
| `src/game/meta.js` | Misiones diarias, recompensa diaria, tienda y pase de temporada |
| `src/render/` | Dibujo en canvas, partículas y tarjeta para compartir |
| `src/audio/` | Efectos y música sintetizados con Web Audio |
| `src/ui/` | Menú, HUD, resultados, ventanas e íconos |
| `src/main.js` | Máquina de estados y bucle principal (paso fijo de 1/120 s) |
| `test/` | Tests con `node --test` |

La simulación publica eventos (`orb`, `nearMiss`, `forkResolved`, `playerDied`…) y la presentación reacciona a ellos. Así la lógica se puede testear sin navegador y más adelante correr en un servidor.

## Qué medir con testers

1. ¿Juegan otra ronda sin que se lo pidan? La pantalla de resultado muestra las rondas de la sesión.
2. ¿Se nota tensión en el momento en que colapsa el camino?
3. ¿Sienten que ganar depende de ellos o que es pura suerte?

## Próximos pasos

- Servidor con salas por región y reloj global (rondas a los :00 de cada minuto).
- Multitud real en lugar de bots, con bots solo para completar salas vacías.
- Clips automáticos para compartir.
