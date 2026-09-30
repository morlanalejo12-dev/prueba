// Catálogo de cosméticos. La skin define el núcleo (forma y colores) y la estela, el rastro.
// Todos son solo visuales: no dan ninguna ventaja en el juego.
//
// De dónde sale cada rareza:
//  - Común, Rara y Épica: gratis jugando (pase gratuito, ligas, logros, recompensa diaria y tienda de destellos).
//  - Legendaria y Mítica: pase Premium (niveles 21 a 100) y Tienda Premium.
//  - Fundador: solo con código.
//
// src.type: default | pass (lvl) | shop (price en destellos) | premium (usd) | rank (tier) | ach (id) | daily | code
export const RARITY = {
  comun: { name: 'Común', col: '#a69ecb' },
  rara: { name: 'Rara', col: '#8fd8ff' },
  epica: { name: 'Épica', col: '#ff7ad9' },
  legendaria: { name: 'Legendaria', col: '#ffd166' },
  mitica: { name: 'Mítica', col: '#ff5470' },
  fundador: { name: 'Fundador', col: '#ffe08a' },
};
export const RARITY_ORDER = ['comun', 'rara', 'epica', 'legendaria', 'mitica', 'fundador'];
export const FREE_RARITIES = ['comun', 'rara', 'epica'];

