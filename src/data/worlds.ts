// Mundos, niveles y mapamundi.
//
// Cada mundo tiene 8 niveles (el 4 es una fortaleza con jefe intermedio y el 8 el castillo del jefe del mundo),
// un nivel secreto (S) y una sala de monedas (B). El mapa no es lineal: se elige camino, y las salidas secretas
// de los niveles 3 y 6 abren caminos ocultos hacia el nivel secreto, un cofre y un atajo.

export type LevelType =
  | 'llanura' | 'bosque' | 'desierto' | 'nieve' | 'cueva' | 'castillo' | 'fortaleza' | 'cielo' | 'agua' | 'carro' | 'torre' | 'bonus';
export type Look = 'pradera' | 'bosque' | 'desierto' | 'mar' | 'nieve' | 'cueva' | 'cielo' | 'castillo';
export type Mech = 'llave' | 'palanca' | 'muro' | 'monedas';
export type Letter = 'a' | 'b' | 'c' | 'e' | 'f' | 'j';
export type Roster = Record<Letter, string>;

export interface LevelDef {
  id: string;
  name: string;
  type: LevelType;
  look: Look;
  /** Tramos intermedios (sin contar inicio, puntos de control ni meta). */
  len: number;
  /** Lista fija de tramos (si no, se generan). */
  chunks?: string[];
  boss?: string;
  mech: Mech[];
  /** Tiene salida secreta. */
  secret: boolean;
  dark: boolean;
  ice: boolean;
  water: boolean;
  wind: number;
  /** Velocidad de la lava que sube (torres). */
  lava: number;
  music: string;
  /** Dificultad: fuerza de los monstruos. */
  tier: number;
  roster: Roster;
  /** Nivel del mapa: 1..8, S o B. */
  slot: string;
}

export type NodeKind = 'inicio' | 'volver' | 'nivel' | 'fortaleza' | 'castillo' | 'secreto' | 'casa' | 'tienda' | 'cofre' | 'salida' | 'paso';

export interface MapNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  level?: string;
  label: string;
  /** Tesoro del cofre. */
  item?: string;
}

export interface MapEdge {
  a: string;
  b: string;
  /** Nivel que abre el camino al superarlo. Sin `by`, siempre está abierto. */
  by?: string;
  /** El camino lo abre la salida secreta de `by` (y no se ve hasta entonces). */
  secret?: boolean;
}

export interface WorldDef {
  name: string;
  look: Look;
  levels: LevelDef[];
  nodes: MapNode[];
  edges: MapEdge[];
  /** Equipo a la venta en su tienda (además de los consumibles). */
  shop: string[];
  /** Adornos del mapa: [x, y]. */
  trees: [number, number][];
}

const ROSTERS: Roster[] = [
  { a: 'babosa', b: 'rata', c: 'escarabajo', e: 'golem_musgo', f: 'murcielago', j: 'seta' },
  { a: 'arana', b: 'jabali', c: 'babosa_veneno', e: 'ent_joven', f: 'buho', j: 'planta' },
  { a: 'pinchon', b: 'escorpion', c: 'momia', e: 'gusano', f: 'buitre', j: 'cangrejo' },
  { a: 'babosa_marina', b: 'cangrejo', c: 'cangrejo', e: 'golem_coral', f: 'gaviota', j: 'anemona' },
  { a: 'pinguino', b: 'erizo', c: 'bloque', e: 'yeti', f: 'murcielago_helado', j: 'espiritu' },
  { a: 'babosa_magma', b: 'salamandra', c: 'topo', e: 'golem_roca', f: 'murcielago_fuego', j: 'estalactita' },
  { a: 'pinchon_celeste', b: 'gargola', c: 'bloque_nube', e: 'coloso', f: 'arpia', j: 'nube' },
  { a: 'caballero', b: 'ciclope', c: 'diablillo', e: 'armadura', f: 'murcielago_infernal', j: 'perro' },
];

const WATER: Roster = { a: 'pez', b: 'pez_rojo', c: 'cangrejo', e: 'tiburon', f: 'medusa', j: 'globo' };

const TYPE_LOOK: Partial<Record<LevelType, Look>> = { cueva: 'cueva', castillo: 'castillo', cielo: 'cielo', agua: 'mar' };
const MUSIC: Record<Look, string> = {
  pradera: 'pradera', bosque: 'bosque', desierto: 'desierto', mar: 'mar', nieve: 'nieve', cueva: 'cueva', cielo: 'cielo', castillo: 'castillo',
};

