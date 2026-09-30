// Parámetros de ajuste del juego. Todo lo que afecta el balance vive acá.
export const CFG = Object.freeze({
  // Geometría (unidades lógicas: el túnel mide W de ancho y se escala a la pantalla)
  W: 400,
  WALL: 20,           // margen lateral del túnel
  DIV: 8,             // grosor de los divisores entre carriles
  PR: 8,              // radio del jugador

  // Ronda
  BOTS: 1200,         // tamaño de la multitud simulada
  FORKS: 6,           // bifurcaciones por ronda
  COUNTDOWN_S: 3,
  NEXT_S: 10,         // segundos hasta la próxima ronda (en el juego real: el próximo :00)
  SPEED0: 255,        // velocidad de caída inicial (unidades/s)
  SPEED_STEP: 12,     // aumento de velocidad por bifurcación superada
  APPROACH: 640,      // distancia de decisión antes de los carriles
  LANE_LEN: 320,      // largo de los carriles
  PLAYER_FRAC: 0.2,   // altura del jugador en pantalla (0 = arriba)
  PLAYER_SPEED: 560,  // velocidad lateral máxima del jugador

  // Multitud
  MIX: [0.35, 0.25, 0.25, 0.15], // manada, contreras, tercos, de último momento
  NARROW_DEATH: 0.35,            // probabilidad de que un bot muera en el camino angosto
  INVERT_CHANCE: 0.4,            // probabilidad de que una ronda tenga una inversión

  // Motor
  FIXED_DT: 1 / 120,
});

export const BOT = Object.freeze({ HERD: 0, CONTRA: 1, STUB: 2, LATE: 3 });