// shape: orb | diamond | ring | star | square | hex | tri | cross | crystal | plasma | singularity
export const SKINS = [
  { id: 'ambar', name: 'Ámbar', rarity: 'comun', col: '#ffb547', shape: 'orb', src: { type: 'default' } },

  // Pase: gratis hasta el nivel 20
  { id: 'menta', name: 'Menta', rarity: 'comun', col: '#5ef2c2', shape: 'orb', src: { type: 'pass', lvl: 2 } },
  { id: 'coral', name: 'Coral', rarity: 'comun', col: '#ff8f70', shape: 'square', src: { type: 'pass', lvl: 6 } },
  { id: 'rosa', name: 'Rosa', rarity: 'comun', col: '#ff7ad9', shape: 'orb', src: { type: 'pass', lvl: 9 } },
  { id: 'hielo', name: 'Hielo', rarity: 'rara', col: '#8fd8ff', col2: '#e8f7ff', shape: 'diamond', src: { type: 'pass', lvl: 11 } },
  { id: 'luna', name: 'Luna', rarity: 'rara', col: '#e8e6ff', col2: '#8f86c9', shape: 'ring', src: { type: 'pass', lvl: 14 } },
  { id: 'solar', name: 'Solar', rarity: 'rara', col: '#fff1a8', col2: '#ffb547', shape: 'star', src: { type: 'pass', lvl: 17 } },
  { id: 'prisma', name: 'Prisma', rarity: 'epica', col: null, shape: 'hex', src: { type: 'pass', lvl: 20 } },
  // Pase Premium (21 a 100)
  { id: 'nebula', name: 'Nébula', rarity: 'epica', col: '#b48cff', col2: '#ff7ad9', shape: 'hex', src: { type: 'pass', lvl: 22 } },
  { id: 'vertice', name: 'Vértice', rarity: 'comun', col: '#b8ff5e', col2: '#2fd68a', shape: 'tri', src: { type: 'pass', lvl: 24 } },
  { id: 'cruz', name: 'Cruz del Sur', rarity: 'rara', col: '#8fd8ff', col2: '#ffffff', shape: 'cross', src: { type: 'pass', lvl: 30 } },
  { id: 'abisal', name: 'Abisal', rarity: 'rara', col: '#3d7bff', col2: '#5ef2c2', shape: 'orb', src: { type: 'pass', lvl: 36 } },
  { id: 'amatista', name: 'Amatista', rarity: 'epica', col: '#b48cff', col2: '#f3e8ff', shape: 'diamond', src: { type: 'pass', lvl: 45 } },
  { id: 'volcan', name: 'Volcán', rarity: 'epica', col: '#ff5d3d', col2: '#ffd166', shape: 'hex', src: { type: 'pass', lvl: 52 } },
  { id: 'cristal', name: 'Cristal', rarity: 'legendaria', col: '#e8f7ff', col2: '#8fd8ff', shape: 'crystal', src: { type: 'pass', lvl: 56 } },
  { id: 'prisma_real', name: 'Prisma Real', rarity: 'legendaria', col: '#ffd166', col2: '#ff7ad9', shape: 'crystal', src: { type: 'pass', lvl: 64 } },
  { id: 'fenix', name: 'Fénix', rarity: 'legendaria', col: '#ff5d3d', col2: '#ffd166', shape: 'star', src: { type: 'pass', lvl: 76 } },
  { id: 'eclipse', name: 'Eclipse', rarity: 'mitica', col: '#0d0a20', col2: '#ffd166', shape: 'ring', src: { type: 'pass', lvl: 84 } },
  { id: 'plasma', name: 'Núcleo de Plasma', rarity: 'mitica', col: '#5ef2ff', col2: '#ff5ed1', shape: 'plasma', src: { type: 'pass', lvl: 100 } },

  // Tienda de destellos (gratis, hasta Épica)
  { id: 'obsidiana', name: 'Obsidiana', rarity: 'comun', col: '#5a4f8c', col2: '#cbbfff', shape: 'square', src: { type: 'shop', price: 150 } },
  { id: 'diamante', name: 'Diamante', rarity: 'rara', col: '#8fd8ff', col2: '#b48cff', shape: 'diamond', src: { type: 'shop', price: 300 } },
  { id: 'neon', name: 'Neón', rarity: 'rara', col: '#5ef2c2', col2: '#ff7ad9', shape: 'ring', src: { type: 'shop', price: 320 } },
  { id: 'esmeralda', name: 'Esmeralda', rarity: 'rara', col: '#2fd68a', col2: '#c9ffe6', shape: 'hex', src: { type: 'shop', price: 340 } },
  { id: 'rubi', name: 'Rubí', rarity: 'rara', col: '#ff3d6e', col2: '#ffc2d1', shape: 'diamond', src: { type: 'shop', price: 340 } },
  { id: 'cometa', name: 'Cometa', rarity: 'rara', col: '#cbbfff', col2: '#ffffff', shape: 'orb', src: { type: 'shop', price: 350 } },
  { id: 'brasa', name: 'Brasa', rarity: 'epica', col: '#ff8a3d', col2: '#ffd166', shape: 'orb', src: { type: 'shop', price: 600 } },
  { id: 'glitch', name: 'Glitch', rarity: 'epica', col: '#ff5470', col2: '#5ef2c2', shape: 'square', src: { type: 'shop', price: 650 } },
  { id: 'pixel', name: 'Píxel', rarity: 'epica', col: '#7bff6b', col2: '#1d1747', shape: 'square', src: { type: 'shop', price: 680 } },
  { id: 'vertice_neon', name: 'Vértice Neón', rarity: 'epica', col: '#ff5ed1', col2: '#5ef2ff', shape: 'tri', src: { type: 'shop', price: 720 } },
  { id: 'cruz_rubi', name: 'Cruz Rubí', rarity: 'rara', col: '#ff3d6e', col2: '#ffd166', shape: 'cross', src: { type: 'shop', price: 380 } },

  // Tienda Premium (Legendarias y Míticas)
  { id: 'galaxia', name: 'Galaxia', rarity: 'legendaria', col: '#b48cff', col2: '#8fd8ff', shape: 'star', src: { type: 'premium', usd: 1.99 } },
  { id: 'diamante_eterno', name: 'Diamante Eterno', rarity: 'legendaria', col: '#ffffff', col2: '#5ef2ff', shape: 'crystal', src: { type: 'premium', usd: 1.99 } },
  { id: 'quasar', name: 'Quásar', rarity: 'mitica', col: '#ffd166', col2: '#b48cff', shape: 'plasma', src: { type: 'premium', usd: 3.49 } },

  // Recompensa diaria y logros (gratis)
  { id: 'aurora', name: 'Aurora', rarity: 'epica', col: '#5ef2c2', col2: '#b48cff', shape: 'orb', src: { type: 'daily' } },
  { id: 'soln', name: 'Sol negro', rarity: 'epica', col: '#1a1333', col2: '#ffb547', shape: 'ring', src: { type: 'ach', id: 'path10' } },
  { id: 'corona', name: 'Corona', rarity: 'epica', col: '#ffd166', col2: '#ff8a3d', shape: 'star', src: { type: 'ach', id: 'outlier' } },

  // Exclusivas de liga (gratis, hasta Épica)
  { id: 'laurel', name: 'Laurel', rarity: 'epica', col: '#ffd166', col2: '#fff1a8', shape: 'ring', src: { type: 'rank', tier: 2 } },
  { id: 'tormenta', name: 'Tormenta', rarity: 'epica', col: '#5ef2c2', col2: '#e8f7ff', shape: 'hex', src: { type: 'rank', tier: 3 } },
  { id: 'glaciar', name: 'Glaciar', rarity: 'epica', col: '#c9f1ff', col2: '#3d9bff', shape: 'diamond', src: { type: 'rank', tier: 4 } },
  { id: 'llama_real', name: 'Llama Real', rarity: 'epica', col: '#ff8a3d', col2: '#fff1a8', shape: 'star', src: { type: 'rank', tier: 5 } },
  { id: 'emperador', name: 'Emperador', rarity: 'epica', col: '#ffd166', col2: '#1a1333', shape: 'cross', src: { type: 'rank', tier: 6 } },

  // Fundador: solo por código
  { id: 'singularidad', name: 'Singularidad', rarity: 'fundador', col: '#ffd166', col2: '#b48cff', shape: 'singularity', src: { type: 'code' } },
];

