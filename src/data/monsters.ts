// Monstruos y jefes. Las estadísticas son multiplicadores sobre un monstruo «normal» del mundo donde aparece
// (ver `game/formulas.ts`), así el mismo monstruo sirve en cualquier mundo.
// Sprites: paquetes CC0 de Kenney (hojas `chars` y `dungeon`) y arte propio (`art`, en `gfx/monsters.ts`).
import type { Element } from './skills';

export type Behavior =
  | 'walker' // camina y se da la vuelta en paredes y bordes (algunos disparan)
  | 'hopper' // salta hacia el jugador cada cierto tiempo
  | 'flyer' // vuela ondulando y se lanza si te acercas
  | 'ghost' // flota hacia ti atravesando paredes cuando no le miras
  | 'roller' // rueda rápido
  | 'thwomp' // flota quieto y cae a plomo si pasas debajo
  | 'dropper' // estalactita: cae una vez cuando pasas debajo
  | 'shooter' // quieto, dispara hacia ti
  | 'plant' // quieta, escupe semillas en arco
  | 'charger' // embiste si te ve a su altura
  | 'swimmer' // nada de lado a lado (algunos te persiguen)
  | 'puffer' // pez globo: se hincha y pincha
  | 'jelly' // medusa: sube a impulsos hacia ti
  | 'burrower' // va bajo tierra y sale a morderte
  | 'cloud' // nube que te sigue y suelta rayos
  | 'boss';

export type Sheet = 'chars' | 'dungeon' | 'art';

export interface SpriteRef {
  sheet: Sheet;
  /** Fotogramas [columna, fila] en la hoja, o nombre del dibujo en `art`. */
  frames: ([number, number] | string)[];
  scale?: number;
  /** Si el dibujo original mira a la izquierda. */
  facesLeft?: boolean;
  /** Recoloreado: giro de tono en grados, saturación y luz (multiplicadores). */
  tint?: [number, number, number];
}

export type ProjKind =
  | 'bone' | 'fire' | 'bubble' | 'ice' | 'skull' | 'wave' | 'seed' | 'rock' | 'stinger' | 'bolt' | 'spike'
  | 'warn' | 'icicle' | 'bullet' | 'feather';

export type BossMove = 'salto' | 'carga' | 'disparo' | 'abanico' | 'burbujas' | 'invocar' | 'caida' | 'lluvia' | 'tele' | 'rayo' | 'remolino';

export interface BossDef {
  base: 'suelo' | 'vuelo' | 'nado';
  moves: BossMove[];
  /** Ataques que se añaden al enfurecerse (por debajo de la mitad de vida). */
  moves2: BossMove[];
  minion?: string;
  shot: ProjKind;
  rain?: ProjKind;
  /** Jefe de mundo (los otros son de media fortaleza). */
  major?: boolean;
}

export interface MonsterDef {
  id: string;
  name: string;
  behavior: Behavior;
  sprite: SpriteRef;
  w: number;
  h: number;
  /** Multiplicadores sobre el monstruo normal del mundo. */
  hp: number;
  atk: number;
  def: number;
  xp: number;
  gold: number;
  speed: number;
  size: 'P' | 'M' | 'G' | 'J';
  weak?: Element[];
  resist?: Element[];
  immune?: Element[];
  /** Pisarlo te hace daño a ti. */
  spiky?: boolean;
  /** Pisarlo no le hace nada (rebotas). */
  stompImmune?: boolean;
  /** No retrocede al recibir golpes. */
  heavy?: boolean;
  /** Fuerza del salto (saltarines). */
  jump?: number;
  /** Disparo (caminantes y tiradores). */
  shot?: ProjKind;
  /** Nadadores que te persiguen. */
  chase?: boolean;
  boss?: BossDef;
}

const ch = (...f: [number, number][]): SpriteRef => ({ sheet: 'chars', frames: f });
const dg = (...f: [number, number][]): SpriteRef => ({ sheet: 'dungeon', frames: f });
const ar = (...f: string[]): SpriteRef => ({ sheet: 'art', frames: f, facesLeft: true });
const T = (s: SpriteRef, h: number, sat = 1, l = 1): SpriteRef => ({ ...s, tint: [h, sat, l] });
const X = (s: SpriteRef, scale: number): SpriteRef => ({ ...s, scale });

