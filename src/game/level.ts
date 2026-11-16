// Arma un nivel encadenando tramos: en fila (niveles normales) o apilados (torres). Las salas de las puertas
// se colocan a la derecha del nivel. La elección de tramos es fija para cada nivel (semilla según su id).
import { CHUNKS, POOLS, ROOMS } from '../data/chunks';
import type { LevelDef, LevelType, Roster } from '../data/worlds';
import { Rng } from './rng';
import type { Rect } from './types';

export interface Spawn {
  kind: 'enemy' | 'boss' | 'platX' | 'platY';
  id: string;
  /** Casilla. */
  tx: number;
  ty: number;
}

export interface BuiltLevel {
  w: number;
  h: number;
  grid: string[][];
  start: { tx: number; ty: number };
  spawns: Spawn[];
  deco: { tx: number; ty: number; v: number }[];
  /** Zonas de cámara: la primera es el nivel, las demás son salas. */
  regions: Rect[];
  /** Sala del jefe. */
  arena?: Rect;
  /** Puertas: "x,y" → casilla de destino. */
  doors: Map<string, { tx: number; ty: number }>;
  /** Tramos usados, con su columna (o fila en torres). */
  starts: { name: string; at: number }[];
}

const TYPE_TAG: Record<LevelType, string> = {
  llanura: 'L', bosque: 'B', desierto: 'D', nieve: 'N', cueva: 'C', castillo: 'K', fortaleza: 'K', cielo: 'S', agua: 'A', carro: 'R', torre: 'T', bonus: '',
};

const FIXED: Record<string, string> = { '!': 'estalactita', '%': 'bloque' };

