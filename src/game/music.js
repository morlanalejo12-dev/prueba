// Catálogo de música: cada tema se consigue por nivel, liga, tienda o código.
// Los id llevan el prefijo "mus-" porque comparten el registro de cosméticos con skins y estelas.
export const MUSIC = [
  { id: 'mus-corriente', track: 'corriente', name: 'Corriente', genre: 'Tensión minimalista', bpm: 108, rarity: 'comun', src: { type: 'level', lvl: 1 } },
  { id: 'mus-cascada', track: 'cascada', name: 'Cascada', genre: 'Lo-fi', bpm: 82, rarity: 'comun', src: { type: 'level', lvl: 3 } },
  { id: 'mus-chip', track: 'chip', name: 'Chiptune Rush', genre: '8 bits', bpm: 140, rarity: 'rara', src: { type: 'level', lvl: 7 } },
  { id: 'mus-neon', track: 'neon', name: 'Neón Nocturno', genre: 'Synthwave', bpm: 104, rarity: 'rara', src: { type: 'shop', price: 400 } },
  { id: 'mus-pulso', track: 'pulso', name: 'Pulso Profundo', genre: 'Deep house', bpm: 120, rarity: 'epica', src: { type: 'shop', price: 650 } },
  { id: 'mus-vertigo', track: 'vertigo', name: 'Vértigo', genre: 'Drum & bass', bpm: 168, rarity: 'epica', src: { type: 'rank', tier: 2 } },
  { id: 'mus-tormenta', track: 'tormenta', name: 'Tormenta', genre: 'Techno ácido', bpm: 128, rarity: 'legendaria', src: { type: 'shop', price: 1100 } },
  { id: 'mus-voltaje', track: 'voltaje', name: 'DKO · Voltaje', genre: 'Electro house', bpm: 128, rarity: 'fundador', src: { type: 'code' } },
];

export const musicById = id => MUSIC.find(m => m.id === id) || MUSIC[0];