type M = Omit<MonsterDef, 'xp' | 'gold' | 'def' | 'size'> & Partial<Pick<MonsterDef, 'xp' | 'gold' | 'def' | 'size'>>;
const P = (m: M): MonsterDef => ({ def: 1, xp: m.hp, gold: 1, size: 'P', ...m });
const Md = (m: M): MonsterDef => ({ def: 1, xp: m.hp * 1.1, gold: 1.5, size: 'M', ...m });
const G = (m: M): MonsterDef => ({ def: 1.3, xp: m.hp * 1.15, gold: 3, size: 'G', heavy: true, ...m });
type BM = Omit<M, 'hp' | 'atk'> & Partial<Pick<MonsterDef, 'hp' | 'atk'>>;
const mid = (m: BM): MonsterDef => ({ def: 1.2, xp: 14, gold: 25, size: 'J', heavy: true, ...m, hp: m.hp ?? 11, atk: m.atk ?? 1.1 });
const big = (m: BM): MonsterDef => ({ def: 1.3, xp: 26, gold: 50, size: 'J', heavy: true, ...m, hp: m.hp ?? 18, atk: m.atk ?? 1.2 });

const LIST: MonsterDef[] = [
  // ── Praderas ──
  P({ id: 'babosa', name: 'Babosa', behavior: 'hopper', sprite: dg([0, 9]), w: 13, h: 11, hp: 0.8, atk: 0.8, def: 0.5, speed: 0.9, weak: ['fuego'] }),
  P({ id: 'rata', name: 'Rata de cripta', behavior: 'walker', sprite: dg([4, 10]), w: 13, h: 10, hp: 0.7, atk: 1, def: 0.8, speed: 1.1, weak: ['fuego'] }),
  P({ id: 'escarabajo', name: 'Escarabajo acorazado', behavior: 'walker', sprite: ar('escarabajo'), w: 14, h: 10, hp: 1.1, atk: 0.9, def: 1.6, speed: 0.7, weak: ['fuego'], resist: ['tierra'] }),
  G({ id: 'golem_musgo', name: 'Gólem de musgo', behavior: 'walker', sprite: X(ar('golem'), 2), w: 34, h: 40, hp: 3.5, atk: 1.3, speed: 0.45, weak: ['fuego'], resist: ['tierra'] }),
  P({ id: 'murcielago', name: 'Murciélago', behavior: 'flyer', sprite: ch([6, 2], [7, 2], [8, 2]), w: 16, h: 10, hp: 0.7, atk: 0.9, def: 0.5, speed: 0.9, weak: ['rayo'] }),
  P({ id: 'seta', name: 'Seta saltarina', behavior: 'hopper', sprite: ar('seta'), w: 14, h: 14, hp: 0.9, atk: 0.9, speed: 1.2, jump: -6.6, weak: ['fuego'] }),

  // ── Bosque ──
  P({ id: 'arana', name: 'Araña del bosque', behavior: 'hopper', sprite: dg([2, 10]), w: 14, h: 11, hp: 0.9, atk: 1, speed: 1.6, weak: ['fuego'] }),
  Md({ id: 'jabali', name: 'Jabalí', behavior: 'charger', sprite: ar('jabali'), w: 22, h: 14, hp: 1.5, atk: 1.2, def: 1.1, speed: 0.7, weak: ['fuego'] }),
  P({ id: 'babosa_veneno', name: 'Babosa venenosa', behavior: 'hopper', sprite: T(dg([0, 9]), 150), w: 13, h: 11, hp: 1, atk: 1, speed: 1.1, weak: ['fuego'] }),
  G({ id: 'ent_joven', name: 'Tronco andante', behavior: 'walker', sprite: X(ar('ent_joven'), 2), w: 32, h: 42, hp: 3.6, atk: 1.3, speed: 0.4, weak: ['fuego'], resist: ['tierra'] }),
  P({ id: 'buho', name: 'Búho nocturno', behavior: 'flyer', sprite: ar('buho'), w: 14, h: 12, hp: 0.8, atk: 1, speed: 1.1, weak: ['rayo'] }),
  Md({ id: 'planta', name: 'Planta carnívora', behavior: 'plant', sprite: ar('planta'), w: 14, h: 22, hp: 1.2, atk: 1.1, speed: 0, weak: ['fuego'], resist: ['tierra'], spiky: true, shot: 'seed' }),

  // ── Desierto ──
  Md({ id: 'pinchon', name: 'Pinchón', behavior: 'walker', sprite: ch([6, 1], [7, 1]), w: 16, h: 14, hp: 1.2, atk: 1, def: 1.2, speed: 0.6, spiky: true, weak: ['hielo'] }),
  Md({ id: 'escorpion', name: 'Escorpión de ceniza', behavior: 'walker', sprite: ar('escorpion'), w: 22, h: 12, hp: 1.3, atk: 1.1, def: 1.2, speed: 0.6, weak: ['hielo'], resist: ['fuego'], shot: 'stinger' }),
  Md({ id: 'momia', name: 'Momia', behavior: 'walker', sprite: ar('momia'), w: 12, h: 22, hp: 1.8, atk: 1.1, def: 0.8, speed: 0.45, weak: ['fuego', 'luz'] }),
  G({ id: 'gusano', name: 'Gusano de arena', behavior: 'burrower', sprite: X(ar('gusano'), 2), w: 30, h: 40, hp: 3.2, atk: 1.4, speed: 1, weak: ['hielo'], resist: ['tierra'] }),
  Md({ id: 'buitre', name: 'Buitre', behavior: 'flyer', sprite: ar('buitre'), w: 20, h: 12, hp: 1, atk: 1.1, speed: 1.2, weak: ['rayo'] }),
  Md({ id: 'cangrejo', name: 'Cangrejo blindado', behavior: 'walker', sprite: ch([0, 2], [1, 2]), w: 16, h: 12, hp: 1.3, atk: 1, def: 1.8, speed: 0.9, weak: ['rayo'], resist: ['fuego'] }),

  // ── Mar ──
  P({ id: 'pez', name: 'Pez óseo', behavior: 'swimmer', sprite: ar('pez'), w: 13, h: 9, hp: 0.8, atk: 0.9, speed: 0.9, weak: ['rayo'], resist: ['fuego'] }),
  P({ id: 'pez_rojo', name: 'Piraña', behavior: 'swimmer', sprite: T(ar('pez'), 160, 1.3), w: 13, h: 9, hp: 1, atk: 1.1, speed: 1.1, chase: true, weak: ['rayo'], resist: ['fuego'] }),
  P({ id: 'medusa', name: 'Medusa', behavior: 'jelly', sprite: ar('medusa'), w: 12, h: 12, hp: 0.8, atk: 1.1, speed: 1, weak: ['hielo'], resist: ['rayo'] }),
  Md({ id: 'globo', name: 'Pez globo', behavior: 'puffer', sprite: ar('globo', 'globo2'), w: 14, h: 14, hp: 1.2, atk: 1.1, speed: 0.4, weak: ['rayo'] }),
  G({ id: 'tiburon', name: 'Tiburón de hueso', behavior: 'swimmer', sprite: X(ar('tiburon'), 2), w: 48, h: 20, hp: 3.2, atk: 1.4, speed: 1.2, chase: true, weak: ['rayo'], resist: ['hielo'] }),
  Md({ id: 'anguila', name: 'Anguila', behavior: 'swimmer', sprite: ar('anguila'), w: 28, h: 8, hp: 1.4, atk: 1.2, speed: 1.4, weak: ['hielo'], resist: ['rayo'] }),
  P({ id: 'babosa_marina', name: 'Babosa marina', behavior: 'hopper', sprite: T(dg([0, 9]), 70), w: 13, h: 11, hp: 1, atk: 1, speed: 1, weak: ['rayo'] }),
  Md({ id: 'gaviota', name: 'Gaviota', behavior: 'flyer', sprite: T(ar('buitre'), 0, 0.15, 1.5), w: 20, h: 12, hp: 1, atk: 1, speed: 1.4, weak: ['rayo'] }),
  G({ id: 'golem_coral', name: 'Gólem de coral', behavior: 'walker', sprite: X(T(ar('golem'), 210, 1.2, 1.1), 2), w: 34, h: 40, hp: 3.5, atk: 1.3, speed: 0.45, weak: ['rayo'] }),
  Md({ id: 'anemona', name: 'Anémona', behavior: 'plant', sprite: T(ar('planta'), 200, 1.2), w: 14, h: 22, hp: 1.2, atk: 1.1, speed: 0, weak: ['fuego'], spiky: true, shot: 'bubble' }),

  // ── Nieve ──
  P({ id: 'pinguino', name: 'Pingüino', behavior: 'charger', sprite: ar('pinguino'), w: 13, h: 14, hp: 0.9, atk: 1, speed: 0.6, weak: ['fuego'], immune: ['hielo'] }),
  Md({ id: 'erizo', name: 'Erizo de hierro', behavior: 'roller', sprite: ch([8, 0]), w: 16, h: 16, hp: 1.3, atk: 1.1, def: 1.3, speed: 1.5, spiky: true, weak: ['fuego'] }),
  Md({ id: 'bloque', name: 'Bloque furioso', behavior: 'thwomp', sprite: ch([2, 1], [3, 1]), w: 18, h: 18, hp: 1.6, atk: 1.3, def: 1.8, speed: 0, stompImmune: true, heavy: true, weak: ['rayo'] }),
  G({ id: 'yeti', name: 'Yeti', behavior: 'hopper', sprite: X(ar('yeti'), 2), w: 34, h: 40, hp: 3.6, atk: 1.4, speed: 1, jump: -6, weak: ['fuego'], immune: ['hielo'] }),
  P({ id: 'murcielago_helado', name: 'Murciélago helado', behavior: 'flyer', sprite: T(ch([6, 2], [7, 2], [8, 2]), 180), w: 16, h: 10, hp: 0.9, atk: 1, speed: 1.3, weak: ['fuego'], immune: ['hielo'] }),
  P({ id: 'espiritu', name: 'Espíritu helado', behavior: 'ghost', sprite: T(dg([1, 10]), 180, 1.5), w: 13, h: 13, hp: 1, atk: 1.1, speed: 0.55, weak: ['fuego', 'luz'], resist: ['fisico'], immune: ['hielo'] }),

  // ── Magma ──
  P({ id: 'babosa_magma', name: 'Babosa de magma', behavior: 'hopper', sprite: T(dg([0, 9]), 240, 1.4), w: 13, h: 11, hp: 1, atk: 1.1, speed: 1.1, weak: ['hielo'], immune: ['fuego'] }),
  Md({ id: 'salamandra', name: 'Salamandra', behavior: 'walker', sprite: ar('salamandra'), w: 20, h: 10, hp: 1.2, atk: 1.1, speed: 0.8, weak: ['hielo'], immune: ['fuego'], shot: 'fire' }),
  P({ id: 'topo', name: 'Topo minero', behavior: 'burrower', sprite: ar('topo'), w: 14, h: 13, hp: 1.1, atk: 1.1, speed: 1, weak: ['hielo'], resist: ['tierra'] }),
  G({ id: 'golem_roca', name: 'Gólem de roca', behavior: 'walker', sprite: X(ar('golem_roca'), 2), w: 34, h: 40, hp: 3.8, atk: 1.4, def: 1.6, speed: 0.4, weak: ['tierra'], resist: ['fisico', 'rayo'] }),
  P({ id: 'murcielago_fuego', name: 'Murciélago de fuego', behavior: 'flyer', sprite: T(ch([6, 2], [7, 2], [8, 2]), 330, 1.3), w: 16, h: 10, hp: 0.9, atk: 1.1, speed: 1.3, weak: ['hielo'], immune: ['fuego'] }),
  P({ id: 'estalactita', name: 'Estalactita', behavior: 'dropper', sprite: ar('estalactita'), w: 10, h: 14, hp: 0.6, atk: 1.3, speed: 0, weak: ['tierra'], stompImmune: true }),

  // ── Cielo ──
  Md({ id: 'pinchon_celeste', name: 'Pinchón celeste', behavior: 'walker', sprite: T(ch([6, 1], [7, 1]), 200), w: 16, h: 14, hp: 1.2, atk: 1.1, speed: 0.7, spiky: true, weak: ['rayo'] }),
  Md({ id: 'gargola', name: 'Gárgola', behavior: 'charger', sprite: ar('gargola'), w: 18, h: 20, hp: 1.6, atk: 1.2, def: 1.6, speed: 0.6, weak: ['rayo'], resist: ['fisico'] }),
  Md({ id: 'bloque_nube', name: 'Bloque de nube', behavior: 'thwomp', sprite: T(ch([2, 1], [3, 1]), 0, 0.1, 1.6), w: 18, h: 18, hp: 1.6, atk: 1.3, def: 1.8, speed: 0, stompImmune: true, heavy: true, weak: ['rayo'] }),
  G({ id: 'coloso', name: 'Coloso dorado', behavior: 'walker', sprite: X(T(ar('golem_roca'), 30, 1.6, 1.3), 2), w: 34, h: 40, hp: 3.8, atk: 1.4, def: 1.6, speed: 0.45, weak: ['rayo'], resist: ['fisico'] }),
  Md({ id: 'arpia', name: 'Arpía', behavior: 'flyer', sprite: ar('arpia'), w: 18, h: 16, hp: 1.2, atk: 1.2, speed: 1.3, weak: ['rayo'], resist: ['tierra'] }),
  Md({ id: 'nube', name: 'Nube de tormenta', behavior: 'cloud', sprite: ar('nube'), w: 20, h: 12, hp: 1, atk: 1.2, speed: 0.9, weak: ['fuego'], immune: ['rayo'], shot: 'bolt' }),

  // ── Fortaleza del Rey Diablo ──
  Md({ id: 'caballero', name: 'Caballero oscuro', behavior: 'charger', sprite: dg([0, 8]), w: 12, h: 15, hp: 1.6, atk: 1.2, def: 1.6, speed: 0.6, weak: ['rayo', 'luz'], resist: ['fisico'] }),
  Md({ id: 'ciclope', name: 'Cíclope', behavior: 'hopper', sprite: dg([1, 9]), w: 13, h: 15, hp: 1.6, atk: 1.2, def: 1.2, speed: 1.2, jump: -6.4, weak: ['luz'] }),
  P({ id: 'diablillo', name: 'Diablillo', behavior: 'shooter', sprite: dg([2, 9]), w: 13, h: 13, hp: 1.2, atk: 1.1, speed: 0.5, weak: ['luz'], immune: ['fuego'], shot: 'fire' }),
  G({ id: 'armadura', name: 'Armadura viviente', behavior: 'charger', sprite: X(ar('armadura'), 2), w: 30, h: 40, hp: 3.8, atk: 1.4, def: 1.8, speed: 0.4, weak: ['rayo', 'luz'], resist: ['fisico'] }),
  P({ id: 'murcielago_infernal', name: 'Murciélago infernal', behavior: 'flyer', sprite: dg([0, 10]), w: 14, h: 10, hp: 1, atk: 1.1, speed: 1.5, weak: ['luz'], resist: ['fuego'] }),
  Md({ id: 'perro', name: 'Perro infernal', behavior: 'charger', sprite: ar('perro'), w: 20, h: 13, hp: 1.3, atk: 1.2, speed: 0.9, weak: ['hielo', 'luz'], immune: ['fuego'] }),

  // ── Jefes de media fortaleza (nivel 4 de cada mundo) ──
  mid({ id: 'gran_babosa', name: 'Gran Babosa', behavior: 'boss', sprite: X(dg([0, 9]), 4), w: 50, h: 40, speed: 1.4, weak: ['fuego'],
    boss: { base: 'suelo', moves: ['salto', 'salto', 'invocar'], moves2: ['salto'], minion: 'babosa', shot: 'wave' } }),
  mid({ id: 'jabali_colmillo', name: 'Jabalí Colmillo', behavior: 'boss', sprite: X(T(ar('jabali'), 330, 1.2, 0.8), 3), w: 60, h: 40, speed: 2, weak: ['fuego'],
    boss: { base: 'suelo', moves: ['carga', 'carga', 'salto'], moves2: ['invocar'], minion: 'arana', shot: 'wave' } }),
  mid({ id: 'escorpion_rey', name: 'Escorpión Rey', behavior: 'boss', sprite: X(T(ar('escorpion'), 330, 1.5), 3), w: 60, h: 36, speed: 2, weak: ['hielo'], resist: ['fuego'],
    boss: { base: 'suelo', moves: ['carga', 'disparo', 'salto'], moves2: ['abanico'], shot: 'stinger' } }),
  mid({ id: 'pulpo_abisal', name: 'Pulpo Abisal', behavior: 'boss', sprite: X(ar('pulpo'), 3), w: 50, h: 50, speed: 1.6, weak: ['rayo'], resist: ['fuego'],
    boss: { base: 'nado', moves: ['burbujas', 'remolino', 'invocar'], moves2: ['abanico'], minion: 'medusa', shot: 'bubble' } }),
  mid({ id: 'yeti_rey', name: 'Yeti Ancestral', behavior: 'boss', sprite: X(T(ar('yeti'), 190, 0.6, 1.1), 3), w: 54, h: 60, speed: 2, weak: ['fuego'], immune: ['hielo'],
    boss: { base: 'suelo', moves: ['salto', 'carga', 'lluvia'], moves2: ['salto'], shot: 'wave', rain: 'icicle' } }),
  mid({ id: 'golem_lava', name: 'Gólem de Lava', behavior: 'boss', sprite: X(T(ar('golem_roca'), 340, 1.8, 1.1), 3), w: 56, h: 60, speed: 1.6, weak: ['hielo'], immune: ['fuego'],
    boss: { base: 'suelo', moves: ['salto', 'disparo', 'lluvia'], moves2: ['carga'], shot: 'fire', rain: 'rock' } }),
  mid({ id: 'arpia_reina', name: 'Arpía Reina', behavior: 'boss', sprite: X(T(ar('arpia'), 280, 1.3), 3), w: 44, h: 40, speed: 2, weak: ['rayo'],
    boss: { base: 'vuelo', moves: ['abanico', 'carga', 'invocar'], moves2: ['lluvia'], minion: 'arpia', shot: 'feather', rain: 'feather' } }),
  mid({ id: 'caballero_negro', name: 'Caballero Negro', behavior: 'boss', sprite: X(T(ar('armadura'), 250, 0.6, 0.6), 3), w: 46, h: 64, speed: 2.2, weak: ['luz', 'rayo'],
    boss: { base: 'suelo', moves: ['carga', 'salto', 'disparo'], moves2: ['tele'], shot: 'fire' } }),

  // ── Jefes de mundo (nivel 8) ──
  big({ id: 'rey_rata', name: 'Rey Rata', behavior: 'boss', sprite: X(ar('rey_rata'), 3), w: 56, h: 50, speed: 2, weak: ['fuego'],
    boss: { base: 'suelo', moves: ['carga', 'salto', 'invocar'], moves2: ['disparo'], minion: 'rata', shot: 'bone', major: true } }),
  big({ id: 'ent', name: 'Ent Anciano', behavior: 'boss', sprite: X(ar('ent'), 2), w: 48, h: 60, speed: 1, weak: ['fuego'], resist: ['tierra'],
    boss: { base: 'suelo', moves: ['burbujas', 'invocar', 'lluvia'], moves2: ['salto'], minion: 'seta', shot: 'seed', rain: 'seed', major: true } }),
  big({ id: 'cangrejo_colosal', name: 'Cangrejo Colosal', behavior: 'boss', sprite: X(ch([3, 2], [4, 2]), 3), w: 60, h: 40, speed: 2.2, weak: ['rayo'], resist: ['fuego'],
    boss: { base: 'suelo', moves: ['burbujas', 'carga'], moves2: ['carga', 'salto'], shot: 'bubble', major: true } }),
  big({ id: 'leviatan', name: 'Leviatán', behavior: 'boss', sprite: X(ar('leviatan'), 2), w: 54, h: 34, speed: 2, weak: ['rayo'], resist: ['hielo'],
    boss: { base: 'nado', moves: ['remolino', 'abanico', 'invocar'], moves2: ['remolino', 'burbujas'], minion: 'pez_rojo', shot: 'bubble', major: true } }),
  big({ id: 'bloque_titan', name: 'Bloque Titán', behavior: 'boss', sprite: X(ch([2, 1], [3, 1]), 3), w: 54, h: 54, speed: 2, weak: ['fuego'], immune: ['hielo'], stompImmune: true,
    boss: { base: 'vuelo', moves: ['caida', 'caida', 'disparo'], moves2: ['caida', 'lluvia'], shot: 'ice', rain: 'icicle', major: true } }),
  big({ id: 'dragon', name: 'Dragón de Magma', behavior: 'boss', sprite: X(ar('dragon'), 2), w: 50, h: 46, speed: 2, weak: ['hielo'], immune: ['fuego'],
    boss: { base: 'vuelo', moves: ['abanico', 'lluvia', 'carga'], moves2: ['disparo'], shot: 'fire', rain: 'fire', major: true } }),
  big({ id: 'senor_tormentas', name: 'Señor de las Tormentas', behavior: 'boss', sprite: X(ar('senor'), 2), w: 40, h: 54, speed: 2, weak: ['hielo'], immune: ['rayo'],
    boss: { base: 'vuelo', moves: ['rayo', 'tele', 'invocar', 'carga'], moves2: ['abanico', 'rayo'], minion: 'nube', shot: 'bolt', major: true } }),
  big({ id: 'rey_diablo', name: 'Rey Diablo', behavior: 'boss', sprite: { sheet: 'art', frames: ['rey1', 'rey2'], scale: 2 }, w: 40, h: 56, hp: 26, atk: 1.25, xp: 0, gold: 0, speed: 2.5, weak: ['luz'],
    boss: { base: 'suelo', moves: ['disparo', 'salto', 'invocar', 'tele'], moves2: ['lluvia', 'carga', 'abanico'], minion: 'diablillo', shot: 'fire', rain: 'fire', major: true } }),
];

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(LIST.map((m) => [m.id, m]));
