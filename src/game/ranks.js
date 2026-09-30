// Sistema competitivo: Puntos de Rango (PR), ligas con divisiones y protección de liga.
import { clamp } from '../util/math.js';

export const TIERS = [
  { id: 'bronce', name: 'Bronce', col: '#d08b5b' },
  { id: 'plata', name: 'Plata', col: '#c7d0e0' },
  { id: 'oro', name: 'Oro', col: '#ffd166' },
  { id: 'platino', name: 'Platino', col: '#5ef2c2' },
  { id: 'diamante', name: 'Diamante', col: '#8fd8ff' },
  { id: 'maestro', name: 'Maestro', col: '#ff7ad9' },
  { id: 'leyenda', name: 'Leyenda', col: '#ffb547' },
];

// Ventajas de cada liga: bonus de destellos y aura en el juego
export const TIER_PERKS = [
  { coinBonus: 0, aura: 'none', perk: 'Sin bonus' },
  { coinBonus: 0.05, aura: 'none', perk: '+5% de destellos' },
  { coinBonus: 0.1, aura: 'halo', perk: '+10% de destellos · halo dorado' },
  { coinBonus: 0.15, aura: 'halo', perk: '+15% de destellos · halo' },
  { coinBonus: 0.2, aura: 'halo2', perk: '+20% de destellos · halo doble' },
  { coinBonus: 0.3, aura: 'orbit', perk: '+30% de destellos · órbita' },
  { coinBonus: 0.5, aura: 'crown', perk: '+50% de destellos · corona' },
];

const ROMAN = ['', 'I', 'II', 'III'];
export const DIV_PR = 100;          // PR por división
const TIER_PR = DIV_PR * 3;         // cada liga tiene divisiones III, II, I
export const MASTER_PR = TIER_PR * 5;      // 1500
export const LEGEND_PR = MASTER_PR + 500;  // 2000

export function rankOf(pr) {
  pr = Math.max(0, Math.floor(pr));
  if (pr >= LEGEND_PR) return { tier: 6, div: 0, into: pr - LEGEND_PR, need: 0, label: 'Leyenda', short: 'Leyenda' };
  if (pr >= MASTER_PR) return { tier: 5, div: 0, into: pr - MASTER_PR, need: LEGEND_PR - MASTER_PR, label: 'Maestro', short: 'Maestro' };
  const d = Math.floor(pr / DIV_PR);
  const tier = Math.floor(d / 3);
  const div = 3 - (d % 3);
  const name = TIERS[tier].name;
  return { tier, div, into: pr % DIV_PR, need: DIV_PR, label: `${name} ${ROMAN[div]}`, short: name };
}

// Protección de liga: una mala ronda no te baja de liga (sí de división)
export function tierFloor(pr) {
  if (pr >= LEGEND_PR) return LEGEND_PR;
  if (pr >= MASTER_PR) return MASTER_PR;
  return Math.floor(pr / TIER_PR) * TIER_PR;
}

export function prDelta(sum) {
  const d = Math.round((sum.pct - 50) * 0.5) + sum.forksOk * 2
    + (sum.outlier ? 25 : 0) + (sum.beatRival ? 5 : 0) + (sum.alive ? 8 : 0);
  return clamp(d, -20, 50);
}

export function applyPR(pr, delta) {
  return Math.max(tierFloor(pr), pr + delta);
}

// Rango aproximado para mostrar junto a un bot (solo decorativo)
export function botRankLabel(seedValue, playerPR) {
  const pr = clamp(playerPR + Math.round((seedValue - 0.5) * 360), 0, LEGEND_PR + 300);
  return rankOf(pr).label;
}
