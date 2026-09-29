# Contracorriente: prototipo jugable

Un juego online de un solo control: cada minuto, todos los jugadores caen juntos por el mismo túnel. Cuando el túnel se divide, **el camino que eligió más gente se derrumba**.

Este prototipo responde una sola pregunta: **¿la bifurcación genera tensión y dan ganas de jugar otra ronda?**

## Cómo probarlo

Abrí `index.html` en cualquier navegador, en el celular o en la PC. No necesita instalación ni servidor.

- **Celular:** arrastrá el dedo a izquierda o derecha.
- **PC:** mouse, flechas ← → o las teclas A y D.

## Qué incluye

- Túnel con muros para esquivar. Pasar muy cerca de un muro suma puntos y encadena combos.
- 6 bifurcaciones por ronda, de 2 o 3 caminos. El más poblado colapsa.
- Variantes de bifurcación: **camino dorado** (x2 puntos, pero todos lo ven), **camino angosto** (difícil de pasar) y **niebla** (no se ve a la multitud).
- Antes de cada bifurcación se ve la intención de la multitud en porcentajes. Dentro de los carriles se ve cuánta gente se comprometió con cada uno.
- Cámara lenta, sonido y vibración al resolverse cada bifurcación.
- Resultado final con puesto, percentil, **Outlier del minuto** y cuenta regresiva a la próxima ronda.
- Historial local: rondas jugadas, mejor percentil y veces que fuiste Outlier.

## Qué está simulado

La multitud son **1.200 bots** que corren en el navegador; todavía no hay servidor. En cada bifurcación, cada bot usa una de cuatro estrategias:

| Estrategia | Proporción | Comportamiento |
| --- | --- | --- |
| Manada | 35% | Va hacia el camino con más gente |
| Contreras | 25% | Va hacia el camino con menos gente (y cambia de idea) |
| Tercos | 25% | Elige una vez y no cambia |
| De último momento | 15% | Cambia al camino con menos gente justo antes de entrar |

En pruebas automáticas, cada bifurcación elimina cerca de la mitad, las rondas duran unos 43 segundos y quedan entre 2 y 20 sobrevivientes. Un jugador que solo sigue a la minoría pierde más de la mitad de las veces en la primera bifurcación: hay que leer cómo se mueve la multitud, no solo mirar el porcentaje.

## Cómo ajustar el balance

Todos los parámetros están en el objeto `CFG`, al principio del `<script>` de `index.html`: cantidad de bots, velocidad, largo de las zonas de decisión, mezcla de estrategias y probabilidad de muerte en el camino angosto.

## Qué medir con testers

1. ¿Juegan otra ronda sin que se lo pidan? La pantalla de resultado muestra las rondas de la sesión.
2. ¿Se nota tensión en el momento en que colapsa el camino?
3. ¿Sienten que ganar depende de ellos o que es pura suerte?

## Próximos pasos

- Servidor con salas por región y reloj global (rondas a los :00 de cada minuto).
- Multitud real en lugar de bots, con bots solo para completar salas vacías.
- Clips automáticos para compartir.
