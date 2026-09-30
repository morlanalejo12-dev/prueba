// Catálogo de cosméticos. La skin define el núcleo (forma y colores) y la estela, el rastro.
// Se consiguen por separado: nivel, tienda, liga máxima alcanzada, logros o recompensa diaria.
export const RARITY = {
  comun: { name: 'Común', col: '#a69ecb' },
  rara: { name: 'Rara', col: '#8fd8ff' },
  epica: { name: 'Épica', col: '#ff7ad9' },
  legendaria: { name: 'Legendaria', col: '#ffd166' },
  mitica: { name: 'Mítica', col: '#ff5470' },
};
export const RARITY_ORDER = ['comun', 'rara', 'epica', 'legendaria', 'mitica'];

// shape: orb | diamond | ring | star | square | hex
export const SKINS = [
  { id: 'ambar', name: 'Ámbar', rarity: 'comun', col: '#ffb547', shape: 'orb', src: { type: 'level', lvl: 1 } },
  { id: 'menta', name: 'Menta', rarity: 'comun', col: '#5ef2c2', shape: 'orb', src: { type: 'level', lvl: 2 } },
  { id: 'coral', name: 'Coral', rarity: 'comun', col: '#ff8f70', shape: 'square', src: { type: 'level', lvl: 3 } },
  { id: 'rosa', name: 'Rosa', rarity: 'comun', col: '#ff7ad9', shape: 'orb', src: { type: 'level', lvl: 4 } },
  { id: 'hielo', name: 'Hielo', rarity: 'rara', col: '#8fd8ff', col2: '#e8f7ff', shape: 'diamond', src: { type: 'level', lvl: 6 } },
  { id: 'luna', name: 'Luna', rarity: 'rara', col: '#e8e6ff', col2: '#8f86c9', shape: 'ring', src: { type: 'level', lvl: 8 } },
  { id: 'solar', name: 'Solar', rarity: 'rara', col: '#fff1a8', col2: '#ffb547', shape: 'star', src: { type: 'level', lvl: 9 } },
  { id: 'prisma', name: 'Prisma', rarity: 'epica', col: null, shape: 'hex', src: { type: 'level', lvl: 12 } },
  { id: 'nebula', name: 'Nébula', rarity: 'epica', col: '#b48cff', col2: '#ff7ad9', shape: 'hex', src: { type: 'level', lvl: 16 } },

  { id: 'obsidiana', name: 'Obsidiana', rarity: 'comun', col: '#5a4f8c', col2: '#cbbfff', shape: 'square', src: { type: 'shop', price: 150 } },
  { id: 'diamante', name: 'Diamante', rarity: 'rara', col: '#8fd8ff', col2: '#b48cff', shape: 'diamond', src: { type: 'shop', price: 300 } },
  { id: 'neon', name: 'Neón', rarity: 'rara', col: '#5ef2c2', col2: '#ff7ad9', shape: 'ring', src: { type: 'shop', price: 320 } },
  { id: 'esmeralda', name: 'Esmeralda', rarity: 'rara', col: '#2fd68a', col2: '#c9ffe6', shape: 'hex', src: { type: 'shop', price: 340 } },
  { id: 'rubi', name: 'Rubí', rarity: 'rara', col: '#ff3d6e', col2: '#ffc2d1', shape: 'diamond', src: { type: 'shop', price: 340 } },
  { id: 'cometa', name: 'Cometa', rarity: 'rara', col: '#cbbfff', col2: '#ffffff', shape: 'orb', src: { type: 'shop', price: 350 } },
  { id: 'brasa', name: 'Brasa', rarity: 'epica', col: '#ff8a3d', col2: '#ffd166', shape: 'orb', src: { type: 'shop', price: 600 } },
  { id: 'glitch', name: 'Glitch', rarity: 'epica', col: '#ff5470', col2: '#5ef2c2', shape: 'square', src: { type: 'shop', price: 650 } },
  { id: 'pixel', name: 'Píxel', rarity: 'epica', col: '#7bff6b', col2: '#1d1747', shape: 'square', src: { type: 'shop', price: 680 } },
  { id: 'galaxia', name: 'Galaxia', rarity: 'legendaria', col: '#b48cff', col2: '#8fd8ff', shape: 'star', src: { type: 'shop', price: 1200 } },

  { id: 'aurora', name: 'Aurora', rarity: 'epica', col: '#5ef2c2', col2: '#b48cff', shape: 'orb', src: { type: 'daily' } },
  { id: 'soln', name: 'Sol negro', rarity: 'legendaria', col: '#1a1333', col2: '#ffb547', shape: 'ring', src: { type: 'ach', id: 'path10' } },
  { id: 'corona', name: 'Corona', rarity: 'legendaria', col: '#ffd166', col2: '#ff8a3d', shape: 'star', src: { type: 'ach', id: 'outlier' } },

  // Exclusivas de liga
  { id: 'laurel', name: 'Laurel', rarity: 'epica', col: '#ffd166', col2: '#fff1a8', shape: 'ring', src: { type: 'rank', tier: 2 } },
  { id: 'tormenta', name: 'Tormenta', rarity: 'epica', col: '#5ef2c2', col2: '#e8f7ff', shape: 'hex', src: { type: 'rank', tier: 3 } },
  { id: 'cristal', name: 'Cristal', rarity: 'legendaria', col: '#e8f7ff', col2: '#8fd8ff', shape: 'diamond', src: { type: 'rank', tier: 4 } },
  { id: 'fenix', name: 'Fénix', rarity: 'legendaria', col: '#ff5d3d', col2: '#ffd166', shape: 'star', src: { type: 'rank', tier: 5 } },
  { id: 'eclipse', name: 'Eclipse', rarity: 'mitica', col: '#0d0a20', col2: '#ffd166', shape: 'ring', src: { type: 'rank', tier: 6 } },
];

