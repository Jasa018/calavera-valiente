// Fórmulas de progresión: experiencia, estadísticas de Osmo y fuerza de los monstruos según el mundo.

/** Experiencia para pasar del nivel `l` al siguiente. */
export function xpToNext(l: number) {
  return Math.round(12 * Math.pow(l, 1.35));
}

export function baseStats(level: number) {
  const l = level - 1;
  return {
    maxHp: 24 + 7 * l,
    maxMp: 8 + 2 * l,
    atk: 6 + Math.floor(2.5 * l),
    def: 2 + Math.floor(1.5 * l),
  };
}

/** Nivel de Osmo que se espera en la «dificultad» t (0 = principio del mundo 1, 7 = principio del 8). */
export function expectedLevel(t: number) {
  return 1 + 4.4 * t;
}

const WEAPON_T = [0, 4, 9, 15, 22, 30, 39, 49, 49];
const ARMOR_T = [0, 3, 7, 12, 18, 25, 33, 42, 42];
const lerp = (a: number[], t: number) => {
  const i = Math.max(0, Math.min(a.length - 2, Math.floor(t)));
  const k = Math.max(0, Math.min(1, t - i));
  return a[i] + (a[i + 1] - a[i]) * k;
};

export interface TierStats {
  hp: number;
  atk: number;
  def: number;
  xp: number;
  gold: number;
}

/**
 * Monstruo «normal» en la dificultad t: muere en unos 2-3 golpes de un Osmo con el nivel y el equipo esperados,
 * y le quita algo menos de una quinta parte de la vida.
 */
export function tierStats(t: number): TierStats {
  const L = expectedLevel(t);
  const A = 6 + 2.5 * (L - 1) + lerp(WEAPON_T, t);
  const D = 2 + 1.5 * (L - 1) + lerp(ARMOR_T, t);
  const HP = 24 + 7 * (L - 1);
  const def = 1 + 3.2 * t;
  return {
    hp: 2.6 * (A - def / 2),
    atk: HP / 5.5 + D / 2,
    def,
    xp: xpToNext(Math.round(L)) / (24 + 4 * t),
    gold: 1 + 1.2 * t,
  };
}
