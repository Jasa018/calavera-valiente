// Dibuja el mapamundi y la pantalla de título.
import { LEVELS, type Theme } from '../data/worlds';
import { stats } from '../game/progress';
import { VIEW_H, VIEW_W } from '../game/types';
import { nodeDone, passable, type WorldMap } from '../game/worldmap';
import { art } from './art';
import { bar, FONT, LOOK, outlined } from './render';
import type { Sheets } from './sheets';

const M = 18; // casilla del mapa
const OX = 6;
const OY = 0;

const GROUND: Record<Theme, [string, string]> = {
  pradera: ['#5cb84a', '#4ea63e'],
  desierto: ['#e6b46a', '#d9a65c'],
  nieve: ['#e8f2fa', '#d6e6f2'],
  castillo: ['#3a2a40', '#30223a'],
};

export function drawMap(c: CanvasRenderingContext2D, sh: Sheets, wm: WorldMap, frame: number) {
  const w = wm.world;
  const theme = w.theme;
  const tl = sh.tiles[theme];
  const [g1, g2] = GROUND[theme];
  c.fillStyle = g1;
  c.fillRect(0, 0, VIEW_W, VIEW_H);
  // Textura a cuadros suaves
  c.fillStyle = g2;
  for (let y = 0; y < 15; y++) for (let x = 0; x < 27; x++) if ((x * 7 + y * 13) % 5 === 0) c.fillRect(OX + x * M + 4, OY + y * M + 6, 3, 2);
  if (theme === 'castillo') {
    // Charcos de lava
    for (const [x, y] of [[4, 6], [16, 7], [22, 11]]) {
      c.fillStyle = '#ff7020';
      c.fillRect(OX + x * M, OY + y * M + 4, 30, 12);
      c.fillStyle = '#ffc040';
      c.fillRect(OX + x * M + 4 + (frame >> 4) % 10, OY + y * M + 8, 6, 2);
    }
  }
  const at = (x: number, y: number) => [OX + x * M, OY + y * M] as const;

  // Caminos
  for (const [a, b] of w.edges) {
    const na = w.nodes.find((n) => n.id === a)!, nb = w.nodes.find((n) => n.id === b)!;
    const open = passable(wm.save, w, na) || passable(wm.save, w, nb);
    const steps = Math.abs(nb.x - na.x) + Math.abs(nb.y - na.y);
    for (let i = 0; i <= steps * 2; i++) {
      const k = i / (steps * 2);
      const [px, py] = at(na.x + (nb.x - na.x) * k, na.y + (nb.y - na.y) * k);
      c.fillStyle = theme === 'castillo' ? '#6a5878' : theme === 'nieve' ? '#a8bccc' : '#c08850';
      c.fillRect(px + 5, py + 6, 8, 6);
      if (!open && i % 2 === 1) {
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(px + 5, py + 6, 8, 6);
      }
    }
  }
  // Árboles y adornos
  const look = LOOK[theme];
  for (const [i, [x, y]] of w.trees.entries()) {
    const d = look.deco[(i * 3) % look.deco.length];
    const [px, py] = at(x, y);
    if (theme === 'pradera' || theme === 'nieve') c.drawImage(tl, 6 * 18, 6 * 18, 18, 18, px, py, 18, 18);
    else if (d.sheet === 'tiles') c.drawImage(tl, d.c * 18, d.r * 18, 18, 18, px, py, 18, 18);
    else c.drawImage(sh.dungeon, d.c * 16, d.r * 16, 16, 16, px + 1, py + 1, 16, 16);
  }
  // Nodos
  c.font = FONT;
  for (const n of w.nodes) {
    const [px, py] = at(n.x, n.y);
    const done = nodeDone(wm.save, n);
    switch (n.kind) {
      case 'nivel':
        c.drawImage(tl, (done ? 9 : 10) * 18, (done ? 1 : 0) * 18, 18, 18, px, py, 18, 18);
        if (done) {
          c.drawImage(tl, 11 * 18, 5 * 18, 18, 18, px + 8, py - 12, 18, 18);
        } else {
          c.font = '6px "Press Start 2P", monospace';
          outlined(c, n.label.split('-')[1], px + 9, py + 12, '#fff', 'center');
          c.font = FONT;
        }
        break;
      case 'castillo': {
        const img = art().castle;
        c.drawImage(img, px - 0, py - 4);
        if (done) c.drawImage(tl, 11 * 18, 5 * 18, 18, 18, px + 10, py - 16, 18, 18);
        break;
      }
      case 'tienda':
        c.drawImage(sh.dungeon, 6 * 16, 7 * 16, 16, 16, px + 1, py + 1, 16, 16);
        break;
      case 'inicio':
        c.drawImage(sh.dungeon, 5 * 16, 5 * 16, 16, 16, px + 1, py + 1, 16, 16);
        break;
      case 'volver':
        c.drawImage(tl, 7 * 18, 4 * 18, 18, 18, px, py, 18, 18);
        break;
      case 'salida':
        c.globalAlpha = passable(wm.save, w, n) ? 1 : 0.45;
        c.drawImage(tl, 8 * 18, 4 * 18, 18, 18, px, py, 18, 18);
        c.globalAlpha = 1;
        break;
    }
  }
  // Osmo
  const p = wm.pos();
  const [hx, hy] = at(p.x, p.y);
  const bob = wm.move ? Math.abs(Math.sin(frame * 0.4)) * 3 : Math.floor(frame / 30) % 2;
  const img = art().skullMap;
  c.save();
  c.translate(Math.round(hx + 3 + (wm.face < 0 ? 12 : 0)), Math.round(hy - 6 - bob));
  if (wm.face < 0) c.scale(-1, 1);
  c.drawImage(img, 0, 0);
  c.restore();

  // Panel inferior
  const st = stats(wm.save);
  c.fillStyle = 'rgba(20,12,28,0.85)';
  c.fillRect(0, VIEW_H - 40, VIEW_W, 40);
  c.fillStyle = '#6b6080';
  c.fillRect(0, VIEW_H - 40, VIEW_W, 1);
  c.font = FONT;
  const n = wm.move ? null : wm.node;
  outlined(c, `Mundo ${wm.worldIndex + 1}: ${w.name}`, 8, VIEW_H - 27, '#f2c94c', 'left');
  let label = '';
  if (n) {
    if (n.level) {
      const lv = LEVELS[n.level].def;
      label = `${n.level} ${lv.name}${nodeDone(wm.save, n) ? ' ✓' : ''}`;
    } else label = n.label;
  }
  outlined(c, label, 8, VIEW_H - 12, '#fff', 'left');
  outlined(c, `Nv${wm.save.level}`, VIEW_W - 140, VIEW_H - 27, '#f2c94c', 'left');
  bar(c, VIEW_W - 100, VIEW_H - 33, 90, 5, 1, '#e04848', '#5a1a24');
  c.font = '6px "Press Start 2P", monospace';
  outlined(c, `PV ${st.maxHp}  ATQ ${st.atk}  DEF ${st.def}`, VIEW_W - 8, VIEW_H - 20, '#c9c2d9', 'right');
  c.drawImage(sh.tiles.pradera, 11 * 18, 7 * 18, 18, 18, VIEW_W - 196, VIEW_H - 39, 18, 18);
  outlined(c, String(wm.save.coins), VIEW_W - 178, VIEW_H - 27, '#f2c94c', 'left');
  outlined(c, 'Enter entrar · Esc menú', VIEW_W - 8, VIEW_H - 8, '#8a80a0', 'right');
}

