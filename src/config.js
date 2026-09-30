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
  BOT_DASH: 0.05,                // fracción de bots que usa un impulso dentro de los carriles (en la primera mitad)

  // Impulso del jugador
  DASH_START: 1,                 // cargas al empezar la ronda
  DASH_MAX: 2,                   // cargas máximas
  ORBS_PER_DASH: 10,             // chispas para recargar un impulso

  // Motor
  FIXED_DT: 1 / 120,
  // Servidor online por defecto cuando el juego se abre como archivo o dentro de un artifact
  ONLINE_URL: 'wss://contracorriente.onrender.com/ws',
});

export const BOT = Object.freeze({ HERD: 0, CONTRA: 1, STUB: 2, LATE: 3 });