// type: dots | spark | fire | ribbon | glitch | rainbow | comet | bubbles | bolt | stars | embers | void | supernova
// col: null = usa el color de la skin
export const TRAILS = [
  { id: 'basica', name: 'Básica', rarity: 'comun', type: 'dots', col: null, src: { type: 'default' } },
  { id: 'chispas', name: 'Chispas', rarity: 'rara', type: 'spark', col: null, src: { type: 'pass', lvl: 5 } },
  { id: 'burbujas', name: 'Burbujas', rarity: 'rara', type: 'bubbles', col: '#8fd8ff', src: { type: 'pass', lvl: 12 } },
  { id: 'arcoiris', name: 'Arcoíris', rarity: 'epica', type: 'rainbow', col: null, src: { type: 'pass', lvl: 18 } },
  { id: 'marea', name: 'Marea', rarity: 'rara', type: 'ribbon', col: '#3d9bff', col2: '#5ef2c2', src: { type: 'pass', lvl: 28 } },
  { id: 'escarcha', name: 'Escarcha', rarity: 'rara', type: 'spark', col: '#e8f7ff', col2: '#8fd8ff', src: { type: 'pass', lvl: 33 } },
  { id: 'pulsos', name: 'Pulsos', rarity: 'epica', type: 'bolt', col: '#b48cff', col2: '#ff7ad9', src: { type: 'pass', lvl: 48 } },
  { id: 'constelacion', name: 'Constelación', rarity: 'legendaria', type: 'stars', col: '#e8f7ff', col2: '#8fd8ff', src: { type: 'pass', lvl: 60 } },
  { id: 'brasas', name: 'Brasas reales', rarity: 'legendaria', type: 'embers', col: '#ffd166', col2: '#ff5d3d', src: { type: 'pass', lvl: 72 } },
  { id: 'vacio', name: 'Vacío', rarity: 'mitica', type: 'void', col: '#ffd166', col2: '#0d0a20', src: { type: 'pass', lvl: 92 } },

  { id: 'cinta', name: 'Cinta', rarity: 'rara', type: 'ribbon', col: null, src: { type: 'shop', price: 280 } },
  { id: 'estela_cometa', name: 'Cola de cometa', rarity: 'rara', type: 'comet', col: '#e8f7ff', src: { type: 'shop', price: 360 } },
  { id: 'llamas', name: 'Llamas', rarity: 'epica', type: 'fire', col: '#ff8a3d', col2: '#ffd166', src: { type: 'shop', price: 620 } },
  { id: 'interferencia', name: 'Interferencia', rarity: 'epica', type: 'glitch', col: '#ff5470', col2: '#5ef2c2', src: { type: 'shop', price: 640 } },
  { id: 'polvo', name: 'Polvo de hada', rarity: 'epica', type: 'spark', col: '#ff7ad9', col2: '#fff1a8', src: { type: 'shop', price: 560 } },

  { id: 'cometa_dorado', name: 'Cometa Dorado', rarity: 'legendaria', type: 'comet', col: '#ffd166', src: { type: 'premium', usd: 1.49 } },
  { id: 'gusano', name: 'Agujero de Gusano', rarity: 'mitica', type: 'void', col: '#b48cff', col2: '#05030d', src: { type: 'premium', usd: 2.99 } },

  { id: 'plata', name: 'Estela plateada', rarity: 'rara', type: 'ribbon', col: '#e8ecf5', col2: '#9aa6c0', src: { type: 'rank', tier: 1 } },
  { id: 'rayo', name: 'Rayo', rarity: 'epica', type: 'bolt', col: '#8fd8ff', col2: '#ffffff', src: { type: 'rank', tier: 3 } },
  { id: 'llamarada', name: 'Llamarada', rarity: 'epica', type: 'fire', col: '#ff3d6e', col2: '#ffb547', src: { type: 'rank', tier: 5 } },
  { id: 'imperial', name: 'Estela Imperial', rarity: 'epica', type: 'ribbon', col: '#ffd166', col2: '#fff1c2', src: { type: 'rank', tier: 6 } },
  { id: 'boreal', name: 'Boreal', rarity: 'epica', type: 'ribbon', col: '#5ef2c2', col2: '#b48cff', src: { type: 'ach', id: 'rival5' } },

  { id: 'supernova', name: 'Supernova', rarity: 'fundador', type: 'supernova', col: '#ffd166', col2: '#ff5ed1', src: { type: 'code' } },
];

