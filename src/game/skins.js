// Catálogo de skins: color, forma del núcleo y tipo de estela. Cada una se consigue de una forma distinta.
export const RARITY = {
  comun: { name: 'Común', col: '#a69ecb' },
  rara: { name: 'Rara', col: '#8fd8ff' },
  epica: { name: 'Épica', col: '#ff7ad9' },
  legendaria: { name: 'Legendaria', col: '#ffd166' },
};

// shape: orb | diamond | ring | star     trail: dots | spark | fire | ribbon | glitch | rainbow
// src: level (por nivel) · shop (tienda) · rank (liga máxima alcanzada) · ach (logro) · daily (recompensa diaria)
export const SKINS = [
  { id: 'ambar', name: 'Ámbar', rarity: 'comun', col: '#ffb547', shape: 'orb', trail: 'dots', src: { type: 'level', lvl: 1 } },
  { id: 'menta', name: 'Menta', rarity: 'comun', col: '#5ef2c2', shape: 'orb', trail: 'dots', src: { type: 'level', lvl: 2 } },
  { id: 'rosa', name: 'Rosa', rarity: 'comun', col: '#ff7ad9', shape: 'orb', trail: 'dots', src: { type: 'level', lvl: 4 } },
  { id: 'hielo', name: 'Hielo', rarity: 'rara', col: '#8fd8ff', col2: '#e8f7ff', shape: 'diamond', trail: 'spark', src: { type: 'level', lvl: 6 } },
  { id: 'solar', name: 'Solar', rarity: 'rara', col: '#fff1a8', col2: '#ffb547', shape: 'star', trail: 'dots', src: { type: 'level', lvl: 9 } },
  { id: 'prisma', name: 'Prisma', rarity: 'epica', col: null, shape: 'orb', trail: 'rainbow', src: { type: 'level', lvl: 12 } },
  { id: 'diamante', name: 'Diamante', rarity: 'rara', col: '#8fd8ff', col2: '#b48cff', shape: 'diamond', trail: 'dots', src: { type: 'shop', price: 300 } },
  { id: 'neon', name: 'Neón', rarity: 'rara', col: '#5ef2c2', col2: '#ff7ad9', shape: 'ring', trail: 'ribbon', src: { type: 'shop', price: 320 } },
  { id: 'cometa', name: 'Cometa', rarity: 'rara', col: '#cbbfff', col2: '#ffffff', shape: 'orb', trail: 'spark', src: { type: 'shop', price: 350 } },
  { id: 'brasa', name: 'Brasa', rarity: 'epica', col: '#ff8a3d', col2: '#ffd166', shape: 'orb', trail: 'fire', src: { type: 'shop', price: 600 } },
  { id: 'glitch', name: 'Glitch', rarity: 'epica', col: '#ff5470', col2: '#5ef2c2', shape: 'diamond', trail: 'glitch', src: { type: 'shop', price: 650 } },
  { id: 'galaxia', name: 'Galaxia', rarity: 'legendaria', col: '#b48cff', col2: '#8fd8ff', shape: 'star', trail: 'spark', src: { type: 'shop', price: 1200 } },
  { id: 'aurora', name: 'Aurora', rarity: 'epica', col: '#5ef2c2', col2: '#b48cff', shape: 'orb', trail: 'ribbon', src: { type: 'daily' } },
  { id: 'laurel', name: 'Laurel', rarity: 'epica', col: '#ffd166', col2: '#fff1a8', shape: 'ring', trail: 'spark', src: { type: 'rank', tier: 2 } },
  { id: 'cristal', name: 'Cristal', rarity: 'legendaria', col: '#e8f7ff', col2: '#8fd8ff', shape: 'diamond', trail: 'ribbon', src: { type: 'rank', tier: 4 } },
  { id: 'corona', name: 'Corona', rarity: 'legendaria', col: '#ffd166', col2: '#ff8a3d', shape: 'star', trail: 'fire', src: { type: 'ach', id: 'outlier' } },
];

export const skinById = id => SKINS.find(k => k.id === id) || SKINS[0];

// ctx: { level, peakTier, ach, owned }
export function isOwned(sk, ctx) {
  const s = sk.src;
  if (s.type === 'level') return ctx.level >= s.lvl;
  if (s.type === 'rank') return ctx.peakTier >= s.tier;
  if (s.type === 'ach') return !!ctx.ach[s.id];
  return !!ctx.owned[sk.id];
}

const TIER_NAMES = ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante'];
export function unlockText(sk) {
  const s = sk.src;
  if (s.type === 'level') return `Nivel ${s.lvl}`;
  if (s.type === 'rank') return `Llegá a ${TIER_NAMES[s.tier]}`;
  if (s.type === 'ach') return 'Sé Outlier del minuto';
  if (s.type === 'daily') return 'Premio del día 7';
  return `Tienda · ${s.price}`;
}

export const SHOP_POOL = SKINS.filter(k => k.src.type === 'shop');
