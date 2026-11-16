// Carga de las hojas de sprites (Kenney, CC0) y versiones recoloreadas por mundo.
import type { Theme } from '../data/worlds';

export interface Sheets {
  tiles: Record<Theme, HTMLCanvasElement>;
  chars: HTMLImageElement;
  dungeon: HTMLImageElement;
  bg: Record<Theme, HTMLCanvasElement>;
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

function recolor(im: HTMLImageElement, fn: Recolor | null): HTMLCanvasElement {
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

/** Castillo: el césped pasa a piedra, la tierra a pizarra y el agua a lava. */
const castleTiles: Recolor = (r, g, b, x, y) => {
  const tx = Math.floor(x / 18), ty = Math.floor(y / 18);
  const L = lum(r, g, b);
  if (tx >= 13 && tx <= 15 && ty >= 1 && ty <= 3 && b > r) return [Math.min(255, L * 1.5 + 70), L * 0.75, L * 0.15];
  if ((tx <= 5 && ty <= 7) || ((tx === 6 || tx === 7) && ty <= 2)) {
    if (g > r + 15 && g > b) return [L * 0.8, L * 0.74, L * 1.0];
    if (r > b + 20) return [L * 0.62, L * 0.56, L * 0.72];
  }
  return null;
};
/** Fondo del castillo: colinas verdes → siluetas granates. */
const castleBg: Recolor = (r, g, b) => {
  const L = lum(r, g, b);
  return [L * 0.45, L * 0.12, L * 0.28];
};
const desertTiles: Recolor = (r, g, b, x, y) => {
  // La tierra del desierto, un poco más gris (es ceniza)
  const tx = Math.floor(x / 18), ty = Math.floor(y / 18);
  if (tx <= 5 && ty <= 7 && r > b + 20) {
    const L = lum(r, g, b);
    return [r * 0.8 + L * 0.2, g * 0.8 + L * 0.2, b * 0.8 + L * 0.2];
  }
  return null;
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
      desierto: recolor(tiles, desertTiles),
      nieve: recolor(tiles, null),
      castillo: recolor(tiles, castleTiles),
    },
    chars,
    dungeon,
    bg: {
      pradera: recolor(bg, null),
      desierto: recolor(bg, null),
      nieve: recolor(bg, null),
      castillo: recolor(bg, castleBg),
    },
  };
}