export function hashId(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Elige los tramos de un nivel (o usa su lista fija). */
export function chunkList(def: LevelDef): string[] {
  if (def.chunks) return def.chunks;
  if (def.type === 'bonus') return ['inicio', 'bonus_a', 'bonus_b', 'meta'];
  const rng = new Rng(hashId(def.id));
  const tower = def.type === 'torre';
  const pool = (POOLS[TYPE_TAG[def.type]] ?? POOLS.L).filter((n) => {
    const ch = CHUNKS[n];
    if (ch.hard && def.tier < 1) return false;
    if (tower && (n === 'torre_base' || n === 'torre_cima' || n === 'torre_control' || ch.room)) return false;
    return true;
  });
  const mid: string[] = [];
  for (let i = 0; i < def.len; i++) {
    let pick = pool[rng.int(0, pool.length - 1)];
    for (let k = 0; k < 6 && (mid.slice(-2).includes(pick) || (pick === 'grande' && def.tier < 0.5)); k++) pick = pool[rng.int(0, pool.length - 1)];
    mid.push(pick);
  }
  const put = (frac: number, name: string) => mid.splice(Math.max(0, Math.min(mid.length, Math.round(mid.length * frac))), 0, name);
  if (tower) {
    if (def.mech.includes('monedas')) put(0.3, 't_monedas');
    if (def.secret) put(0.7, 't_secreto');
    put(0.5, 'torre_control');
    return ['torre_base', ...mid, 'torre_cima'];
  }
  const m = def.mech;
  if (m.includes('muro')) put(0.25, rng.next() < 0.5 ? 'muro1' : 'muro2');
  if (m.includes('palanca')) put(0.45, ['palanca1', 'palanca2', 'palanca3'][rng.int(0, 2)]);
  if (m.includes('monedas')) put(0.6, rng.next() < 0.5 ? 'monedas' : 'invisibles');
  if (def.secret) put(0.65, ['secreto_muro', 'secreto_puerta', 'secreto_alto'][rng.int(0, 2)]);
  if (m.includes('llave')) {
    put(0.3, ['llave_alta', 'llave_muro', 'llave_puerta'][rng.int(0, 2)]);
    put(0.9, 'cerradura');
  }
  if (m.includes('muro') && def.len >= 10) put(0.8, 'muro1');
  put(0.5, 'control');
  if (def.len >= 10) put(0.8, 'control');
  const end = def.boss ? (def.boss === 'rey_diablo' ? 'trono' : 'arena') : 'meta';
  return ['inicio', ...mid, end];
}

export function buildLevel(def: LevelDef, roster?: Roster): BuiltLevel {
  const names = chunkList(def);
  const tower = def.type === 'torre';
  const ros = roster ?? def.roster;
  const spawns: Spawn[] = [];
  const deco: BuiltLevel['deco'] = [];
  const starts: BuiltLevel['starts'] = [];
  const doors = new Map<string, { tx: number; ty: number }>();
  let start = { tx: 1, ty: 12 };
  let arena: Rect | undefined;

  // Medidas del nivel principal
  let mainW = 0, mainH = 0;
  if (tower) {
    mainW = 26;
    mainH = names.reduce((s, n) => s + CHUNKS[n].rows.length, 0);
  } else {
    mainW = names.reduce((s, n) => s + CHUNKS[n].rows[0].length, 0);
    mainH = 15;
  }
  // Salas pedidas por las puertas
  const rooms: { name: string; door: [number, number] | null }[] = [];
  for (const n of names) if (CHUNKS[n].room) rooms.push({ name: ROOMS[CHUNKS[n].room!], door: null });
  const roomX: number[] = [];
  let totalW = mainW;
  for (const r of rooms) {
    totalW += 2;
    roomX.push(totalW);
    totalW += CHUNKS[r.name].rows[0].length;
  }
  const H = Math.max(mainH, rooms.length ? 15 : 0);
  const grid: string[][] = Array.from({ length: H }, () => Array(totalW).fill('X'));
  for (let y = 0; y < mainH; y++) for (let x = 0; x < mainW; x++) grid[y][x] = '.';

  const mainDoors: [number, number][] = [];
  const stamp = (name: string, x0: number, y0: number, isRoom: boolean) => {
    const ch = CHUNKS[name];
    if (!ch) throw new Error(`Tramo desconocido: ${name}`);
    const w = ch.rows[0].length;
    ch.rows.forEach((row, y) => {
      if (row.length !== w) throw new Error(`Tramo ${name}: la fila ${y} mide ${row.length} y no ${w}`);
      for (let x = 0; x < w; x++) {
        let c = row[x];
        const tx = x0 + x, ty = y0 + y;
        switch (c) {
          case 'P':
            start = { tx, ty };
            c = '.';
            break;
          case 'a': case 'b': case 'c': case 'e': case 'f': case 'j':
            spawns.push({ kind: 'enemy', id: ros[c], tx, ty });
            c = '.';
            break;
          case '!': case '%':
            spawns.push({ kind: 'enemy', id: FIXED[c], tx, ty });
            c = '.';
            break;
          case 'Z':
            spawns.push({ kind: 'boss', id: def.boss ?? 'gran_babosa', tx, ty });
            c = '.';
            break;
          case 'm':
            spawns.push({ kind: 'platX', id: 'm', tx, ty });
            c = '.';
            break;
          case 'n':
            spawns.push({ kind: 'platY', id: 'n', tx, ty });
            c = '.';
            break;
          case 'd':
            deco.push({ tx, ty, v: (tx * 7 + ty * 3) % 5 });
            c = '.';
            break;
          case 'D':
            if (!isRoom) mainDoors.push([tx, ty]);
            else rooms.find((r) => r.door === null && r.name === name)!.door = [tx, ty];
            break;
        }
        grid[ty][tx] = c;
      }
    });
  };

  if (tower) {
    // De abajo arriba: el primer tramo va al fondo
    let y = mainH;
    for (const n of names) {
      const hgt = CHUNKS[n].rows.length;
      y -= hgt;
      starts.push({ name: n, at: y });
      stamp(n, 0, y, false);
    }
  } else {
    let x = 0;
    for (const n of names) {
      const w = CHUNKS[n].rows[0].length;
      starts.push({ name: n, at: x });
      if (n === 'arena' || n === 'trono') arena = { x0: x, y0: 0, x1: x + w, y1: 15 };
      stamp(n, x, 0, false);
      x += w;
    }
  }
  const regions: Rect[] = [{ x0: 0, y0: 0, x1: mainW, y1: mainH }];
  rooms.forEach((r, i) => {
    const ch = CHUNKS[r.name];
    stamp(r.name, roomX[i], 0, true);
    regions.push({ x0: roomX[i], y0: 0, x1: roomX[i] + ch.rows[0].length, y1: 15 });
  });
  // Enlaza cada puerta del nivel con la de su sala (en orden)
  mainDoors.forEach(([x, y], i) => {
    const r = rooms[i];
    if (!r?.door) return;
    doors.set(`${x},${y}`, { tx: r.door[0], ty: r.door[1] });
    doors.set(`${r.door[0]},${r.door[1]}`, { tx: x, ty: y });
  });
  return { w: totalW, h: H, grid, start, spawns, deco, regions, arena, doors, starts };
}
