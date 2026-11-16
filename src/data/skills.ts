// Habilidades que Osmo aprende al subir de nivel.

export type SkillId = 'golpe' | 'doble' | 'hueso' | 'embestida' | 'pisoton' | 'rearmarse' | 'lluvia' | 'acero';

export interface SkillDef {
  id: SkillId;
  name: string;
  level: number;
  mp: number;
  keys: string;
  desc: string;
}

export const SKILLS: SkillDef[] = [
  { id: 'golpe', name: 'Golpe de fémur', level: 1, mp: 0, keys: 'X o J', desc: 'Golpea con tu fémur a quien tengas delante. También rompe ladrillos.' },
  { id: 'doble', name: 'Doble salto', level: 3, mp: 0, keys: 'Saltar en el aire', desc: 'Vuelve a saltar en el aire. Tus huesos pesan poco.' },
  { id: 'hueso', name: 'Hueso arrojadizo', level: 4, mp: 2, keys: 'C o K', desc: 'Lanza un hueso en arco. Hace el 80% de tu ataque.' },
  { id: 'embestida', name: 'Embestida ósea', level: 6, mp: 3, keys: 'Mayús o L', desc: 'Sales disparado hacia delante sin recibir daño y golpeas a todo lo que tocas.' },
  { id: 'pisoton', name: 'Pisotón sísmico', level: 8, mp: 0, keys: 'Abajo + saltar en el aire', desc: 'Caes en picado. Al tocar suelo, una onda daña a los enemigos cercanos y rompe ladrillos.' },
  { id: 'rearmarse', name: 'Rearmarse', level: 10, mp: 6, keys: 'V', desc: 'Recolocas tus huesos: recuperas el 35% de los PV.' },
  { id: 'lluvia', name: 'Lluvia de calaveras', level: 13, mp: 12, keys: 'B', desc: 'Caen calaveras sobre todos los enemigos de la pantalla (doble de tu ataque).' },
  { id: 'acero', name: 'Esqueleto de acero', level: 15, mp: 0, keys: 'Pasiva', desc: 'Recibes un 25% menos de daño.' },
];

export const SKILL: Record<SkillId, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

export function skillsLearnedAt(level: number): SkillDef[] {
  return SKILLS.filter((s) => s.level === level);
}