interface Opts {
  len?: number;
  look?: Look;
  boss?: string;
  mech?: Mech[];
  secret?: boolean;
  dark?: boolean;
  ice?: boolean;
  water?: boolean;
  wind?: number;
  lava?: number;
  chunks?: string[];
}

function level(wi: number, look: Look, slot: string, name: string, type: LevelType, o: Opts = {}): LevelDef {
  const idx = slot === 'S' ? 6 : slot === 'B' ? 0 : Number(slot) - 1;
  const water = o.water ?? type === 'agua';
  const lk = o.look ?? TYPE_LOOK[type] ?? look;
  let roster: Roster = { ...ROSTERS[wi] };
  if (water) roster = { ...WATER, e: wi < 3 ? 'anguila' : 'tiburon' };
  else if (type === 'cueva') roster.j = 'estalactita';
  else if (type === 'cielo') roster.j = 'nube';
  const music = type === 'carro' ? 'carro' : type === 'torre' ? 'torre' : MUSIC[lk];
  return {
    id: `${wi + 1}-${slot}`,
    name,
    type,
    look: lk,
    len: o.len ?? 8,
    chunks: o.chunks,
    boss: o.boss,
    mech: o.mech ?? [],
    secret: !!o.secret,
    dark: !!o.dark,
    ice: o.ice ?? type === 'nieve',
    water,
    wind: o.wind ?? 0,
    lava: o.lava ?? 0,
    music,
    tier: wi + idx * 0.1 + (slot === 'S' ? 0.1 : 0),
    roster,
    slot,
  };
}

// ── Plantilla del mapa ──
// Coordenadas de la plantilla (se voltean para que cada mundo se vea distinto).
const TEMPLATE: Record<string, [number, number]> = {
  start: [2, 10], '1': [5, 10], '2': [5, 6], '3': [10, 10], '4': [10, 6], S: [14, 10], cofre: [18, 10],
  tienda: [14, 6], '5': [14, 2], '6': [18, 6], '7': [18, 2], B: [22, 6], '8': [22, 2], salida: [25, 2],
};

interface MapInfo {
  flipX?: boolean;
  flipY?: boolean;
  start: string;
  tienda: string;
  cofre: string;
  salida?: string;
  item: string;
}

function buildMap(wi: number, levels: LevelDef[], m: MapInfo): Pick<WorldDef, 'nodes' | 'edges'> {
  const pos = (k: string): [number, number] => {
    const [x, y] = TEMPLATE[k];
    return [m.flipX ? 27 - x : x, m.flipY ? 12 - y : y];
  };
  const id = (k: string) => `w${wi + 1}-${k}`;
  const lv = (slot: string) => levels.find((l) => l.slot === slot)!;
  const nodes: MapNode[] = [];
  const add = (k: string, kind: NodeKind, label: string, extra: Partial<MapNode> = {}) => {
    const [x, y] = pos(k);
    nodes.push({ id: id(k), kind, x, y, label, ...extra });
  };
  add('start', wi === 0 ? 'inicio' : 'volver', m.start);
  for (const slot of ['1', '2', '3', '4', '5', '6', '7', '8', 'S', 'B']) {
    const l = lv(slot);
    const kind: NodeKind = slot === '4' ? 'fortaleza' : slot === '8' ? 'castillo' : slot === 'S' ? 'secreto' : slot === 'B' ? 'casa' : 'nivel';
    add(slot, kind, l.id, { level: l.id });
  }
  add('tienda', 'tienda', m.tienda);
  add('cofre', 'cofre', m.cofre, { item: m.item });
  if (m.salida) add('salida', 'salida', m.salida);
  const L = (slot: string) => lv(slot).id;
  const edges: MapEdge[] = [
    { a: id('start'), b: id('1') },
    { a: id('1'), b: id('2'), by: L('1') },
    { a: id('1'), b: id('3'), by: L('1') },
    { a: id('2'), b: id('4'), by: L('2') },
    { a: id('3'), b: id('4'), by: L('3') },
    { a: id('3'), b: id('S'), by: L('3'), secret: true },
    { a: id('S'), b: id('cofre'), by: L('S') },
    { a: id('4'), b: id('tienda'), by: L('4') },
    { a: id('tienda'), b: id('5'), by: L('4') },
    { a: id('tienda'), b: id('6'), by: L('4') },
    { a: id('5'), b: id('7'), by: L('5') },
    { a: id('6'), b: id('7'), by: L('6') },
    { a: id('6'), b: id('B'), by: L('6'), secret: true },
    { a: id('B'), b: id('8'), by: L('6'), secret: true },
    { a: id('7'), b: id('8'), by: L('7') },
  ];
  if (m.salida) edges.push({ a: id('8'), b: id('salida'), by: L('8') });
  return { nodes, edges };
}

