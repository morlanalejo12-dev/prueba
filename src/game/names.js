// Estilos de nombre: colores básicos, degradados que cambian y efectos producidos.
// fx: solid | grad (degradado animado) | neon | fire | glitch | shine | galaxy | frost | toxic | founder
export const NAME_STYLES = [
  { id: 'nm-blanco', name: 'Blanco', rarity: 'comun', fx: 'solid', cols: ['#f3efff'], src: { type: 'default' } },
  { id: 'nm-menta', name: 'Hierbabuena', rarity: 'comun', fx: 'solid', cols: ['#5ef2c2'], src: { type: 'pass', lvl: 4 } },
  { id: 'nm-ambar', name: 'Miel', rarity: 'comun', fx: 'solid', cols: ['#ffb547'], src: { type: 'pass', lvl: 8 } },
  { id: 'nm-cielo', name: 'Cielo', rarity: 'comun', fx: 'solid', cols: ['#8fd8ff'], src: { type: 'pass', lvl: 13 } },
  { id: 'nm-lavanda', name: 'Lavanda', rarity: 'comun', fx: 'solid', cols: ['#b48cff'], src: { type: 'pass', lvl: 16 } },
  { id: 'nm-rosa', name: 'Chicle', rarity: 'comun', fx: 'solid', cols: ['#ff7ad9'], src: { type: 'shop', price: 120 } },
  { id: 'nm-coral', name: 'Salmón', rarity: 'comun', fx: 'solid', cols: ['#ff8f70'], src: { type: 'shop', price: 120 } },
  { id: 'nm-lima', name: 'Lima', rarity: 'comun', fx: 'solid', cols: ['#b8ff5e'], src: { type: 'shop', price: 120 } },

  { id: 'nm-atardecer', name: 'Atardecer', rarity: 'rara', fx: 'grad', cols: ['#ffb547', '#ff5e8a', '#b48cff'], src: { type: 'shop', price: 300 } },
  { id: 'nm-oceano', name: 'Océano', rarity: 'rara', fx: 'grad', cols: ['#5ef2c2', '#3d9bff', '#8fd8ff'], src: { type: 'shop', price: 300 } },
  { id: 'nm-toxico', name: 'Tóxico', rarity: 'rara', fx: 'toxic', cols: ['#b8ff5e', '#2fd68a'], src: { type: 'shop', price: 350 } },
  { id: 'nm-arcoiris', name: 'Espectro', rarity: 'epica', fx: 'grad', cols: ['#ff7ad9', '#ffd166', '#5ef2c2', '#8fd8ff', '#b48cff'], src: { type: 'pass', lvl: 19 } },
  { id: 'nm-neon', name: 'Letrero Neón', rarity: 'epica', fx: 'neon', cols: ['#ff5ed1', '#ffffff'], src: { type: 'shop', price: 600 } },
  { id: 'nm-glitch', name: 'Error de Señal', rarity: 'epica', fx: 'glitch', cols: ['#f3efff', '#ff3d6e', '#3de0ff'], src: { type: 'shop', price: 700 } },
  { id: 'nm-hielo', name: 'Nevada', rarity: 'epica', fx: 'frost', cols: ['#e8f7ff', '#8fd8ff', '#ffffff'], src: { type: 'pass', lvl: 26 } },
  { id: 'nm-fuego', name: 'Fuego', rarity: 'legendaria', fx: 'fire', cols: ['#fff1a8', '#ffb547', '#ff5d3d'], src: { type: 'pass', lvl: 43 } },
  { id: 'nm-oro', name: 'Oro puro', rarity: 'legendaria', fx: 'shine', cols: ['#ffd166', '#fff1c2', '#c98a1d'], src: { type: 'pass', lvl: 68 } },
  { id: 'nm-galaxia', name: 'Vía Láctea', rarity: 'mitica', fx: 'galaxy', cols: ['#b48cff', '#ff7ad9', '#8fd8ff'], src: { type: 'pass', lvl: 88 } },
  { id: 'nm-diamante', name: 'Brillante', rarity: 'legendaria', fx: 'shine', cols: ['#bff6ff', '#ffffff', '#5ec8ff'], src: { type: 'premium', usd: 0.99 } },
  { id: 'nm-sakura', name: 'Sakura', rarity: 'rara', fx: 'grad', cols: ['#ffc2e2', '#ff7ad9', '#fff1f8'], src: { type: 'pass', lvl: 34 } },
  { id: 'nm-ceniza', name: 'Ceniza', rarity: 'comun', fx: 'solid', cols: ['#c9c4dd'], src: { type: 'level', lvl: 12 } },
  { id: 'nm-aurora', name: 'Aurora Polar', rarity: 'rara', fx: 'grad', cols: ['#5ef2c2', '#8fd8ff', '#b48cff'], src: { type: 'level', lvl: 45 } },
  { id: 'nm-magma', name: 'Magma', rarity: 'epica', fx: 'fire', cols: ['#ffd166', '#ff5d3d', '#8a1a2b'], src: { type: 'level', lvl: 65 } },
  { id: 'nm-voltio', name: 'Voltio', rarity: 'epica', fx: 'neon', cols: ['#5ef2ff', '#ffffff'], src: { type: 'level', lvl: 85 } },
  { id: 'nm-prisma', name: 'Prisma Vivo', rarity: 'epica', fx: 'grad', cols: ['#ff5ed1', '#ffd166', '#5ef2c2', '#8fd8ff'], src: { type: 'level', lvl: 105 } },
  { id: 'nm-hielo-azul', name: 'Hielo Azul', rarity: 'rara', fx: 'grad', cols: ['#c9f1ff', '#3d9bff', '#e8f7ff'], src: { type: 'pass', lvl: 42 } },
  { id: 'nm-oro-rosa', name: 'Oro Rosa', rarity: 'legendaria', fx: 'shine', cols: ['#ffc2d1', '#ffffff', '#e58fa8'], src: { type: 'premium', usd: 0.99 } },
  { id: 'nm-fundador', name: 'Corona Fundadora', rarity: 'fundador', fx: 'founder', cols: ['#ffd166', '#ff5ed1', '#8fd8ff', '#b48cff'], src: { type: 'code' } },
];

export const nameStyleById = id => NAME_STYLES.find(k => k.id === id) || NAME_STYLES[0];
