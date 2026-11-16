// Elementos, hechizos y habilidades que Osmo aprende al subir de nivel.

export type Element = 'fisico' | 'fuego' | 'hielo' | 'rayo' | 'tierra' | 'luz';

export const ELEMENTS: Record<Element, { name: string; color: string }> = {
  fisico: { name: 'Físico', color: '#f4efe1' },
  fuego: { name: 'Fuego', color: '#ff8a3a' },
  hielo: { name: 'Hielo', color: '#9fe3ff' },
  rayo: { name: 'Rayo', color: '#ffe95a' },
  tierra: { name: 'Tierra', color: '#c8a060' },
  luz: { name: 'Luz', color: '#fff6c8' },
};

export type SkillId =
  | 'golpe' | 'hueso' | 'doble' | 'fuego' | 'embestida' | 'hielo' | 'pisoton' | 'rayo'
  | 'rearmarse' | 'tierra' | 'luz' | 'lluvia' | 'acero' | 'vigor';

export interface SkillDef {
  id: SkillId;
  name: string;
  level: number;
  mp: number;
  keys: string;
  desc: string;
  /** Hechizo que se elige con Q/E y se lanza con C. */
  spell?: boolean;
  elem?: Element;
  /** Multiplicador del ataque. */
  power?: number;
}

export const SKILLS: SkillDef[] = [
  { id: 'golpe', name: 'Golpe de fémur', level: 1, mp: 0, keys: 'X o J', desc: 'Golpea a quien tengas delante. Rompe ladrillos, agrieta muros y mueve palancas.', elem: 'fisico' },
  { id: 'hueso', name: 'Hueso arrojadizo', level: 2, mp: 2, keys: 'C (hechizo)', desc: 'Lanza un hueso en arco. Físico, 80% de tu ataque. Mueve palancas de lejos.', spell: true, elem: 'fisico', power: 0.8 },
  { id: 'doble', name: 'Doble salto', level: 3, mp: 0, keys: 'Saltar en el aire', desc: 'Vuelve a saltar en el aire. Tus huesos pesan poco.' },
  { id: 'fuego', name: 'Bola de fuego', level: 4, mp: 3, keys: 'C (hechizo)', desc: 'Una llama que bota por el suelo. Fuego, 100% de tu ataque.', spell: true, elem: 'fuego', power: 1 },
  { id: 'embestida', name: 'Embestida ósea', level: 6, mp: 3, keys: 'Mayús o L', desc: 'Sales disparado sin recibir daño y golpeas a todo lo que tocas. Rompe muros agrietados.' },
  { id: 'hielo', name: 'Esquirla de hielo', level: 7, mp: 4, keys: 'C (hechizo)', desc: 'Congela a los monstruos unos segundos: puedes subirte encima. Hielo, 70%.', spell: true, elem: 'hielo', power: 0.7 },
  { id: 'pisoton', name: 'Pisotón sísmico', level: 9, mp: 0, keys: 'Abajo + saltar en el aire', desc: 'Caes en picado. La onda daña a los cercanos y rompe ladrillos y muros agrietados.' },
  { id: 'rayo', name: 'Rayo', level: 11, mp: 5, keys: 'C (hechizo)', desc: 'Cae un rayo sobre el monstruo más cercano y salta a otro. Nunca falla. Rayo, 150%.', spell: true, elem: 'rayo', power: 1.5 },
  { id: 'rearmarse', name: 'Rearmarse', level: 13, mp: 6, keys: 'V', desc: 'Recolocas tus huesos: recuperas el 35% de los PV.' },
  { id: 'tierra', name: 'Lanzas de tierra', level: 15, mp: 6, keys: 'C (hechizo)', desc: 'Pinchos de roca recorren el suelo y atraviesan a todos. Derriban muros. Tierra, 140%.', spell: true, elem: 'tierra', power: 1.4 },
  { id: 'luz', name: 'Destello sagrado', level: 19, mp: 9, keys: 'C (hechizo)', desc: 'Una explosión de luz a tu alrededor. Terrible para muertos y demonios. Luz, 200%.', spell: true, elem: 'luz', power: 2 },
  { id: 'lluvia', name: 'Lluvia de calaveras', level: 23, mp: 14, keys: 'B', desc: 'Caen calaveras sobre todos los monstruos de la pantalla (doble de tu ataque).' },
  { id: 'acero', name: 'Esqueleto de acero', level: 27, mp: 0, keys: 'Pasiva', desc: 'Recibes un 25% menos de daño.' },
  { id: 'vigor', name: 'Médula eterna', level: 31, mp: 0, keys: 'Pasiva', desc: 'Recuperas PM el triple de rápido.' },
];

export const SKILL: Record<SkillId, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;
export const SPELLS = SKILLS.filter((s) => s.spell);

export function skillsLearnedAt(level: number): SkillDef[] {
  return SKILLS.filter((s) => s.level === level);
}
