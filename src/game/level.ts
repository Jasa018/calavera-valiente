// Arma un nivel encadenando tramos.
import { CHUNKS } from '../data/chunks';
import type { LevelDef, WorldDef } from '../data/worlds';
import { ROWS } from './types';

export interface Spawn {
  kind: 'enemy' | 'boss' | 'platX' | 'platY';
  id: string;
  /** Casilla. */
  tx: number;
  ty: number;
}

export interface BuiltLevel {
  w: number;
  grid: string[][];
  start: { tx: number; ty: number };
  spawns: Spawn[];
  deco: { tx: number; ty: number; v: number }[];
  /** Columnas de la sala del jefe. */
  arena?: { x0: number; x1: number };
  /** Columna donde empieza cada tramo (para depurar). */
  starts: { name: string; x: number }[];
}

export function buildLevel(def: LevelDef, world: WorldDef): BuiltLevel {
  const grid: string[][] = Array.from({ length: ROWS }, () => []);
  const spawns: Spawn[] = [];
  const deco: BuiltLevel['deco'] = [];
  const starts: BuiltLevel['starts'] = [];
  let start = { tx: 1, ty: 12 };
  let arena: BuiltLevel['arena'];
  let x0 = 0;
  for (const name of def.chunks) {
    const ch = CHUNKS[name];
    if (!ch) throw new Error(`Tramo desconocido: ${name}`);
    const w = ch.rows[0].length;
    starts.push({ name, x: x0 });
    if (name === 'arena' || name === 'trono') arena = { x0, x1: x0 + w };
    for (let y = 0; y < ROWS; y++) {
      const row = ch.rows[y];
      if (row.length !== w) throw new Error(`Tramo ${name}: la fila ${y} mide ${row.length} y no ${w}`);
      for (let x = 0; x < w; x++) {
        let c = row[x];
        const tx = x0 + x;
        switch (c) {
          case 'P':
            start = { tx, ty: y };
            c = '.';
            break;
          case 'a':
          case 'b':
          case 'c':
          case 'f':
            spawns.push({ kind: 'enemy', id: world.roster[c], tx, ty: y });
            c = '.';
            break;
          case 'Z':
            spawns.push({ kind: 'boss', id: def.boss ?? 'gran_babosa', tx, ty: y });
            c = '.';
            break;
          case 'm':
            spawns.push({ kind: 'platX', id: 'm', tx, ty: y });
            c = '.';
            break;
          case 'n':
            spawns.push({ kind: 'platY', id: 'n', tx, ty: y });
            c = '.';
            break;
          case 'd':
            deco.push({ tx, ty: y, v: (tx * 7 + y * 3) % 5 });
            c = '.';
            break;
        }
        grid[y][tx] = c;
      }
    }
    x0 += w;
  }
  return { w: x0, grid, start, spawns, deco, arena, starts };
}