// type: dots | spark | fire | ribbon | glitch | rainbow | comet | bubbles | bolt | stars | embers | void
// col: null = usa el color de la skin
export const TRAILS = [
  { id: 'basica', name: 'Básica', rarity: 'comun', type: 'dots', col: null, src: { type: 'level', lvl: 1 } },
  { id: 'chispas', name: 'Chispas', rarity: 'rara', type: 'spark', col: null, src: { type: 'level', lvl: 5 } },
  { id: 'arcoiris', name: 'Arcoíris', rarity: 'epica', type: 'rainbow', col: null, src: { type: 'level', lvl: 10 } },
  { id: 'burbujas', name: 'Burbujas', rarity: 'rara', type: 'bubbles', col: '#8fd8ff', src: { type: 'level', lvl: 14 } },

  { id: 'cinta', name: 'Cinta', rarity: 'rara', type: 'ribbon', col: null, src: { type: 'shop', price: 280 } },
  { id: 'estela_cometa', name: 'Cola de cometa', rarity: 'rara', type: 'comet', col: '#e8f7ff', src: { type: 'shop', price: 360 } },
  { id: 'llamas', name: 'Llamas', rarity: 'epica', type: 'fire', col: '#ff8a3d', col2: '#ffd166', src: { type: 'shop', price: 620 } },
  { id: 'interferencia', name: 'Interferencia', rarity: 'epica', type: 'glitch', col: '#ff5470', col2: '#5ef2c2', src: { type: 'shop', price: 640 } },
  { id: 'polvo', name: 'Polvo de hada', rarity: 'epica', type: 'spark', col: '#ff7ad9', col2: '#fff1a8', src: { type: 'shop', price: 560 } },

  { id: 'plata', name: 'Estela plateada', rarity: 'rara', type: 'ribbon', col: '#e8ecf5', col2: '#9aa6c0', src: { type: 'rank', tier: 1 } },
  { id: 'rayo', name: 'Rayo', rarity: 'epica', type: 'bolt', col: '#8fd8ff', col2: '#ffffff', src: { type: 'rank', tier: 3 } },
  { id: 'constelacion', name: 'Constelación', rarity: 'legendaria', type: 'stars', col: '#e8f7ff', col2: '#8fd8ff', src: { type: 'rank', tier: 4 } },
  { id: 'brasas', name: 'Brasas reales', rarity: 'legendaria', type: 'embers', col: '#ffd166', col2: '#ff5d3d', src: { type: 'rank', tier: 5 } },
  { id: 'vacio', name: 'Vacío', rarity: 'mitica', type: 'void', col: '#ffd166', col2: '#0d0a20', src: { type: 'rank', tier: 6 } },
  { id: 'boreal', name: 'Boreal', rarity: 'legendaria', type: 'ribbon', col: '#5ef2c2', col2: '#b48cff', src: { type: 'ach', id: 'rival5' } },
];

export const skinById = id => SKINS.find(k => k.id === id) || SKINS[0];
export const trailById = id => TRAILS.find(k => k.id === id) || TRAILS[0];

// ctx: { level, peakTier, ach, owned }
export function isOwned(item, ctx) {
  const s = item.src;
  if (s.type === 'level') return ctx.level >= s.lvl;
  if (s.type === 'rank') return ctx.peakTier >= s.tier;
  if (s.type === 'ach') return !!ctx.ach[s.id];
  return !!ctx.owned[item.id];
}

const TIER_NAMES = ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Leyenda'];
const ACH_TEXT = { outlier: 'Sé Outlier del minuto', path10: 'Logro Imparable', rival5: 'Logro Némesis' };
export function unlockText(item) {
  const s = item.src;
  if (s.type === 'level') return `Nivel ${s.lvl}`;
  if (s.type === 'rank') return `Liga ${TIER_NAMES[s.tier]}`;
  if (s.type === 'ach') return ACH_TEXT[s.id] || 'Logro';
  if (s.type === 'daily') return 'Premio del día 7';
  return `Tienda · ${s.price}`;
}

export const SHOP_SKINS = SKINS.filter(k => k.src.type === 'shop');
export const SHOP_TRAILS = TRAILS.filter(k => k.src.type === 'shop');

// Todo lo que se desbloquea al llegar a cada liga
export const rankRewards = tier => [
  ...SKINS.filter(k => k.src.type === 'rank' && k.src.tier === tier).map(k => ({ kind: 'skin', item: k })),
  ...TRAILS.filter(k => k.src.type === 'rank' && k.src.tier === tier).map(k => ({ kind: 'trail', item: k })),
];