function world(
  wi: number,
  name: string,
  look: Look,
  defs: [string, string, LevelType, Opts?][],
  map: MapInfo,
  shop: string[],
): WorldDef {
  const levels = defs.map(([slot, n, type, o]) => level(wi, look, slot, n, type, o));
  const { nodes, edges } = buildMap(wi, levels, map);
  // Adornos del mapa en sitios libres (fijos por mundo)
  const trees: [number, number][] = [];
  let seed = 977 * (wi + 1);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const busy = (x: number, y: number) => nodes.some((n) => Math.abs(n.x - x) <= 1 && Math.abs(n.y - y) <= 1) ||
    edges.some((e) => {
      const a = nodes.find((n) => n.id === e.a)!, b = nodes.find((n) => n.id === e.b)!;
      return Math.min(a.x, b.x) - 1 <= x && x <= Math.max(a.x, b.x) + 1 && Math.min(a.y, b.y) - 1 <= y && y <= Math.max(a.y, b.y) + 1;
    });
  for (let i = 0; i < 200 && trees.length < 16; i++) {
    const x = 1 + Math.floor(rnd() * 25), y = Math.floor(rnd() * 12);
    if (!busy(x, y) && !trees.some(([tx, ty]) => tx === x && ty === y)) trees.push([x, y]);
  }
  return { name, look, levels, nodes, edges, shop, trees };
}