export function drawTitle(c: CanvasRenderingContext2D, sh: Sheets, frame: number) {
  const look = LOOK.castillo;
  const g = c.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, look.sky[0]);
  g.addColorStop(1, look.sky[1]);
  c.fillStyle = g;
  c.fillRect(0, 0, VIEW_W, VIEW_H);
  c.fillStyle = '#ffe9b0';
  for (let i = 0; i < 60; i++) c.fillRect((i * 97) % VIEW_W, (i * 53) % 150, 1, 1);
  c.fillStyle = '#ffd0a0';
  c.beginPath();
  c.arc(400, 46, 20, 0, Math.PI * 2);
  c.fill();
  const bg = sh.bg.castillo;
  for (let x = 0; x < VIEW_W; x += 24) c.drawImage(bg, (6 + ((x / 24) % 2)) * 24, 24, 24, 24, x, 170, 24, 24);
  c.drawImage(bg, 6 * 24, 48, 24, 24, 0, 194, VIEW_W, 76);
  // Suelo con tumbas
  const tl = sh.tiles.castillo;
  for (let x = 0; x < VIEW_W; x += 18) c.drawImage(tl, 2 * 18, 0, 18, 18, x, 234, 18, 18);
  for (let x = 0; x < VIEW_W; x += 18) c.drawImage(tl, 2 * 18, 6 * 18, 18, 18, x, 252, 18, 18);
  for (const x of [40, 120, 330, 420]) c.drawImage(sh.dungeon, 5 * 16, 5 * 16, 16, 16, x, 218, 16, 16);
  // Osmo grande
  const hero = art().hero;
  const img = hero.idle[Math.floor(frame / 30) % 2];
  c.drawImage(img, 0, 0, 24, 24, 214, 162, 48, 48);
  c.font = '16px "Press Start 2P", monospace';
  outlined(c, 'CALAVERA', VIEW_W / 2, 64, '#f4efe1', 'center');
  outlined(c, 'VALIENTE', VIEW_W / 2, 88, '#f2c94c', 'center');
  c.font = '6px "Press Start 2P", monospace';
  outlined(c, 'Un esqueleto contra el Rey Diablo', VIEW_W / 2, 106, '#c9c2d9', 'center');
}
