// Carga de las hojas de sprites (Kenney, CC0), versiones recoloreadas por ambiente y sprites tintados.
import type { SpriteRef } from '../data/monsters';
import type { Look } from '../data/worlds';
import { artFrame } from './art';

export interface Sheets {
  tiles: Record<Look, HTMLCanvasElement>;
  chars: HTMLImageElement;
  dungeon: HTMLImageElement;
  bg: Record<Look, HTMLCanvasElement>;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ko(new Error('No se pudo cargar ' + src));
    im.src = src;
  });
}

type Recolor = (r: number, g: number, b: number, x: number, y: number) => [number, number, number] | null;

function recolor(im: CanvasImageSource & { width: number; height: number }, fn: Recolor | null): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = im.width;
  c.height = im.height;
  const x = c.getContext('2d')!;
  x.drawImage(im, 0, 0);
  if (!fn) return c;
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width);
    const out = fn(p[i], p[i + 1], p[i + 2], px, py);
    if (out) [p[i], p[i + 1], p[i + 2]] = out.map((v) => Math.max(0, Math.min(255, Math.round(v))));
  }
  x.putImageData(d, 0, 0);
  return c;
}

const lum = (r: number, g: number, b: number) => (r + g + b) / 3;
/** Zona del suelo en la hoja de casillas (columnas 0-5, filas 0-7) y los bloques (6-7, filas 0-2). */
const groundArea = (x: number, y: number) => {
  const tx = Math.floor(x / 18), ty = Math.floor(y / 18);
  return (tx <= 5 && ty <= 7) || ((tx === 6 || tx === 7) && ty <= 2);
};
const waterArea = (x: number, y: number) => {
  const tx = Math.floor(x / 18), ty = Math.floor(y / 18);
  return tx >= 13 && tx <= 15 && ty >= 1 && ty <= 3;
};

/** Castillo: el césped pasa a piedra, la tierra a pizarra y el agua a lava. */
const castleTiles: Recolor = (r, g, b, x, y) => {
  const L = lum(r, g, b);
  if (waterArea(x, y) && b > r) return [Math.min(255, L * 1.5 + 70), L * 0.75, L * 0.15];
  if (groundArea(x, y)) {
    if (g > r + 15 && g > b) return [L * 0.8, L * 0.74, L * 1.0];
    if (r > b + 20) return [L * 0.62, L * 0.56, L * 0.72];
  }
  return null;
};
/** Cueva: roca parda y lava. */
const caveTiles: Recolor = (r, g, b, x, y) => {
  const L = lum(r, g, b);
  if (waterArea(x, y) && b > r) return [Math.min(255, L * 1.5 + 80), L * 0.6, L * 0.1];
  if (groundArea(x, y)) {
    if (g > r + 15 && g > b) return [L * 0.85, L * 0.7, L * 0.55];
    if (r > b + 20) return [L * 0.6, L * 0.5, L * 0.42];
  }
  return null;
};
/** Bosque: hierba y tierra más oscuras; el agua, ciénaga. */
const forestTiles: Recolor = (r, g, b, x, y) => {
  if (waterArea(x, y) && b > r) return [r * 0.5 + 30, g * 0.7 + 30, b * 0.4];
  if (groundArea(x, y)) {
    if (g > r + 15 && g > b) return [r * 0.55, g * 0.7, b * 0.6 + 10];
    if (r > b + 20) return [r * 0.72, g * 0.66, b * 0.6];
  }
  return null;
};
const desertTiles: Recolor = (r, g, b, x, y) => {
  // La tierra del desierto, un poco más gris (es ceniza)
  if (groundArea(x, y) && r > b + 20) {
    const L = lum(r, g, b);
    return [r * 0.8 + L * 0.2, g * 0.8 + L * 0.2, b * 0.8 + L * 0.2];
  }
  return null;
};
/** Mar: arena verdosa y bloques azulados; el agua mala es negra. */
const seaTiles: Recolor = (r, g, b, x, y) => {
  if (waterArea(x, y) && b > r) return [r * 0.2, g * 0.25, b * 0.35];
  if (groundArea(x, y)) {
    const L = lum(r, g, b);
    if (g > r + 15 && g > b) return [L * 0.4, L * 0.9, L * 0.8];
    if (r > b + 20) return [L * 0.75, L * 0.85, L * 0.8];
  }
  return null;
};
/** Cielo: el suelo nevado pasa a nube. */
const skyTiles: Recolor = (r, g, b, x, y) => {
  if (groundArea(x, y)) {
    const L = lum(r, g, b);
    if (r > b + 20) return [L * 0.6 + 140, L * 0.6 + 150, L * 0.4 + 175];
  }
  return null;
};
const castleBg: Recolor = (r, g, b) => {
  const L = lum(r, g, b);
  return [L * 0.45, L * 0.12, L * 0.28];
};
const caveBg: Recolor = (r, g, b) => {
  const L = lum(r, g, b);
  return [L * 0.35, L * 0.25, L * 0.2];
};
const forestBg: Recolor = (r, g, b) => [r * 0.45, g * 0.6, b * 0.5];
const seaBg: Recolor = (r, g, b) => {
  const L = lum(r, g, b);
  return [L * 0.15, L * 0.4, L * 0.6];
};

