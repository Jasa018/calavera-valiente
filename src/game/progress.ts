// Partida guardada, estadísticas y subida de nivel.
import { ITEMS } from '../data/items';
import { SKILL, SPELLS, type SkillDef, type SkillId, skillsLearnedAt } from '../data/skills';
import { WORLDS } from '../data/worlds';
import { baseStats, xpToNext } from './formulas';

export { baseStats, xpToNext } from './formulas';

export interface Save {
  v: 2;
  level: number;
  xp: number;
  hp: number;
  mp: number;
  coins: number;
  /** Niveles superados (por cualquier salida). */
  cleared: string[];
  /** Niveles superados por la salida secreta. */
  secrets: string[];
  /** Cofres abiertos (id del nodo). */
  opened: string[];
  inv: Record<string, number>;
  weapon: string;
  armor: string;
  owned: string[];
  world: number;
  node: string;
  /** Hechizo elegido. */
  spell: SkillId;
  kills: number;
  deaths: number;
  /** Se venció al Rey Diablo. */
  won: boolean;
}

export const MAX_LEVEL = 40;

export function newSave(): Save {
  const s: Save = {
    v: 2, level: 1, xp: 0, hp: 0, mp: 0, coins: 0, cleared: [], secrets: [], opened: [], inv: { pocion: 2 },
    weapon: 'femur', armor: 'harapos', owned: ['femur', 'harapos'], world: 0, node: WORLDS[0].nodes[0].id,
    spell: 'hueso', kills: 0, deaths: 0, won: false,
  };
  const st = stats(s);
  s.hp = st.maxHp;
  s.mp = st.maxMp;
  return s;
}

export interface Stats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  baseAtk: number;
  baseDef: number;
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

/** Hechizos aprendidos, en orden. */
export function knownSpells(s: Save): SkillDef[] {
  return SPELLS.filter((k) => s.level >= k.level);
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
    const learned = skillsLearnedAt(s.level);
    // Un hechizo nuevo queda elegido
    const sp = learned.find((k) => k.spell);
    if (sp) s.spell = sp.id;
    ups.push({ level: s.level, skills: learned.map((k) => k.name) });
  }
  if (s.level >= MAX_LEVEL) s.xp = 0;
  return ups;
}

export function addItem(s: Save, id: string, n = 1) {
  s.inv[id] = (s.inv[id] ?? 0) + n;
  if (s.inv[id] <= 0) delete s.inv[id];
}

/** Recibe un arma o armadura (y se la equipa si es mejor). */
export function giveGear(s: Save, id: string) {
  const it = ITEMS[id];
  if (!it || s.owned.includes(id)) return;
  s.owned.push(id);
  if (it.kind === 'arma' && (it.atk ?? 0) >= (ITEMS[s.weapon].atk ?? 0)) s.weapon = id;
  if (it.kind === 'armadura' && (it.def ?? 0) >= (ITEMS[s.armor].def ?? 0)) s.armor = id;
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

const KEY = 'calavera-save-v2';

export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    if (s.v !== 2) return null;
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
