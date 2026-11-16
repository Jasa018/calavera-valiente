// Partida guardada, estadísticas y subida de nivel.
import { ITEMS } from '../data/items';
import { SKILL, type SkillId, skillsLearnedAt } from '../data/skills';
import { WORLDS } from '../data/worlds';

export interface Save {
  v: 1;
  level: number;
  xp: number;
  hp: number;
  mp: number;
  coins: number;
  cleared: string[];
  inv: Record<string, number>;
  weapon: string;
  armor: string;
  owned: string[];
  world: number;
  node: string;
  kills: number;
  deaths: number;
  /** Se venció al Rey Diablo. */
  won: boolean;
}

export const MAX_LEVEL = 30;

export function newSave(): Save {
  const s: Save = {
    v: 1, level: 1, xp: 0, hp: 0, mp: 0, coins: 0, cleared: [], inv: { pocion: 2 },
    weapon: 'femur', armor: 'harapos', owned: ['femur', 'harapos'], world: 0, node: WORLDS[0].nodes[0].id,
    kills: 0, deaths: 0, won: false,
  };
  const st = stats(s);
  s.hp = st.maxHp;
  s.mp = st.maxMp;
  return s;
}

/** Experiencia para pasar del nivel `l` al siguiente. */
export function xpToNext(l: number) {
  return Math.round(12 * Math.pow(l, 1.35));
}

export interface Stats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  baseAtk: number;
  baseDef: number;
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

export function stats(s: Save): Stats {
  const b = baseStats(s.level);
  const w = ITEMS[s.weapon]?.atk ?? 0;
  const a = ITEMS[s.armor]?.def ?? 0;
  return { maxHp: b.maxHp, maxMp: b.maxMp, atk: b.atk + w, def: b.def + a, baseAtk: b.atk, baseDef: b.def };
}

export function hasSkill(s: Save, id: SkillId) {
  return s.level >= SKILL[id].level;
}

/** Suma experiencia y devuelve los niveles subidos con las habilidades aprendidas. */
export function gainXp(s: Save, xp: number): { level: number; skills: string[] }[] {
  const ups: { level: number; skills: string[] }[] = [];
  s.xp += xp;
  while (s.level < MAX_LEVEL && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    const st = stats(s);
    s.hp = st.maxHp; // subir de nivel te recompone entero
    s.mp = st.maxMp;
    ups.push({ level: s.level, skills: skillsLearnedAt(s.level).map((k) => k.name) });
  }
  return ups;
}

export function addItem(s: Save, id: string, n = 1) {
  s.inv[id] = (s.inv[id] ?? 0) + n;
  if (s.inv[id] <= 0) delete s.inv[id];
}

/** Usa un consumible. Devuelve el texto de lo que hizo, o null si no se pudo. */
export function useItem(s: Save, id: string): string | null {
  const it = ITEMS[id];
  if (!it || !s.inv[id]) return null;
  const st = stats(s);
  if (it.heal && s.hp >= st.maxHp) return null;
  if (it.mana && !it.heal && s.mp >= st.maxMp) return null;
  addItem(s, id, -1);
  const parts: string[] = [];
  if (it.heal) {
    const before = s.hp;
    s.hp = Math.min(st.maxHp, s.hp + it.heal);
    parts.push(`+${s.hp - before} PV`);
  }
  if (it.mana) {
    const before = s.mp;
    s.mp = Math.min(st.maxMp, s.mp + it.mana);
    parts.push(`+${s.mp - before} PM`);
  }
  return parts.join(' ');
}

const KEY = 'calavera-save-v1';

export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    if (s.v !== 1) return null;
    return { ...newSave(), ...s };
  } catch {
    return null;
  }
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento */
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
}
