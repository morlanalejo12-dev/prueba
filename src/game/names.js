// Estilos de nombre: colores básicos, degradados que cambian y efectos producidos.
// fx: solid | grad (degradado animado) | neon | fire | glitch | shine | galaxy | frost | toxic | founder
export const NAME_STYLES = [
  { id: 'nm-blanco', name: 'Blanco', rarity: 'comun', fx: 'solid', cols: ['#f3efff'], src: { type: 'default' } },
  { id: 'nm-menta', name: 'Menta', rarity: 'comun', fx: 'solid', cols: ['#5ef2c2'], src: { type: 'pass', lvl: 4 } },
  { id: 'nm-ambar', name: 'Ámbar', rarity: 'comun', fx: 'solid', cols: ['#ffb547'], src: { type: 'pass', lvl: 8 } },
  { id: 'nm-cielo', name: 'Cielo', rarity: 'comun', fx: 'solid', cols: ['#8fd8ff'], src: { type: 'pass', lvl: 13 } },
  { id: 'nm-lavanda', name: 'Lavanda', rarity: 'comun', fx: 'solid', cols: ['#b48cff'], src: { type: 'pass', lvl: 16 } },
  { id: 'nm-rosa', name: 'Rosa', rarity: 'comun', fx: 'solid', cols: ['#ff7ad9'], src: { type: 'shop', price: 120 } },
  { id: 'nm-coral', name: 'Coral', rarity: 'comun', fx: 'solid', cols: ['#ff8f70'], src: { type: 'shop', price: 120 } },
  { id: 'nm-lima', name: 'Lima', rarity: 'comun', fx: 'solid', cols: ['#b8ff5e'], src: { type: 'shop', price: 120 } },

  { id: 'nm-atardecer', name: 'Atardecer', rarity: 'rara', fx: 'grad', cols: ['#ffb547', '#ff5e8a', '#b48cff'], src: { type: 'shop', price: 300 } },
  { id: 'nm-oceano', name: 'Océano', rarity: 'rara', fx: 'grad', cols: ['#5ef2c2', '#3d9bff', '#8fd8ff'], src: { type: 'shop', price: 300 } },
  { id: 'nm-toxico', name: 'Tóxico', rarity: 'rara', fx: 'toxic', cols: ['#b8ff5e', '#2fd68a'], src: { type: 'shop', price: 350 } },
  { id: 'nm-arcoiris', name: 'Arcoíris', rarity: 'epica', fx: 'grad', cols: ['#ff7ad9', '#ffd166', '#5ef2c2', '#8fd8ff', '#b48cff'], src: { type: 'pass', lvl: 19 } },
  { id: 'nm-neon', name: 'Neón', rarity: 'epica', fx: 'neon', cols: ['#ff5ed1', '#ffffff'], src: { type: 'shop', price: 600 } },
  { id: 'nm-glitch', name: 'Glitch', rarity: 'epica', fx: 'glitch', cols: ['#f3efff', '#ff3d6e', '#3de0ff'], src: { type: 'shop', price: 700 } },
  { id: 'nm-hielo', name: 'Escarcha', rarity: 'epica', fx: 'frost', cols: ['#e8f7ff', '#8fd8ff', '#ffffff'], src: { type: 'pass', lvl: 26 } },
  { id: 'nm-fuego', name: 'Fuego', rarity: 'legendaria', fx: 'fire', cols: ['#fff1a8', '#ffb547', '#ff5d3d'], src: { type: 'pass', lvl: 43 } },
  { id: 'nm-oro', name: 'Oro puro', rarity: 'legendaria', fx: 'shine', cols: ['#ffd166', '#fff1c2', '#c98a1d'], src: { type: 'pass', lvl: 68 } },
  { id: 'nm-galaxia', name: 'Galaxia', rarity: 'mitica', fx: 'galaxy', cols: ['#b48cff', '#ff7ad9', '#8fd8ff'], src: { type: 'pass', lvl: 88 } },
  { id: 'nm-diamante', name: 'Diamante', rarity: 'legendaria', fx: 'shine', cols: ['#bff6ff', '#ffffff', '#5ec8ff'], src: { type: 'premium', usd: 0.99 } },
  { id: 'nm-sakura', name: 'Sakura', rarity: 'rara', fx: 'grad', cols: ['#ffc2e2', '#ff7ad9', '#fff1f8'], src: { type: 'pass', lvl: 34 } },
  { id: 'nm-fundador', name: 'Corona Fundadora', rarity: 'fundador', fx: 'founder', cols: ['#ffd166', '#ff5ed1', '#8fd8ff', '#b48cff'], src: { type: 'code' } },
];

export const nameStyleById = id => NAME_STYLES.find(k => k.id === id) || NAME_STYLES[0];