export const WORLDS: WorldDef[] = [
  world(0, 'Praderas del Osario', 'pradera', [
    ['1', 'El despertar', 'llanura', { chunks: ['inicio', 'llano', 'colina', 'hueco', 'bloques', 'control', 'escalera', 'resorte', 'llano', 'meta'] }],
    ['2', 'Colinas de margaritas', 'llanura', { len: 8, mech: ['muro'] }],
    ['3', 'Gruta del sepulturero', 'cueva', { len: 8, mech: ['llave'], secret: true }],
    ['4', 'Torreón de la Babosa', 'fortaleza', { len: 5, boss: 'gran_babosa', look: 'castillo' }],
    ['5', 'Bosquecillo de los cuervos', 'bosque', { len: 9, mech: ['palanca'], look: 'bosque' }],
    ['6', 'Globos de diente de león', 'cielo', { len: 8, secret: true }],
    ['7', 'La vía del cementerio', 'carro', { len: 9 }],
    ['8', 'Castillo del Rey Rata', 'castillo', { len: 7, boss: 'rey_rata' }],
    ['S', 'Pradera escondida', 'llanura', { len: 9, mech: ['monedas'] }],
    ['B', 'Sala de monedas', 'bonus'],
  ], { start: 'Osario', tienda: 'Tienda del enterrador', cofre: 'Cofre de la pradera', salida: 'Hacia el Bosque Sombrío', item: 'femur_ardiente' },
  ['hueso_afilado', 'tapa_ataud']),

  world(1, 'Bosque Sombrío', 'bosque', [
    ['1', 'Linde del bosque', 'bosque', { len: 8 }],
    ['2', 'Estanque de los nenúfares', 'agua', { len: 8 }],
    ['3', 'Copas de los robles', 'bosque', { len: 9, mech: ['monedas'], secret: true }],
    ['4', 'Madriguera del Jabalí', 'fortaleza', { len: 6, boss: 'jabali_colmillo' }],
    ['5', 'Raíces profundas', 'cueva', { len: 9, mech: ['llave'] }],
    ['6', 'El árbol hueco', 'torre', { len: 6, secret: true }],
    ['7', 'Senda de las setas', 'bosque', { len: 10, mech: ['palanca'] }],
    ['8', 'Corazón del bosque', 'castillo', { len: 8, boss: 'ent', look: 'bosque' }],
    ['S', 'Claro de las hadas', 'bosque', { len: 10, mech: ['muro'] }],
    ['B', 'Sala de monedas', 'bonus'],
  ], { flipY: true, start: 'Volver a las Praderas', tienda: 'Cabaña del leñador', cofre: 'Cofre del claro', salida: 'Hacia el Desierto de Ceniza', item: 'escudo_raices' },
  ['espada_oxidada', 'cota_huesos']),

  world(2, 'Desierto de Ceniza', 'desierto', [
    ['1', 'Dunas grises', 'desierto', { len: 9 }],
    ['2', 'Tormenta de arena', 'desierto', { len: 9, wind: 1 }],
    ['3', 'La pirámide hundida', 'castillo', { len: 9, mech: ['llave', 'palanca'], look: 'desierto', secret: true }],
    ['4', 'Guarida del Escorpión', 'fortaleza', { len: 6, boss: 'escorpion_rey' }],
    ['5', 'Mina abandonada', 'carro', { len: 10, look: 'cueva' }],
    ['6', 'Oasis seco', 'desierto', { len: 10, mech: ['muro'], secret: true }],
    ['7', 'Cañón de los huesos', 'cielo', { len: 10, mech: ['llave'], look: 'desierto' }],
    ['8', 'Fuerte del Cangrejo', 'castillo', { len: 8, boss: 'cangrejo_colosal' }],
    ['S', 'Tumba del faraón', 'castillo', { len: 10, dark: true, look: 'desierto', mech: ['monedas'] }],
    ['B', 'Sala de monedas', 'bonus'],
  ], { flipX: true, start: 'Volver al Bosque', tienda: 'Caravana perdida', cofre: 'Sarcófago dorado', salida: 'Hacia el Mar Hundido', item: 'daga_escarcha' },
  ['maza_tumba', 'escudo_lapida']),

  world(3, 'Mar Hundido', 'mar', [
    ['1', 'Bajada al arrecife', 'agua', { len: 9 }],
    ['2', 'Bosque de algas', 'agua', { len: 9, mech: ['palanca'] }],
    ['3', 'El barco hundido', 'agua', { len: 10, dark: true, mech: ['llave'], secret: true }],
    ['4', 'Gruta del Pulpo', 'fortaleza', { len: 6, boss: 'pulpo_abisal', water: true, look: 'mar' }],
    ['5', 'Playa de los naufragios', 'llanura', { len: 10, mech: ['muro'], look: 'desierto' }],
    ['6', 'Faro en ruinas', 'torre', { len: 7, look: 'pradera', secret: true }],
    ['7', 'Fosa abisal', 'agua', { len: 11, dark: true }],
    ['8', 'Palacio del Leviatán', 'castillo', { len: 8, boss: 'leviatan', water: true, look: 'mar' }],
    ['S', 'Templo de coral', 'agua', { len: 11, mech: ['monedas'] }],
    ['B', 'Sala de monedas', 'bonus'],
  ], { flipX: true, flipY: true, start: 'Volver al Desierto', tienda: 'Concha del mercader', cofre: 'Cofre del templo', salida: 'Hacia las Cumbres Heladas', item: 'tridente' },
  ['hacha_osaria', 'placas_hierro']),

  world(4, 'Cumbres Heladas', 'nieve', [
    ['1', 'Ladera blanca', 'nieve', { len: 10 }],
    ['2', 'Lago congelado', 'nieve', { len: 10 }],
    ['3', 'Cueva de cristal', 'cueva', { len: 10, look: 'nieve', ice: true, mech: ['llave'], secret: true }],
    ['4', 'Cubil del Yeti', 'fortaleza', { len: 7, boss: 'yeti_rey' }],
    ['5', 'Ventisca', 'nieve', { len: 10, wind: 1.2, mech: ['muro'] }],
    ['6', 'Pico del águila', 'torre', { len: 8, secret: true }],
    ['7', 'Teleférico roto', 'cielo', { len: 11, look: 'nieve', mech: ['llave'] }],
    ['8', 'Ciudadela de escarcha', 'castillo', { len: 9, boss: 'bloque_titan', look: 'nieve' }],
    ['S', 'Gruta del eco', 'cueva', { len: 11, dark: true, look: 'nieve', mech: ['monedas'] }],
    ['B', 'Sala de monedas', 'bonus'],
  ], { start: 'Volver al Mar', tienda: 'Refugio del ermitaño', cofre: 'Cofre helado', salida: 'Hacia las Cavernas de Magma', item: 'coraza_glaciar' },
  ['lanza_coral', 'escamas']),

  world(5, 'Cavernas de Magma', 'cueva', [
    ['1', 'Boca del volcán', 'cueva', { len: 10 }],
    ['2', 'Ríos de lava', 'castillo', { len: 10, look: 'cueva', mech: ['palanca'] }],
    ['3', 'Galerías oscuras', 'cueva', { len: 10, dark: true, mech: ['llave'], secret: true }],
    ['4', 'Fragua del Gólem', 'fortaleza', { len: 7, boss: 'golem_lava', look: 'cueva' }],
    ['5', 'Las minas profundas', 'carro', { len: 11, look: 'cueva' }],
    ['6', 'Chimenea ardiente', 'torre', { len: 8, lava: 0.22, look: 'cueva', secret: true }],
    ['7', 'Lago de fuego', 'castillo', { len: 11, look: 'cueva', mech: ['muro'] }],
    ['8', 'Nido del Dragón', 'castillo', { len: 9, boss: 'dragon', look: 'cueva' }],
    ['S', 'Cámara del tesoro', 'cueva', { len: 11, dark: true, mech: ['monedas'] }],
    ['B', 'Sala de monedas', 'bonus'],
  ], { flipY: true, start: 'Volver a las Cumbres', tienda: 'Forja del enano', cofre: 'Cofre de magma', salida: 'Hacia la Torre de las Nubes', item: 'martillo_volcan' },
  ['espada_runica', 'manto_escarcha']),

  world(6, 'Torre de las Nubes', 'cielo', [
    ['1', 'Escalera de nubes', 'cielo', { len: 10 }],
    ['2', 'Vientos cruzados', 'cielo', { len: 10, wind: 1 }],
    ['3', 'Jardines flotantes', 'bosque', { len: 11, look: 'cielo', mech: ['palanca'], secret: true }],
    ['4', 'Nido de la Arpía', 'fortaleza', { len: 7, boss: 'arpia_reina', look: 'cielo' }],
    ['5', 'Torre del relámpago', 'torre', { len: 9, look: 'cielo' }],
    ['6', 'Puentes de arco iris', 'cielo', { len: 11, secret: true }],
    ['7', 'Ciudadela celeste', 'castillo', { len: 11, look: 'cielo', mech: ['llave'] }],
    ['8', 'Trono de la tormenta', 'castillo', { len: 9, boss: 'senor_tormentas', look: 'cielo' }],
    ['S', 'El ojo del huracán', 'cielo', { len: 12, wind: 1.4, mech: ['monedas'] }],
    ['B', 'Sala de monedas', 'bonus'],
  ], { flipX: true, start: 'Volver a las Cavernas', tienda: 'Globo del mercader', cofre: 'Cofre celeste', salida: 'Hacia la Fortaleza del Rey Diablo', item: 'manto_celeste' },
  ['guadana', 'manto_liche']),

  world(7, 'Fortaleza del Rey Diablo', 'castillo', [
    ['1', 'Puente de lava', 'castillo', { len: 11 }],
    ['2', 'Salón de las armaduras', 'castillo', { len: 11, mech: ['palanca'] }],
    ['3', 'Las mazmorras', 'cueva', { len: 11, look: 'castillo', dark: true, mech: ['llave'], secret: true }],
    ['4', 'Guardia del Caballero Negro', 'fortaleza', { len: 8, boss: 'caballero_negro' }],
    ['5', 'Carros del infierno', 'carro', { len: 12, look: 'castillo' }],
    ['6', 'Torre del vigía', 'torre', { len: 9, lava: 0.26, secret: true }],
    ['7', 'Pasillo de los mil muros', 'castillo', { len: 12, mech: ['muro', 'llave'] }],
    ['8', 'Sala del trono', 'castillo', { len: 9, boss: 'rey_diablo' }],
    ['S', 'Biblioteca prohibida', 'castillo', { len: 12, dark: true, mech: ['monedas'] }],
    ['B', 'Sala de monedas', 'bonus'],
  ], { flipX: true, flipY: true, start: 'Volver a la Torre de las Nubes', tienda: 'Mercader sin alma', cofre: 'Cofre del Rey', item: 'espada_alba' },
  ['guadana', 'manto_liche']),
];

export const LEVELS: Record<string, { def: LevelDef; world: number }> = {};
WORLDS.forEach((w, i) => w.levels.forEach((l) => (LEVELS[l.id] = { def: l, world: i })));

export const FINAL_LEVEL = '8-8';