export async function loadSheets(): Promise<Sheets> {
  const base = import.meta.env.BASE_URL + 'assets/';
  const [tiles, chars, dungeon, bg] = await Promise.all([
    load(base + 'tiles.png'),
    load(base + 'characters.png'),
    load(base + 'dungeon.png'),
    load(base + 'backgrounds.png'),
  ]);
  return {
    tiles: {
      pradera: recolor(tiles, null),
      bosque: recolor(tiles, forestTiles),
      desierto: recolor(tiles, desertTiles),
      mar: recolor(tiles, seaTiles),
      nieve: recolor(tiles, null),
      cueva: recolor(tiles, caveTiles),
      cielo: recolor(tiles, skyTiles),
      castillo: recolor(tiles, castleTiles),
    },
    chars,
    dungeon,
    bg: {
      pradera: recolor(bg, null),
      bosque: recolor(bg, forestBg),
      desierto: recolor(bg, null),
      mar: recolor(bg, seaBg),
      nieve: recolor(bg, null),
      cueva: recolor(bg, caveBg),
      cielo: recolor(bg, null),
      castillo: recolor(bg, castleBg),
    },
  };
}

// ── Sprites tintados (con caché) ──
function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}

const frameCache = new Map<string, HTMLCanvasElement>();

/** Fotograma de un sprite como lienzo propio (recortado de la hoja y tintado si hace falta). */
export function spriteFrame(sh: Sheets, ref: SpriteRef, i: number): HTMLCanvasElement {
  const f = ref.frames[i % ref.frames.length];
  const k = `${ref.sheet}:${String(f)}:${ref.tint ?? ''}`;
  const hit = frameCache.get(k);
  if (hit) return hit;
  let src: HTMLCanvasElement;
  if (typeof f === 'string') src = artFrame(f);
  else {
    const size = ref.sheet === 'chars' ? 24 : 16;
    src = document.createElement('canvas');
    src.width = src.height = size;
    src.getContext('2d')!.drawImage(ref.sheet === 'chars' ? sh.chars : sh.dungeon, f[0] * size, f[1] * size, size, size, 0, 0, size, size);
  }
  let out = src;
  if (ref.tint) {
    const [dh, sm, lm] = ref.tint;
    out = recolor(src, (r, g, b) => {
      if (r < 60 && g < 50 && b < 70) return null; // el contorno no cambia
      const [h, s, l] = rgb2hsl(r, g, b);
      return hsl2rgb(h + dh, Math.min(1, s * sm), Math.min(1, l * lm));
    });
  }
  frameCache.set(k, out);
  return out;
}
