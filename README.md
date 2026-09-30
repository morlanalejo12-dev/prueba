# Contracorriente: prototipo jugable

Un juego online de un solo control: cada minuto, todos los jugadores caen juntos por el mismo túnel. Cuando el túnel se divide, **el camino que eligió más gente se derrumba**.

Este prototipo responde una sola pregunta: **¿la bifurcación genera tensión y dan ganas de jugar otra ronda?**

## Publicarlo en una URL (con modo online)

El modo online necesita un servidor. El repo ya trae todo para publicarlo gratis en **Render**, que sirve el juego y el online en la misma dirección:

1. Entrá a [render.com](https://render.com) y creá una cuenta con tu GitHub.
2. **New → Blueprint** y elegí este repositorio (Render lee `render.yaml`).
3. Esperá a que termine el despliegue: te da una dirección como `https://contracorriente.onrender.com`.
4. Compartí esa dirección: el botón **Online con amigos** funciona directo.

En el plan gratis el servidor se duerme tras 15 minutos sin uso; la primera visita tarda unos 30 segundos en despertarlo.

Si alguien abre el `index.html` descargado, también puede jugar online: en **Online con amigos** pone la dirección del servidor (por ejemplo `contracorriente.onrender.com`) y queda guardada. Para no tener que escribirla, se puede fijar en `ONLINE_URL` dentro de `src/config.js` y volver a armar el juego.

**Guardar datos de forma permanente (cuentas, tablas y estadísticas):** sin configuración, el servidor los guarda en un archivo, pero el plan gratis de Render borra ese disco en cada despliegue. Para que duren:
1. Creá un proyecto gratis en [supabase.com](https://supabase.com) y, en *SQL Editor*, ejecutá: `create table kv (ns text, key text, value jsonb, updated timestamptz default now(), primary key (ns, key));`
2. En Render → tu servicio → *Environment*, agregá `SUPABASE_URL` y `SUPABASE_KEY` (la *service_role key* de *Project Settings → API*).

Para probar el servidor en tu computadora: `npm install`, `npm run build` y `npm start`, y abrí `http://localhost:8080` en dos pestañas.

Solo la versión sin online (sin servidor) también se puede publicar en Netlify o Cloudflare Pages con el comando `npm run build` y la carpeta `dist/site`, o en GitHub Pages con el workflow `.github/workflows/pages.yml` (en repos privados requiere un plan pago). Una vez publicado, desde el celular se puede instalar como app.

## Cómo probarlo

Abrí `index.html` en cualquier navegador, en el celular o en la PC. Para jugar solo no necesita instalación ni servidor; para jugar online, mirá la sección anterior.

- **Celular:** arrastrá el dedo a izquierda o derecha.
- **PC:** mouse, flechas ← → o las teclas A y D.

## Qué incluye

- Túnel con cinco tipos de muro: **fijo**, **móvil**, **doble**, **puertas** que se alternan y **pinza** (dos muros seguidos).
- 6 bifurcaciones por ronda, de 2, 3 o 4 caminos. El más poblado colapsa.
- Variantes: **camino dorado** (x2), **angosto**, **niebla** e **inversión** (esa vez cae el camino con menos gente).
- Chispas coleccionables, pasadas justas con combos y cámara lenta en cada colapso.
- Música generativa que se intensifica con la tensión, efectos de sonido y vibración.
- Ranked con ligas y ventajas por liga, 28 skins y 16 estelas, tienda, misiones diarias, recompensa diaria y pase de temporada.
- Muerte súbita hasta que queda un solo ganador, fondo que cambia por etapa y música progresiva.
- Rival por ronda, feed en vivo, hitos de top 100/50/10/3, 17 logros y récords.
- Tarjeta de resultado para compartir.
- **Online:** Minuto global (una ronda pública al comenzar cada minuto) y salas privadas con código de 4 letras.
- **Códigos promocionales** en Ajustes y en la Tienda.
- **129 cosméticos:** skins, estelas, 10 temas de música y 28 estilos de nombre.
- **Niveles de cuenta hasta el 120**, con títulos y distintivos.
- **Pase de temporada** de 100 niveles (20 gratis), **Tienda Premium** (se habilita en la v1.0) y **amigos**.

## Novedades

### v0.12 · Retención y justicia
- **Morir se siente justo:**
  - La primera bifurcación tiene 4 caminos y la multitud está más repartida: aunque elijas al azar, sobrevivís 3 de cada 4 veces (antes, 1 de cada 2).
  - **Proyección (→ %)** debajo de cada camino: muestra cómo va a quedar si cada uno sigue hacia donde va. Es información para leer, no suerte.
  - Cada muerte se explica en una línea: qué porcentaje eligió tu camino, si un impulso te salvaba o cuántos píxeles te faltaron contra el muro.
- **Sin esperas:** la partida global arranca 10 segundos después de que entra alguien (o apenas se juntan 8), y entre rondas hay 8 segundos. Solo, la próxima ronda arranca a los 6 segundos.
- **Menú que se habilita de a una sección:** un jugador nuevo ve solo *Jugar*. Cada pocas rondas se habilita algo nuevo (colección, misiones, tienda, pase, online, música, nombre, amigos, premium), con aviso y un brillo hasta que lo abrís. Quien ya jugaba lo ve todo como antes.
- **Desafío del día:** la misma ronda para todos, cambia cada día. Cuenta tu mejor intento y se comparte con emojis (🟩🟥⬛), tipo Wordle.
- **Ranking:** tablas del desafío de hoy y de la semana, global o solo amigos (botón con la copa).
- **Clip del colapso:** el juego graba el último colapso y en los resultados aparece el botón *Clip* para compartirlo o descargarlo.
- **Modo del finde:** sábados y domingos hay un modo especial que rota cada semana (Todo al revés, Niebla total o Turbo).
- **Metas cercanas** en los resultados: "A 4 puestos del Top 10", "A 120 puntos de tu récord".
- **Escudo de racha:** si faltás un día, una vez por semana, tu racha no se corta. **Premio de regreso** si volvés después de 3 días o más.
- **Cuenta en la nube:** el progreso se guarda en el servidor y se pasa a otro dispositivo con un código de recuperación (Ajustes).
- **Estadísticas anónimas de uso** en `/api/stats`: jugadores, sesiones, rondas, en qué bifurcación se muere cada uno, qué secciones se abren y retención al día 1 y 7.
- Menos avisos seguidos (máximo 4 por ronda); las reglas pasaron a Ajustes y la copa del Ranking ocupa su lugar.

### v0.11
- **Título a elección en el nivel 120** (como en Black Ops 4): al llegar al máximo, en Perfil → Niveles elegís el título de cualquier nivel para lucirlo en el menú, el perfil, los resultados y la sala online.
- **Skins más compactas:** ningún adorno se aleja más de unos 2 radios de la bola. El aura de las ligas altas (anillos, puntos y corona) es más chica y más tenue, y se achicaron Singularidad, Núcleo de Plasma, Quásar, Dragón Estelar, los cristales y las estelas más anchas (Supernova, Vacío, cometas). Así se ve mejor el camino, tanto para quien las usa como para los demás.

### v0.10
- **Niveles de cuenta hasta el 120** (antes 12). Cada nivel da destellos, y en los niveles clave hay cosméticos propios de la cuenta.
- **27 títulos** que crecen con el progreso: de *Chispa* (nivel 1) a *Soberano Absoluto de la Corriente* (nivel 120).
- **Distintivo de nivel:** cambia cada 10 niveles (Gota, Onda, Remolino, Espiral, Marea, Tormenta, Vórtice, Maremoto, Abismo, Corona del Mar, Eclipse Oceánico y Soberano). Suma olas, rayos, gema, corona y, en el 120, un halo animado. Se ve en el perfil, en la sala online y en la tabla final.
- Pestaña **Niveles** en el perfil, con todo el recorrido, y festejo al ganar un título o un distintivo nuevo.
- **38 cosméticos nuevos** (129 en total): skins, estelas, estilos de nombre y dos temas nuevos, *Oleaje* (trance) y *Horizonte* (future bass).
- **Cada cosmético es único:** un solo nombre y una sola forma de conseguirlo (nivel de cuenta, pase, liga, logro, premio diario, tienda de destellos o Tienda Premium). Se renombraron los que repetían nombre entre tipos.
- **Códigos:** se borraron todos menos BIENVENIDA. Hay dos códigos privados de los creadores (no están en este documento): uno deja **absolutamente todo al máximo** y otro **borra el progreso** como si fuera una cuenta nueva.

### v0.9
- **DKO · Play Me** (exclusivo de los creadores): ahora es la canción *Play Me* (SETO / Albert Harvey), adaptada al juego. En el menú y lejos de las bifurcaciones suena un tramo tranquilo en loop; cuando sube la tensión entra el drop (16 compases en loop). Los cambios caen siempre al empezar un compás. Viene dentro del `index.html` y en el sitio se descarga aparte, solo si se usa.
- **Pase de temporada de 100 niveles:** del 1 al 20 es gratis; del 21 al 100 es el **pase Premium (US$ 3,99)**, con skins Legendarias y una **Mítica en el nivel 100** (Núcleo de Plasma), además de música, estelas, estilos de nombre y destellos. Todos los premios se reclaman a mano (hay un botón para reclamar todo).
- **Tienda Premium:** skins, estelas y estilos Legendarios y Míticos con su precio en dólares. Las compras se habilitan en la versión 1.0.
- **Calidades:** jugando gratis se consigue hasta calidad Épica (pase gratuito, ligas, logros, recompensa diaria y tienda de destellos). Legendaria y Mítica son de pago. Fundador sigue siendo solo por código y es la calidad más alta. **Todos los cosméticos son solo visuales: no dan ninguna ventaja.**
- **Logros con premio:** cada logro da destellos (y algunos una skin o estela) que se reclaman a mano en el perfil.
- **Chispas por etapas:** Chispa (x1), Gema (x2), Estrella (x3) y Prisma (x5), cada una con su forma y color.
- **Amigos:** cada jugador tiene un código de amigo. Agregás amigos con su código, ves quién está en línea y dónde, los invitás a tu sala privada o te unís a la suya.
- **Avisos durante la partida:** se pueden apagar en Ajustes.
- **La multitud es más translúcida** y los otros jugadores también, un poco menos, para que tu bola se destaque.
- **Sala sin parpadeos:** la lista de jugadores ya no se reconstruye cada segundo; solo cambia cuando alguien entra, sale o cambia su aspecto.
- **Código de dueños** para probar todo desbloqueado.
- Formas nuevas de skins (Vértice, Cruz, Cristal y Plasma) y 12 skins y estelas nuevas.
- Quien ya tenía cosméticos por nivel, liga o logro los conserva.

### v0.8
- **Control táctil nuevo:** en el celular arrastrás desde cualquier parte de la pantalla y la bola se mueve lo mismo (con un poco más de sensibilidad), sin taparla con el dedo. Un segundo dedo (por ejemplo en IMPULSO) no la desvía. Se puede volver al modo anterior en Ajustes.
- **Catálogo de música** (menú → Música): 8 temas con distinto estilo, que se escuchan antes de elegirlos y se intensifican con cada bifurcación.
  - Corriente (original), Cascada (lo-fi), Chiptune Rush (8 bits), Neón Nocturno (synthwave), Pulso Profundo (deep house), Vértigo (drum & bass), Tormenta (techno ácido).
  - Se consiguen por nivel, llegando a liga Oro o en la tienda del catálogo.
  - **DKO · Voltaje** (rareza Fundador, solo con código): electro house a 128 BPM con supersierras, bombeo de sidechain, pluck pegadizo y redoble cada 8 compases.
- **Nombre y estilos de nombre** (menú → Nombre): cambiás tu nombre y elegís cómo se ve.
  - 8 colores básicos, degradados que cambian (Atardecer, Océano, Arcoíris) y estilos con efectos (Tóxico, Neón, Glitch, Escarcha, Fuego, Oro puro, Galaxia).
  - **Corona Fundadora** (solo con código): corona, degradado de cuatro colores, brillo que recorre el nombre, resplandor y destellos.
- **Online mejorado:**
  - En la sala se ve en vivo la skin, la estela y el nombre con estilo de cada jugador; si alguien cambia algo, se actualiza al instante.
  - En la ronda, los demás jugadores se ven con su skin, su estela y su nombre, y el tuyo también aparece.
  - Desde la sala hay accesos directos a Cambiar skin, Nombre y Música.
  - La HUD muestra cuántos jugadores reales siguen vivos, y la tabla final muestra skins y nombres con estilo.
  - Si se corta la conexión, reconecta solo y vuelve a la misma sala.

### v0.7
- **Modo online real.** Botón *Online con amigos* en el menú:
  - **Minuto global:** sala pública; la ronda arranca sola al comenzar cada minuto con todos los conectados.
  - **Salas privadas:** creás una sala, compartís el código de 4 letras (o el link `?sala=CÓDIGO`) y el anfitrión decide cuándo empieza.
  - Los jugadores reales cuentan en cada bifurcación; los bots completan la multitud. Ves a los demás con su skin y su nombre.
  - Al final, tabla de posiciones de tu sala. Tu progreso, rango y recompensas se siguen guardando en tu dispositivo.
  - El servidor decide todo (muros, carriles, colapsos) y compensa la latencia: lo que ves en tu pantalla es lo que cuenta.
- **Códigos promocionales** (Ajustes o Tienda → *Código promocional*).
- Nueva rareza **Fundador**, por encima de Mítica, solo por código:
  - Skin **Singularidad**: un agujero negro con disco de acreción giratorio, anillo de fotones, destellos y chispas en órbita.
  - Estela **Supernova**: plasma dorado y magenta con núcleo incandescente, arcos eléctricos, estrellas y ondas expansivas.

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

En el modo solo, la multitud son **1.200 bots** que corren en el navegador. En el online, la misma simulación corre en el servidor y los jugadores reales se suman a ella. En cada bifurcación, cada bot usa una de cuatro estrategias:

| Estrategia | Proporción | Comportamiento |
| --- | --- | --- |
| Manada | 35% | Va hacia el camino con más gente |
| Contreras | 25% | Va hacia el camino con menos gente (y cambia de idea) |
| Tercos | 25% | Elige una vez y no cambia |
| De último momento | 15% | Cambia al camino con menos gente justo antes de entrar |

En pruebas automáticas, cada bifurcación elimina cerca de la mitad y la muerte súbita asegura un solo ganador. Un jugador que solo sigue a la minoría pierde seguido: hay que leer cómo se mueve la multitud, no solo mirar el porcentaje.

## Para desarrolladores

El juego se escribe en módulos dentro de `src/` y se arma en un solo `index.html` autocontenido:

```bash
npm install      # una sola vez
npm test         # tests de simulación y progreso
npm run build    # genera index.html, dist/artifact.html y dist/site
npm start        # servidor online en http://localhost:8080 (sirve dist/site)
```

| Carpeta | Qué hay |
| --- | --- |
| `src/config.js` | Todos los parámetros de balance (bots, velocidad, estrategias, probabilidades) |
| `src/sim/` | Simulación pura y determinista: nivel, muros, multitud y ronda. No usa el DOM. `multi.js` suma jugadores humanos con compensación de latencia. |
| `src/net/` | Cliente online: conexión WebSocket y la vista de la ronda que llega del servidor |
| `server/` | Servidor Node (`ws`): salas, Minuto global, instantáneas a 15 por segundo y eventos |
| `src/game/codes.js` | Códigos promocionales (guardados como hash) |
| `src/game/progress.js` | Niveles, logros, récords, racha, guardado y aplicación de cada ronda |
| `src/game/ranks.js` | Ligas, divisiones y cálculo de PR |
| `src/game/skins.js` | Catálogo de skins y estelas, y cómo se consigue cada una |
| `src/game/meta.js` | Misiones diarias, recompensa diaria, tienda y pase de temporada |
| `src/render/` | Dibujo en canvas, partículas y tarjeta para compartir |
| `src/audio/` | Efectos y música sintetizados con Web Audio; `tracks.js` tiene los 8 temas |
| `src/game/music.js`, `src/game/names.js` | Catálogos de música y de estilos de nombre |
| `src/game/pass.js` | Pase de temporada: niveles, premios y reclamos |
| `server/friends.js` | Presencia de amigos e invitaciones |
| `server/api.js`, `server/store.js` | API HTTP (cuentas en la nube, tablas, estadísticas) y almacenamiento (archivo o Supabase) |
| `src/game/events.js`, `src/game/unlocks.js` | Desafío del día, modo del finde, racha, regreso y menú progresivo |
| `assets/music/` | Temas grabados (MP3); el build los embebe en el `index.html` |
| `src/ui/` | Menú, HUD, resultados, ventanas e íconos |
| `src/main.js` | Máquina de estados y bucle principal (paso fijo de 1/120 s) |
| `test/` | Tests con `node --test` |

La simulación publica eventos (`orb`, `nearMiss`, `forkResolved`, `playerDied`…) y la presentación reacciona a ellos. En el online, el servidor manda esos mismos eventos por la red, así el render, el HUD y el sonido son los mismos en los dos modos.

## Qué medir con testers

1. ¿Juegan otra ronda sin que se lo pidan? La pantalla de resultado muestra las rondas de la sesión.
2. ¿Se nota tensión en el momento en que colapsa el camino?
3. ¿Sienten que ganar depende de ellos o que es pura suerte?

## Próximos pasos

- Cuentas en la nube (progreso compartido entre dispositivos) y ranking global.
- Salas por región para bajar la latencia.
- Clips automáticos para compartir.