export const skinById = id => SKINS.find(k => k.id === id) || SKINS[0];
export const trailById = id => TRAILS.find(k => k.id === id) || TRAILS[0];

// ctx: { level, peakTier, ach, owned, all }
// Los premios del pase y de los logros son tuyos cuando los reclamás (quedan en owned).
export function isOwned(item, ctx) {
  if (ctx.all) return true;
  const s = item.src;
  if (s.type === 'default') return true;
  if (s.type === 'level') return ctx.level >= s.lvl;
  if (s.type === 'rank') return ctx.peakTier >= s.tier;
  return !!ctx.owned[item.id];
}

export const usd = v => 'US$ ' + v.toFixed(2).replace('.', ',');
const TIER_NAMES = ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Leyenda'];
const ACH_TEXT = { outlier: 'Logro Outlier del minuto', path10: 'Logro Imparable', rival5: 'Logro Némesis' };
export function unlockText(item) {
  const s = item.src;
  if (s.type === 'default') return 'Inicial';
  if (s.type === 'level') return `Nivel ${s.lvl}`;
  if (s.type === 'pass') return s.lvl > 20 ? `Pase Premium · Nv ${s.lvl}` : `Pase · Nv ${s.lvl}`;
  if (s.type === 'rank') return `Liga ${TIER_NAMES[s.tier]}`;
  if (s.type === 'ach') return ACH_TEXT[s.id] || 'Logro';
  if (s.type === 'daily') return 'Premio del día 7';
  if (s.type === 'code') return 'Código promocional';
  if (s.type === 'premium') return `Tienda Premium · ${usd(s.usd)}`;
  return `Tienda · ${s.price}`;
}

export const SHOP_SKINS = SKINS.filter(k => k.src.type === 'shop');
export const SHOP_TRAILS = TRAILS.filter(k => k.src.type === 'shop');

// Todo lo que se desbloquea al llegar a cada liga
export const rankRewards = tier => [
  ...SKINS.filter(k => k.src.type === 'rank' && k.src.tier === tier).map(k => ({ kind: 'skin', item: k })),
  ...TRAILS.filter(k => k.src.type === 'rank' && k.src.tier === tier).map(k => ({ kind: 'trail', item: k })),
];
