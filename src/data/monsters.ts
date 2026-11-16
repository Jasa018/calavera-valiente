// Monstruos y jefes. Los sprites salen de los paquetes CC0 de Kenney (ver public/assets)
// salvo el Rey Diablo, que es arte propio (`gfx/art.ts`).

export type Behavior =
  | 'walker' // camina y se da la vuelta en paredes y bordes
  | 'hopper' // salta hacia el jugador cada cierto tiempo
  | 'flyer' // vuela ondulando y se lanza si te acercas
  | 'ghost' // flota hacia ti atravesando paredes
  | 'roller' // rueda rápido; tiene pinchos
  | 'thwomp' // flota quieto y cae a plomo si pasas debajo
  | 'shooter' // lanza bolas de fuego
  | 'charger' // embiste si te ve en su misma altura
  | 'boss';

export type Sheet = 'chars' | 'dungeon' | 'art';

export interface SpriteRef {
  sheet: Sheet;
  /** Fotogramas [columna, fila] en la hoja (o nombre en `art`). */
  frames: ([number, number] | string)[];
  scale?: number;
  /** Si el dibujo original mira a la izquierda. */
  facesLeft?: boolean;
}

export interface MonsterDef {
  id: string;
  name: string;
  behavior: Behavior;
  sprite: SpriteRef;
  w: number;
  h: number;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  gold: number;
  speed: number;
  /** Pisarlo te hace daño a ti. */
  spiky?: boolean;
  /** Pisarlo no le hace nada (rebotas). */
  stompImmune?: boolean;
}

const ch = (...f: [number, number][]): SpriteRef => ({ sheet: 'chars', frames: f });
const dg = (...f: [number, number][]): SpriteRef => ({ sheet: 'dungeon', frames: f });

const LIST: MonsterDef[] = [
  // ── Mundo 1: Praderas del Osario ──
  { id: 'babosa', name: 'Babosa', behavior: 'hopper', sprite: dg([0, 9]), w: 13, h: 11, hp: 10, atk: 5, def: 0, xp: 3, gold: 1, speed: 0.9 },
  { id: 'rata', name: 'Rata de cripta', behavior: 'walker', sprite: dg([4, 10]), w: 13, h: 10, hp: 8, atk: 6, def: 1, xp: 4, gold: 1, speed: 1.1 },
  { id: 'murcielago', name: 'Murciélago', behavior: 'flyer', sprite: ch([6, 2], [7, 2], [8, 2]), w: 16, h: 10, hp: 8, atk: 6, def: 0, xp: 4, gold: 2, speed: 0.9 },

  // ── Mundo 2: Desierto de Ceniza ──
  { id: 'pinchon', name: 'Pinchón', behavior: 'walker', sprite: ch([6, 1], [7, 1]), w: 16, h: 14, hp: 55, atk: 13, def: 5, xp: 10, gold: 4, speed: 0.6, spiky: true },
  { id: 'arana', name: 'Araña de duna', behavior: 'hopper', sprite: dg([2, 10]), w: 14, h: 11, hp: 45, atk: 14, def: 4, xp: 10, gold: 4, speed: 1.6 },
  { id: 'cangrejo', name: 'Cangrejo blindado', behavior: 'walker', sprite: ch([0, 2], [1, 2]), w: 16, h: 12, hp: 60, atk: 15, def: 8, xp: 12, gold: 5, speed: 0.9 },
  { id: 'murcielago_pardo', name: 'Murciélago pardo', behavior: 'flyer', sprite: dg([0, 10]), w: 14, h: 10, hp: 40, atk: 13, def: 3, xp: 10, gold: 4, speed: 1.1 },

  // ── Mundo 3: Cumbres Heladas ──
  { id: 'erizo', name: 'Erizo de hierro', behavior: 'roller', sprite: ch([8, 0]), w: 16, h: 16, hp: 110, atk: 24, def: 12, xp: 18, gold: 8, speed: 1.5, spiky: true },
  { id: 'fantasma', name: 'Fantasma', behavior: 'ghost', sprite: dg([1, 10]), w: 13, h: 13, hp: 95, atk: 23, def: 8, xp: 17, gold: 8, speed: 0.55 },
  { id: 'bloque', name: 'Bloque furioso', behavior: 'thwomp', sprite: ch([2, 1], [3, 1]), w: 18, h: 18, hp: 140, atk: 28, def: 16, xp: 22, gold: 10, speed: 0, stompImmune: true },
  { id: 'murcielago_helado', name: 'Murciélago helado', behavior: 'flyer', sprite: ch([6, 2], [7, 2], [8, 2]), w: 16, h: 10, hp: 80, atk: 22, def: 6, xp: 16, gold: 7, speed: 1.3 },

  // ── Mundo 4: Fortaleza del Rey Diablo ──
  { id: 'caballero', name: 'Caballero oscuro', behavior: 'charger', sprite: dg([0, 8]), w: 12, h: 15, hp: 170, atk: 36, def: 22, xp: 32, gold: 14, speed: 0.6 },
  { id: 'ciclope', name: 'Cíclope', behavior: 'hopper', sprite: dg([1, 9]), w: 13, h: 15, hp: 180, atk: 37, def: 16, xp: 30, gold: 14, speed: 1.2 },
  { id: 'diablillo', name: 'Diablillo', behavior: 'shooter', sprite: dg([2, 9]), w: 13, h: 13, hp: 120, atk: 34, def: 12, xp: 28, gold: 12, speed: 0.5 },
  { id: 'murcielago_infernal', name: 'Murciélago infernal', behavior: 'flyer', sprite: dg([0, 10]), w: 14, h: 10, hp: 110, atk: 32, def: 10, xp: 26, gold: 12, speed: 1.5 },

  // ── Jefes ──
  { id: 'gran_babosa', name: 'Gran Babosa', behavior: 'boss', sprite: { ...dg([0, 9]), scale: 4 }, w: 50, h: 40, hp: 160, atk: 9, def: 2, xp: 70, gold: 50, speed: 1.4 },
  { id: 'cangrejo_colosal', name: 'Cangrejo Colosal', behavior: 'boss', sprite: { ...ch([3, 2], [4, 2]), scale: 3 }, w: 60, h: 40, hp: 460, atk: 22, def: 10, xp: 180, gold: 150, speed: 2.2 },
  { id: 'bloque_titan', name: 'Bloque Titán', behavior: 'boss', sprite: { ...ch([2, 1], [3, 1]), scale: 3 }, w: 54, h: 54, hp: 800, atk: 34, def: 18, xp: 350, gold: 300, speed: 2 },
  { id: 'rey_diablo', name: 'Rey Diablo', behavior: 'boss', sprite: { sheet: 'art', frames: ['rey1', 'rey2'], scale: 2 }, w: 40, h: 56, hp: 1600, atk: 46, def: 24, xp: 0, gold: 0, speed: 2.5 },
];

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(LIST.map((m) => [m.id, m]));
