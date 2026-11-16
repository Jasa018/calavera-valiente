// Mundos, niveles y mapamundi.

export type Theme = 'pradera' | 'desierto' | 'nieve' | 'castillo';

export interface LevelDef {
  id: string;
  name: string;
  /** Tramos de `data/chunks.ts`, en orden. */
  chunks: string[];
  /** Jefe del nivel (solo castillos). */
  boss?: string;
}

export type NodeKind = 'inicio' | 'volver' | 'nivel' | 'castillo' | 'tienda' | 'salida';

export interface MapNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  /** Nivel que se juega (nivel y castillo). */
  level?: string;
  label: string;
  /** Nodo que hay que superar para poder pasar por este (salidas). */
  need?: string;
}

export interface WorldDef {
  name: string;
  theme: Theme;
  /** Qué monstruo es cada letra de los tramos. */
  roster: { a: string; b: string; c: string; f: string };
  levels: LevelDef[];
  nodes: MapNode[];
  edges: [string, string][];
  /** Equipo a la venta en su tienda (además de los consumibles). */
  shop: string[];
  /** Adornos del mapa: [x, y]. */
  trees: [number, number][];
}

export const WORLDS: WorldDef[] = [
  {
    name: 'Praderas del Osario',
    theme: 'pradera',
    roster: { a: 'babosa', b: 'rata', c: 'rata', f: 'murcielago' },
    levels: [
      { id: '1-1', name: 'El despertar', chunks: ['inicio', 'llano', 'colina', 'hueco', 'bloques', 'control', 'escalera', 'resorte', 'llano', 'meta'] },
      { id: '1-2', name: 'Charcas tranquilas', chunks: ['inicio', 'llano', 'plataformas', 'hueco', 'colina', 'control', 'bloques', 'escalera', 'foso', 'meta'] },
      { id: '1-3', name: 'Colinas huecas', chunks: ['inicio', 'foso', 'cueva', 'plataformas', 'control', 'pinchos', 'colina', 'torres', 'resorte', 'meta'] },
      { id: '1-C', name: 'Torreón de la Babosa', chunks: ['inicio', 'fortaleza', 'hueco', 'pinchos', 'control', 'arena'], boss: 'gran_babosa' },
    ],
    nodes: [
      { id: 'w1-start', kind: 'inicio', x: 3, y: 10, label: 'Osario' },
      { id: 'w1-1', kind: 'nivel', x: 7, y: 10, level: '1-1', label: '1-1' },
      { id: 'w1-2', kind: 'nivel', x: 11, y: 10, level: '1-2', label: '1-2' },
      { id: 'w1-3', kind: 'nivel', x: 11, y: 5, level: '1-3', label: '1-3' },
      { id: 'w1-shop', kind: 'tienda', x: 16, y: 5, label: 'Tienda del enterrador' },
      { id: 'w1-c', kind: 'castillo', x: 21, y: 5, level: '1-C', label: 'Torreón' },
      { id: 'w1-exit', kind: 'salida', x: 21, y: 10, label: 'Hacia el Desierto de Ceniza', need: 'w1-c' },
    ],
    edges: [['w1-start', 'w1-1'], ['w1-1', 'w1-2'], ['w1-2', 'w1-3'], ['w1-3', 'w1-shop'], ['w1-shop', 'w1-c'], ['w1-c', 'w1-exit']],
    shop: ['hueso_afilado', 'tapa_ataud'],
    trees: [[2, 3], [5, 2], [7, 6], [15, 9], [17, 11], [24, 3], [24, 8], [8, 2], [19, 2], [14, 12]],
  },
  {
    name: 'Desierto de Ceniza',
    theme: 'desierto',
    roster: { a: 'pinchon', b: 'arana', c: 'cangrejo', f: 'murcielago_pardo' },
    levels: [
      { id: '2-1', name: 'Dunas grises', chunks: ['inicio', 'llano', 'torres', 'foso', 'pinchos', 'control', 'movil', 'colina', 'escalera', 'meta'] },
      { id: '2-2', name: 'El oasis seco', chunks: ['inicio', 'cueva', 'plataformas', 'movil', 'control', 'puente', 'islas', 'bloques', 'meta'] },
      { id: '2-3', name: 'Cañón de los huesos', chunks: ['inicio', 'abismo', 'pinchos', 'zigzag', 'control', 'foso', 'movil', 'muralla', 'fortaleza', 'meta'] },
      { id: '2-C', name: 'Fuerte del Cangrejo', chunks: ['inicio', 'fortaleza', 'torres', 'control', 'pinchos', 'ascensor', 'arena'], boss: 'cangrejo_colosal' },
    ],
    nodes: [
      { id: 'w2-start', kind: 'volver', x: 2, y: 4, label: 'Volver a las Praderas' },
      { id: 'w2-1', kind: 'nivel', x: 6, y: 4, level: '2-1', label: '2-1' },
      { id: 'w2-2', kind: 'nivel', x: 6, y: 9, level: '2-2', label: '2-2' },
      { id: 'w2-shop', kind: 'tienda', x: 12, y: 9, label: 'Caravana perdida' },
      { id: 'w2-3', kind: 'nivel', x: 12, y: 4, level: '2-3', label: '2-3' },
      { id: 'w2-c', kind: 'castillo', x: 19, y: 4, level: '2-C', label: 'Fuerte' },
      { id: 'w2-exit', kind: 'salida', x: 19, y: 10, label: 'Hacia las Cumbres Heladas', need: 'w2-c' },
    ],
    edges: [['w2-start', 'w2-1'], ['w2-1', 'w2-2'], ['w2-2', 'w2-shop'], ['w2-shop', 'w2-3'], ['w2-3', 'w2-c'], ['w2-c', 'w2-exit']],
    shop: ['espada_oxidada', 'cota_huesos'],
    trees: [[3, 8], [9, 2], [9, 12], [15, 7], [16, 11], [23, 2], [23, 7], [22, 12], [4, 12], [15, 2]],
  },
  {
    name: 'Cumbres Heladas',
    theme: 'nieve',
    roster: { a: 'erizo', b: 'fantasma', c: 'bloque', f: 'murcielago_helado' },
    levels: [
      { id: '3-1', name: 'Ladera blanca', chunks: ['inicio', 'colina', 'techo', 'hueco', 'puente', 'control', 'islas', 'foso', 'fortaleza', 'meta'] },
      { id: '3-2', name: 'Grietas de hielo', chunks: ['inicio', 'pinchos', 'ascensor', 'abismo', 'control', 'muralla', 'movil', 'techo', 'zigzag', 'meta'] },
      { id: '3-3', name: 'El paso del viento', chunks: ['inicio', 'abismo', 'islas', 'fortaleza', 'control', 'ascensor', 'puente', 'muralla', 'techo', 'meta'] },
      { id: '3-C', name: 'Ciudadela de escarcha', chunks: ['inicio', 'techo', 'fortaleza', 'control', 'islas', 'abismo', 'arena'], boss: 'bloque_titan' },
    ],
    nodes: [
      { id: 'w3-start', kind: 'volver', x: 2, y: 10, label: 'Volver al Desierto' },
      { id: 'w3-1', kind: 'nivel', x: 6, y: 10, level: '3-1', label: '3-1' },
      { id: 'w3-2', kind: 'nivel', x: 6, y: 4, level: '3-2', label: '3-2' },
      { id: 'w3-3', kind: 'nivel', x: 13, y: 4, level: '3-3', label: '3-3' },
      { id: 'w3-shop', kind: 'tienda', x: 13, y: 9, label: 'Refugio del ermitaño' },
      { id: 'w3-c', kind: 'castillo', x: 20, y: 9, level: '3-C', label: 'Ciudadela' },
      { id: 'w3-exit', kind: 'salida', x: 20, y: 3, label: 'Hacia la Fortaleza del Rey Diablo', need: 'w3-c' },
    ],
    edges: [['w3-start', 'w3-1'], ['w3-1', 'w3-2'], ['w3-2', 'w3-3'], ['w3-3', 'w3-shop'], ['w3-shop', 'w3-c'], ['w3-c', 'w3-exit']],
    shop: ['hacha_osaria', 'placas_hierro'],
    trees: [[3, 3], [9, 7], [9, 12], [16, 2], [16, 12], [24, 6], [24, 11], [3, 6], [10, 2], [23, 2]],
  },
  {
    name: 'Fortaleza del Rey Diablo',
    theme: 'castillo',
    roster: { a: 'caballero', b: 'ciclope', c: 'diablillo', f: 'murcielago_infernal' },
    levels: [
      { id: '4-1', name: 'Puente de lava', chunks: ['inicio', 'fortaleza', 'puente', 'movil', 'control', 'techo', 'ascensor', 'pinchos', 'meta'] },
      { id: '4-2', name: 'Salón de las armaduras', chunks: ['inicio', 'techo', 'muralla', 'fortaleza', 'control', 'abismo', 'cueva', 'islas', 'meta'] },
      { id: '4-3', name: 'Las mazmorras', chunks: ['inicio', 'cueva', 'abismo', 'zigzag', 'control', 'puente', 'muralla', 'ascensor', 'fortaleza', 'meta'] },
      { id: '4-C', name: 'Sala del trono', chunks: ['inicio', 'fortaleza', 'islas', 'control', 'techo', 'movil', 'control', 'trono'], boss: 'rey_diablo' },
    ],
    nodes: [
      { id: 'w4-start', kind: 'volver', x: 2, y: 3, label: 'Volver a las Cumbres' },
      { id: 'w4-1', kind: 'nivel', x: 7, y: 3, level: '4-1', label: '4-1' },
      { id: 'w4-2', kind: 'nivel', x: 7, y: 9, level: '4-2', label: '4-2' },
      { id: 'w4-3', kind: 'nivel', x: 13, y: 9, level: '4-3', label: '4-3' },
      { id: 'w4-shop', kind: 'tienda', x: 13, y: 3, label: 'Mercader sin alma' },
      { id: 'w4-c', kind: 'castillo', x: 21, y: 3, level: '4-C', label: 'Trono' },
    ],
    edges: [['w4-start', 'w4-1'], ['w4-1', 'w4-2'], ['w4-2', 'w4-3'], ['w4-3', 'w4-shop'], ['w4-shop', 'w4-c']],
    shop: ['guadana', 'manto_liche'],
    trees: [[4, 7], [4, 12], [10, 6], [10, 12], [17, 6], [17, 11], [23, 8], [24, 12], [16, 1], [24, 1]],
  },
];

export const LEVELS: Record<string, { def: LevelDef; world: number }> = {};
WORLDS.forEach((w, i) => w.levels.forEach((l) => (LEVELS[l.id] = { def: l, world: i })));

export const FINAL_LEVEL = '4-C';
