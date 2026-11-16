// Dibuja un nivel: fondo, casillas, personajes, efectos y HUD.
import { ITEMS } from '../data/items';
import { SKILL } from '../data/skills';
import type { Look } from '../data/worlds';
import { stats, xpToNext } from '../game/progress';
import type { Enemy, Stage } from '../game/stage';
import { type GameEvent, TILE as T, VIEW_H, VIEW_W } from '../game/types';
import { art } from './art';
import { spriteFrame, type Sheets } from './sheets';

export const FONT = '8px "Press Start 2P", monospace';
export const SMALL = '6px "Press Start 2P", monospace';

interface ThemeLook {
  groundRow: number;
  sky: [string, string];
  bgCol: number;
  bgY: number;
  block: [number, number];
  deco: { sheet: 'tiles' | 'dungeon'; c: number; r: number }[];
  /** Nubes en el cielo. */
  clouds: boolean;
  stars?: boolean;
}

export const LOOK: Record<Look, ThemeLook> = {
  pradera: {
    groundRow: 0, sky: ['#6fc3f0', '#c4ecff'], bgCol: 6, bgY: 150, block: [6, 1], clouds: true,
    deco: [{ sheet: 'tiles', c: 4, r: 6 }, { sheet: 'tiles', c: 5, r: 6 }, { sheet: 'dungeon', c: 5, r: 5 }, { sheet: 'tiles', c: 8, r: 6 }, { sheet: 'dungeon', c: 4, r: 5 }],
  },
  bosque: {
    groundRow: 0, sky: ['#2f5a48', '#8fc0a0'], bgCol: 6, bgY: 120, block: [6, 1], clouds: false,
    deco: [{ sheet: 'tiles', c: 4, r: 6 }, { sheet: 'tiles', c: 8, r: 6 }, { sheet: 'tiles', c: 6, r: 6 }, { sheet: 'tiles', c: 5, r: 6 }, { sheet: 'tiles', c: 8, r: 6 }],
  },
  desierto: {
    groundRow: 2, sky: ['#f0a060', '#ffe0a8'], bgCol: 4, bgY: 150, block: [6, 1], clouds: true,
    deco: [{ sheet: 'tiles', c: 7, r: 6 }, { sheet: 'tiles', c: 7, r: 6 }, { sheet: 'dungeon', c: 5, r: 5 }, { sheet: 'tiles', c: 6, r: 4 }, { sheet: 'tiles', c: 4, r: 6 }],
  },
  mar: {
    groundRow: 2, sky: ['#0d3a5c', '#1f7aa0'], bgCol: 0, bgY: 160, block: [7, 2], clouds: false,
    deco: [{ sheet: 'tiles', c: 4, r: 6 }, { sheet: 'tiles', c: 5, r: 6 }, { sheet: 'tiles', c: 4, r: 6 }, { sheet: 'tiles', c: 5, r: 6 }, { sheet: 'tiles', c: 5, r: 6 }],
  },
  nieve: {
    groundRow: 4, sky: ['#8fb8e0', '#eaf6ff'], bgCol: 0, bgY: 150, block: [7, 2], clouds: false,
    deco: [{ sheet: 'tiles', c: 4, r: 7 }, { sheet: 'tiles', c: 5, r: 7 }, { sheet: 'tiles', c: 6, r: 6 }, { sheet: 'tiles', c: 4, r: 7 }, { sheet: 'tiles', c: 6, r: 6 }],
  },
  cueva: {
    groundRow: 0, sky: ['#1a1014', '#3a2420'], bgCol: 6, bgY: 140, block: [7, 2], clouds: false,
    deco: [{ sheet: 'dungeon', c: 5, r: 5 }, { sheet: 'dungeon', c: 0, r: 2 }, { sheet: 'tiles', c: 8, r: 6 }, { sheet: 'dungeon', c: 4, r: 5 }, { sheet: 'dungeon', c: 6, r: 3 }],
  },
  cielo: {
    groundRow: 4, sky: ['#5aa8f0', '#f0f8ff'], bgCol: 0, bgY: 200, block: [7, 2], clouds: true,
    deco: [{ sheet: 'tiles', c: 4, r: 6 }, { sheet: 'tiles', c: 5, r: 6 }, { sheet: 'tiles', c: 4, r: 6 }, { sheet: 'tiles', c: 8, r: 6 }, { sheet: 'tiles', c: 5, r: 6 }],
  },
  castillo: {
    groundRow: 0, sky: ['#1a0a1e', '#4a1430'], bgCol: 6, bgY: 150, block: [7, 2], clouds: false, stars: true,
    deco: [{ sheet: 'dungeon', c: 5, r: 2 }, { sheet: 'dungeon', c: 5, r: 5 }, { sheet: 'dungeon', c: 4, r: 5 }, { sheet: 'dungeon', c: 5, r: 2 }, { sheet: 'dungeon', c: 6, r: 0 }],
  },
};

interface Float {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  t: number;
}

const SPELL_ICON: Record<string, () => HTMLCanvasElement> = {
  hueso: () => art().bone,
  fuego: () => art().fire[0],
  hielo: () => art().ice,
  rayo: () => art().bolt,
  tierra: () => art().spike,
  luz: () => art().holy,
};

export class StageView {
  floats: Float[] = [];
  parts: Part[] = [];
  bolts: { x: number; y0: number; y1: number; t: number }[] = [];
  rings: { x: number; y: number; r: number; color: string; t: number }[] = [];
  banner: { lines: string[]; t: number; color: string } | null = null;
  intro = 150;
  fade = 0;
  dark: HTMLCanvasElement | null = null;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private sh: Sheets,
  ) {}

  handle(e: GameEvent) {
    if (e.t === 'float') this.floats.push({ x: e.x, y: e.y, text: e.text, color: e.color, t: 50 });
    else if (e.t === 'parts')
      for (let i = 0; i < e.n; i++)
        this.parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3 - 0.5, color: e.color, t: 25 + Math.random() * 20 });
    else if (e.t === 'levelup')
      this.banner = { lines: [`¡NIVEL ${e.level}!`, ...e.skills.map((s) => `Nueva habilidad: ${s}`)], t: e.skills.length ? 240 : 140, color: '#f2c94c' };
    else if (e.t === 'boss') this.banner = { lines: [e.name], t: 120, color: '#ff7050' };
    else if (e.t === 'banner') this.banner = { lines: [e.text], t: 150, color: e.color };
    else if (e.t === 'bolt') this.bolts.push({ ...e, t: 14 });
    else if (e.t === 'ring') this.rings.push({ x: e.x, y: e.y, r: e.r, color: e.color, t: 20 });
    else if (e.t === 'door') this.fade = 20;
  }

  draw(st: Stage) {
    const c = this.ctx;
    const look = LOOK[st.def.look];
    let camX = Math.round(st.camX);
    let camY = Math.round(st.camY);
    if (st.shake > 0) {
      camX += Math.round((Math.random() - 0.5) * Math.min(6, st.shake));
      camY += Math.round((Math.random() - 0.5) * Math.min(6, st.shake));
    }
    this.background(st, camX, camY);
    c.save();
    c.translate(-camX, -camY);
    this.tiles(st, camX, camY, look);
    // Plataformas móviles
    const tl = this.sh.tiles[st.def.look];
    for (const p of st.plats) for (let i = 0; i < 3; i++) c.drawImage(tl, (i === 0 ? 8 : i === 2 ? 10 : 9) * 18, 2 * 18, 18, 9, Math.round(p.x + i * T), Math.round(p.y), 18, 9);
    // Barras de fuego
    const fire = art().fire;
    for (const b of st.bars)
      for (let k = 1; k <= b.n; k++) {
        const img = fire[(Math.floor(st.frame / 6) + k) % 2];
        c.drawImage(img, Math.round(b.x + Math.cos(b.ang) * k * 8 - 4), Math.round(b.y + Math.sin(b.ang) * k * 8 - 4));
      }
    // Recogibles
    for (const k of st.pickups) c.drawImage(tl, 4 * 18, 2 * 18, 18, 18, Math.round(k.x - 3), Math.round(k.y - 4), 18, 18);
    for (const q of st.pops) c.drawImage(tl, 11 * 18, 7 * 18, 18, 18, Math.round(q.x - 9), Math.round(q.y - 9), 18, 18);
    for (const e of st.enemies) this.enemy(e, st);
    this.player(st);
    this.projs(st);
    // Lava que sube
    if (st.lavaY < Infinity) {
      const y = Math.round(st.lavaY);
      c.fillStyle = '#ff6a20';
      c.fillRect(camX - 10, y, VIEW_W + 20, camY + VIEW_H - y + 10);
      c.fillStyle = '#ffc040';
      for (let x = camX - (camX % 24) - 24; x < camX + VIEW_W + 24; x += 24) c.fillRect(x + ((st.frame >> 2) % 24), y, 10, 3);
      c.fillStyle = '#c03010';
      c.fillRect(camX - 10, y + 8, VIEW_W + 20, 2);
    }
    this.effects();
    c.restore();
    if (st.def.water) this.underwater(st);
    if (st.def.dark) this.darkness(st, camX, camY);
    if (st.wind) this.windLines(st);
    if (st.rainT > 0) {
      c.fillStyle = `rgba(80,0,120,${(st.rainT / 50) * 0.25})`;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (this.fade > 0) {
      c.fillStyle = `rgba(10,6,16,${this.fade / 20})`;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      this.fade--;
    }
    this.hud(st);
  }

  background(st: Stage, camX: number, camY: number) {
    const c = this.ctx;
    const lk = st.def.look;
    const look = LOOK[lk];
    const g = c.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, look.sky[0]);
    g.addColorStop(1, look.sky[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    const wrap = (v: number, m: number) => ((v % m) + m) % m;
    if (look.stars) {
      c.fillStyle = '#ffe9b0';
      for (let i = 0; i < 40; i++) c.fillRect(wrap(i * 97 - camX * 0.05, VIEW_W), (i * 53) % 120, 1, 1);
      c.fillStyle = '#ffd0a0';
      c.beginPath();
      c.arc(380, 50, 18, 0, Math.PI * 2);
      c.fill();
    } else if (look.clouds) {
      c.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 6; i++) {
        const x = wrap(i * 130 - camX * 0.15, 620) - 70;
        const y = 24 + ((i * 37) % 60) - camY * 0.05;
        c.fillRect(x, y, 44, 8);
        c.fillRect(x + 8, y - 6, 26, 6);
      }
    }
    if (lk === 'cueva') {
      // Estalactitas lejanas
      c.fillStyle = '#2a1a18';
      for (let i = 0; i < 14; i++) {
        const x = wrap(i * 61 - camX * 0.2, VIEW_W + 40) - 20;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + 12, 0);
        c.lineTo(x + 6, 18 + (i % 4) * 10);
        c.fill();
      }
    }
    if (lk === 'mar') {
      // Rayos de luz
      c.fillStyle = 'rgba(160,220,255,0.06)';
      for (let i = 0; i < 5; i++) {
        const x = wrap(i * 120 - camX * 0.1, VIEW_W + 100) - 50;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + 30, 0);
        c.lineTo(x + 80, VIEW_H);
        c.lineTo(x + 40, VIEW_H);
        c.fill();
      }
    }
    const bg = this.sh.bg[lk];
    const y = look.bgY + Math.max(0, st.region.y1 * T - VIEW_H - camY) * 0.15;
    const off = -wrap(camX * 0.25, 48);
    for (let x = off - 48; x < VIEW_W + 48; x += 24) {
      const col = look.bgCol + (Math.floor((x - off) / 24 + 100) % 2);
      c.drawImage(bg, col * 24, 24, 24, 24, Math.round(x), Math.round(y), 24, 24);
    }
    c.drawImage(bg, look.bgCol * 24, 48, 24, 24, 0, Math.round(y + 24), VIEW_W, Math.max(0, VIEW_H - y - 24));
  }

  tiles(st: Stage, camX: number, camY: number, look: ThemeLook) {
    const c = this.ctx;
    const lk = st.def.look;
    const tl = this.sh.tiles[lk];
    const x0 = Math.max(0, Math.floor(camX / T) - 1);
    const x1 = Math.min(st.w - 1, Math.ceil((camX + VIEW_W) / T) + 1);
    const y0 = Math.max(0, Math.floor(camY / T) - 1);
    const y1 = Math.min(st.h - 1, Math.ceil((camY + VIEW_H) / T) + 1);
    const draw = (col: number, row: number, x: number, y: number) => c.drawImage(tl, col * 18, row * 18, 18, 18, x * T, y * T, 18, 18);
    const groundish = (x: number, y: number) => {
      const ch = st.tile(x, y);
      return ch === '#' || (ch === 'Y' && st.tile(x, y + 1) === '#');
    };
    // Adornos detrás
    for (const d of st.lvl.deco) {
      if (d.tx < x0 || d.tx > x1 || d.ty < y0 || d.ty > y1) continue;
      const dc = look.deco[d.v % look.deco.length];
      if (dc.sheet === 'tiles') draw(dc.c, dc.r, d.tx, d.ty);
      else c.drawImage(this.sh.dungeon, dc.c * 16, dc.r * 16, 16, 16, d.tx * T + 1, d.ty * T + 2, 16, 16);
    }
    const frame = Math.floor(st.frame / 12);
    const fire = art().fire;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ch = st.grid[y][x];
        switch (ch) {
          case '#': {
            const top = !groundish(x, y - 1) && y > 0;
            const bot = y < st.h - 1 && !groundish(x, y + 1);
            const l = !groundish(x - 1, y) && x > 0;
            const r = !groundish(x + 1, y) && x < st.w - 1;
            const col = l && r ? 0 : l ? 1 : r ? 3 : 2;
            if (top) draw(col, look.groundRow + (bot ? 0 : 1), x, y);
            else draw(col, bot ? 7 : 6, x, y);
            if (top && st.def.type === 'carro') {
              // Raíles sobre el suelo
              c.fillStyle = '#5a4a40';
              c.fillRect(x * T, y * T - 3, 18, 2);
              c.fillStyle = '#8a7a70';
              c.fillRect(x * T + 4, y * T - 4, 3, 4);
              c.fillRect(x * T + 12, y * T - 4, 3, 4);
            }
            break;
          }
          case 'X':
            draw(look.block[0], look.block[1], x, y);
            break;
          case 'Y': {
            // Muro falso: igual que lo de alrededor, translúcido si ya se descubrió
            const seen = st.revealed.has(`${x},${y}`);
            if (seen) c.globalAlpha = 0.35;
            if (st.tile(x, y + 1) === '#' || st.tile(x, y - 1) === '#') draw(2, 6, x, y);
            else draw(look.block[0], look.block[1], x, y);
            c.globalAlpha = 1;
            break;
          }
          case 'I':
            c.fillStyle = '#bfe8ff';
            c.fillRect(x * T, y * T, 18, 18);
            c.fillStyle = '#e8f8ff';
            c.fillRect(x * T, y * T, 18, 3);
            c.fillRect(x * T + 3, y * T + 6, 3, 3);
            c.fillStyle = '#7ab8e0';
            c.fillRect(x * T, y * T + 15, 18, 3);
            break;
          case 'B':
            draw(6, 0, x, y);
            break;
          case 'R': {
            draw(look.block[0], look.block[1], x, y);
            const hits = st.cracks.get(`${x},${y}`) ?? 0;
            c.strokeStyle = '#2b1f33';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(x * T + 4, y * T + 2);
            c.lineTo(x * T + 8, y * T + 8);
            c.lineTo(x * T + 5, y * T + 13);
            c.moveTo(x * T + 8, y * T + 8);
            c.lineTo(x * T + 14, y * T + 10);
            if (hits >= 1) {
              c.moveTo(x * T + 12, y * T + 2);
              c.lineTo(x * T + 10, y * T + 6);
              c.moveTo(x * T + 5, y * T + 13);
              c.lineTo(x * T + 9, y * T + 17);
            }
            if (hits >= 2) {
              c.moveTo(x * T + 2, y * T + 9);
              c.lineTo(x * T + 7, y * T + 10);
              c.moveTo(x * T + 14, y * T + 10);
              c.lineTo(x * T + 16, y * T + 16);
            }
            c.stroke();
            break;
          }
          case '?':
          case 'Q':
            draw(10, 0, x, y);
            if (frame % 4 === 0) {
              c.fillStyle = 'rgba(255,255,255,0.25)';
              c.fillRect(x * T + 2, y * T + 2, 14, 14);
            }
            break;
          case 'U':
            draw(9, 1, x, y);
            break;
          case 'L':
            draw(8, 1, x, y);
            break;
          case 'k':
            c.drawImage(art().key, x * T + 1, y * T + 5 + Math.round(Math.sin(st.frame / 10) * 2));
            break;
          case 'l':
            draw(st.switchOn ? 6 : 4, 3, x, y);
            break;
          case 'E':
          case 'F': {
            const solid = ch === 'E' ? !st.switchOn : st.switchOn;
            const col = ch === 'E' ? ['#d84848', '#8f1f2b', '#ff9090'] : ['#4878d8', '#22407a', '#90b8ff'];
            if (solid) {
              c.fillStyle = col[1];
              c.fillRect(x * T, y * T, 18, 18);
              c.fillStyle = col[0];
              c.fillRect(x * T + 1, y * T + 1, 16, 16);
              c.fillStyle = col[2];
              c.fillRect(x * T + 2, y * T + 2, 14, 2);
              c.fillStyle = col[1];
              c.fillRect(x * T + 7, y * T + 7, 4, 4);
            } else {
              c.strokeStyle = col[0];
              c.setLineDash([3, 3]);
              c.strokeRect(x * T + 1.5, y * T + 1.5, 15, 15);
              c.setLineDash([]);
            }
            break;
          }
          case '-': {
            const l = st.tile(x - 1, y) === '-', r = st.tile(x + 1, y) === '-';
            draw(!l ? 8 : !r ? 10 : 9, 2, x, y);
            break;
          }
          case 'V': {
            const k = st.crumbling.get(`${x},${y}`);
            const sx = k !== undefined ? Math.round(Math.sin(st.frame * 1.5) * 1.5) : 0;
            c.drawImage(tl, 9 * 18, 2 * 18, 18, 18, x * T + sx, y * T, 18, 18);
            c.fillStyle = 'rgba(60,30,10,0.35)';
            c.fillRect(x * T + sx, y * T, 18, 6);
            c.fillStyle = '#2b1f33';
            c.fillRect(x * T + sx + 8, y * T + 1, 1, 4);
            break;
          }
          case '=':
            c.fillStyle = '#5a4a40';
            c.fillRect(x * T, y * T + 2, 18, 4);
            c.fillStyle = '#8a7a70';
            c.fillRect(x * T, y * T, 18, 2);
            c.fillStyle = '#4a3018';
            c.fillRect(x * T + 3, y * T + 6, 3, 6);
            c.fillRect(x * T + 12, y * T + 6, 3, 6);
            break;
          case 'C': {
            const l = st.tile(x - 1, y) === 'C', r = st.tile(x + 1, y) === 'C';
            c.drawImage(this.sh.tiles.pradera, (!l ? 13 : !r ? 15 : 14) * 18, 7 * 18, 18, 18, x * T, y * T - 2, 18, 18);
            break;
          }
          case 'v':
            draw(st.tile(x - 1, y) !== 'v' ? 16 : st.tile(x + 1, y) !== 'v' ? 19 : 17, 3, x, y);
            break;
          case 'T':
            draw(16, 5, x, y);
            break;
          case 't': {
            c.fillStyle = '#5a3a20';
            c.fillRect(x * T + 8, y * T + 8, 3, 10);
            c.drawImage(fire[Math.floor(st.frame / 8) % 2], x * T + 5, y * T);
            break;
          }
          case 'O':
            draw(9, 0, x, y);
            break;
          case 'A': {
            c.fillStyle = '#2b1f33';
            c.fillRect(x * T, y * T + 2, 18, 16);
            c.fillStyle = '#4a4258';
            c.fillRect(x * T + 1, y * T + 3, 16, 14);
            c.fillStyle = '#7d7488';
            c.fillRect(x * T + 3, y * T + 5, 12, 3);
            c.fillStyle = '#140c1c';
            c.fillRect(x * T, y * T + 7, 3, 6);
            c.fillRect(x * T + 15, y * T + 7, 3, 6);
            break;
          }
          case '^':
            if (lk === 'desierto') draw(7, 6, x, y);
            else draw(8, 3, x, y);
            break;
          case '~':
            draw(13, st.tile(x, y - 1) === '~' ? 2 : 1, x, y);
            break;
          case 'S':
            draw(st.springs.has(`${x},${y}`) ? 7 : 8, 5, x, y);
            break;
          case 'o':
            draw(frame % 4 === 3 ? 12 : 11, 7, x, y);
            break;
          case 'g':
            draw(7, 3, x, y);
            break;
          case 'h':
            draw(4, 2, x, y);
            break;
          case 'K': {
            const up = st.flags.has(`${x},${y}`);
            draw(11, 6, x, y);
            draw(11, 6, x, y - 1);
            if (up) draw(frame % 2 ? 12 : 11, 5, x, y - 1);
            else {
              c.globalAlpha = 0.5;
              draw(11, 5, x, y);
              c.globalAlpha = 1;
            }
            break;
          }
          case 'G':
            draw(10, 6, x, y - 1);
            draw(10, 7, x, y);
            break;
          case 'H':
            // Puerta secreta: piedra con brillo morado
            c.drawImage(this.sh.dungeon, 10 * 16, 3 * 16, 16, 16, x * T + 1, y * T + 2, 16, 16);
            c.drawImage(this.sh.dungeon, 10 * 16, 2 * 16, 16, 16, x * T + 1, y * T - 14, 16, 16);
            c.fillStyle = `rgba(200,140,255,${0.25 + 0.15 * Math.sin(st.frame / 8)})`;
            c.fillRect(x * T + 1, y * T - 14, 16, 32);
            break;
          case 'D':
            c.drawImage(this.sh.dungeon, 9 * 16, 3 * 16, 16, 16, x * T + 1, y * T + 2, 16, 16);
            c.drawImage(this.sh.dungeon, 9 * 16, 2 * 16, 16, 16, x * T + 1, y * T - 14, 16, 16);
            break;
          case 'W':
            if (st.gateClosed) draw(7, 2, x, y);
            break;
        }
      }
    }
    // Pista de las puertas
    const p = st.player;
    const door = st.lvl.doors.get(`${Math.floor((p.x + p.w / 2) / T)},${Math.floor((p.y + p.h - 2) / T)}`);
    if (door && p.ground) {
      c.font = SMALL;
      outlined(c, '↑', Math.round(p.x + p.w / 2), Math.round(p.y - 8 + Math.sin(st.frame / 6) * 2), '#fff', 'center');
    }
  }

  enemy(e: Enemy, st: Stage) {
    const c = this.ctx;
    const ref = e.def.sprite;
    let frame = Math.floor(e.t / 10);
    const b = e.def.behavior;
    if (b === 'thwomp' || e.def.id === 'bloque_titan') frame = e.state === 'wait' || e.state === 'idle' || e.state === 'rise' ? 0 : 1;
    if (b === 'puffer') frame = e.state === 'puff' ? 1 : 0;
    if (e.frozen > 0) frame = 0;
    const img = spriteFrame(this.sh, ref, frame);
    const sc = ref.scale ?? 1;
    const w = img.width * sc, h = img.height * sc;
    if (b === 'burrower' && e.hidden) {
      // Montículo de tierra que se mueve
      c.fillStyle = '#7a5530';
      const bw = Math.min(e.w + 6, 30);
      c.fillRect(Math.round(e.x + e.w / 2 - bw / 2), Math.round(e.y + e.h - 4), bw, 4);
      c.fillStyle = '#b07a48';
      c.fillRect(Math.round(e.x + e.w / 2 - bw / 2 + 3), Math.round(e.y + e.h - 6), bw - 6, 2);
      return;
    }
    let alpha = 1;
    if (e.dead) alpha = Math.max(0, e.deadT / (e.boss ? 120 : 24));
    if (b === 'ghost') alpha *= 0.8;
    if (e.state === 'tele' && e.timer < 20) alpha *= 1 - e.timer / 20;
    if (e.state === 'intro') alpha *= 1 - e.timer / 70;
    if (b === 'burrower' && e.state === 'dig') alpha *= e.timer / 24;
    // Animación sencilla para los dibujos de un solo fotograma
    let bob = 0;
    if (ref.sheet === 'art' && ref.frames.length === 1 && e.frozen <= 0 && !e.dead) {
      if (b === 'flyer' || b === 'swimmer' || b === 'jelly' || b === 'cloud' || b === 'puffer') bob = Math.round(Math.sin(e.t * 0.15) * 1.5);
      else if (Math.abs(e.vx) > 0.1 || e.boss) bob = Math.floor(e.t / 8) % 2;
    }
    const x = e.x + e.w / 2 - w / 2;
    const y = e.y + e.h - h + (ref.sheet === 'chars' && !ref.scale ? 3 : 0) + (e.boss && ref.sheet === 'chars' ? 6 : 0) + bob;
    const winding = e.state === 'wind' || (e.state === 'carga' && e.timer < 30) || e.state === 'shake';
    const shakeX = winding ? Math.round(Math.sin(st.frame) * 1.5) : 0;
    const flip = e.face > 0 === !ref.facesLeft ? false : true;
    c.save();
    c.globalAlpha = alpha;
    c.translate(Math.round(x + shakeX), Math.round(y));
    if (flip) {
      c.scale(-1, 1);
      c.translate(-w, 0);
    }
    c.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
    if ((e.flash > 0 && e.flash % 4 < 2) || e.frozen > 0) {
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = e.frozen > 0 ? 'rgba(150,220,255,0.6)' : 'rgba(255,255,255,0.75)';
      c.fillRect(0, 0, w, h);
    }
    c.restore();
    if (e.frozen > 0) {
      c.strokeStyle = 'rgba(220,250,255,0.9)';
      c.strokeRect(Math.round(e.x) - 1.5, Math.round(e.y) - 1.5, e.w + 3, e.h + 3);
    }
    // Barra de vida al recibir daño (los jefes la tienen abajo)
    if (!e.boss && !e.dead && e.hp < e.maxHp) {
      c.fillStyle = '#2b1f33';
      c.fillRect(Math.round(e.x + e.w / 2 - 9), Math.round(y - 5), 18, 3);
      c.fillStyle = '#e04848';
      c.fillRect(Math.round(e.x + e.w / 2 - 8), Math.round(y - 4), Math.max(1, Math.round((16 * e.hp) / e.maxHp)), 1);
    }
  }

  player(st: Stage) {
    const p = st.player;
    const a = art().hero;
    const c = this.ctx;
    const cart = st.def.type === 'carro';
    let img: HTMLCanvasElement;
    if (st.state === 'dead') img = a.pile;
    else if (p.healT > 0) img = a.up;
    else if (p.attackT > 6) img = p.ground || cart ? a.swing : a.air;
    else if (p.dashT > 0) img = a.air;
    else if (cart) img = p.ground ? a.idle[0] : a.jump;
    else if (st.def.water && !p.ground) img = Math.floor(p.anim / 10) % 2 ? a.jump : a.fall;
    else if (!p.ground) img = p.vy < 0 ? a.jump : a.fall;
    else if (Math.abs(p.vx) > 0.3) img = a.walk[Math.floor(p.anim / 8) % 2];
    else img = a.idle[Math.floor(p.anim / 30) % 2];
    if (st.state === 'clear') {
      const k = Math.min(1, st.stateT / 40);
      c.globalAlpha = 1 - k;
    }
    if (p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0 && st.state === 'play') c.globalAlpha = 0.35;
    const x = Math.round(p.x + p.w / 2 - 12);
    const y = Math.round(p.y + p.h - 24) - (cart && st.state !== 'dead' ? 6 : 0);
    // Estela de la embestida
    if (p.dashT > 0) {
      c.save();
      c.globalAlpha = 0.3;
      for (let i = 1; i <= 3; i++) this.flipDraw(img, x - p.face * i * 7, y, p.face < 0);
      c.restore();
    }
    this.flipDraw(img, x, y, p.face < 0);
    if (cart && st.state !== 'dead') {
      const cartImg = art().cart;
      c.drawImage(cartImg, Math.round(p.x + p.w / 2 - 10), Math.round(p.y + p.h - 11));
    }
    c.globalAlpha = 1;
    // Fémur en el golpe
    if (p.attackT > 4 && st.state === 'play') {
      const k = (16 - p.attackT) / 10;
      const ang = -1.4 + k * 2.2;
      const ox = p.x + p.w / 2 + p.face * 6, oy = p.y + 9 - (cart ? 6 : 0);
      const elem = ITEMS[st.save.weapon]?.elem;
      c.save();
      c.translate(ox, oy);
      c.scale(p.face, 1);
      c.rotate(ang);
      c.fillStyle = '#2b1f33';
      c.fillRect(0, -2, 17, 5);
      c.fillStyle = elem === 'fuego' ? '#ffb070' : elem === 'hielo' ? '#c8f0ff' : elem === 'rayo' ? '#fff0a0' : elem === 'tierra' ? '#d8b878' : elem === 'luz' ? '#fffbe0' : '#f4efe1';
      c.fillRect(1, -1, 15, 3);
      c.fillRect(13, -3, 4, 7);
      c.restore();
      if (p.attackT <= 12 && p.attackT >= 6) {
        c.strokeStyle = elem ? 'rgba(255,200,120,0.8)' : 'rgba(255,255,255,0.7)';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(ox, oy + 2, 16, p.face > 0 ? -1.2 : Math.PI + 1.2, p.face > 0 ? 1 : Math.PI - 1, p.face < 0);
        c.stroke();
      }
    }
    if (p.pound) {
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(Math.round(p.x - 2), Math.round(p.y - 10), 2, 8);
      c.fillRect(Math.round(p.x + p.w), Math.round(p.y - 10), 2, 8);
    }
  }

  flipDraw(img: HTMLCanvasElement, x: number, y: number, flip: boolean) {
    const c = this.ctx;
    if (!flip) {
      c.drawImage(img, x, y);
      return;
    }
    c.save();
    c.translate(x + img.width, y);
    c.scale(-1, 1);
    c.drawImage(img, 0, 0);
    c.restore();
  }

  projs(st: Stage) {
    const c = this.ctx;
    const a = art();
    for (const q of st.projs) {
      if (q.kind === 'warn') {
        c.fillStyle = `rgba(255,240,120,${0.3 + 0.3 * Math.sin(st.frame / 3)})`;
        c.fillRect(Math.round(q.x), Math.round(q.y), q.w, q.h);
        continue;
      }
      if (q.kind === 'bolt' && q.h > 40) {
        this.zigzag(q.x + q.w / 2, q.y, q.y + q.h, st.frame);
        continue;
      }
      const img =
        q.kind === 'bone' ? a.bone : q.kind === 'fire' ? a.fire[Math.floor(st.frame / 6) % 2] : q.kind === 'skull' ? a.skull : q.kind === 'bubble' ? a.bubble
        : q.kind === 'ice' ? a.ice : q.kind === 'seed' ? a.seed : q.kind === 'rock' ? a.rock : q.kind === 'stinger' ? a.stinger : q.kind === 'bolt' ? a.bolt
        : q.kind === 'spike' ? a.spike : q.kind === 'icicle' ? a.icicle : q.kind === 'bullet' ? a.bullet : q.kind === 'feather' ? a.feather : a.wave;
      c.save();
      c.translate(Math.round(q.x + q.w / 2), Math.round(q.y + q.h / 2));
      if (q.kind === 'bone' || q.kind === 'rock') c.rotate(Math.round(q.rot / (Math.PI / 2)) * (Math.PI / 2));
      if ((q.kind === 'stinger' || q.kind === 'bullet' || q.kind === 'feather') && q.vx > 0) c.scale(-1, 1);
      if (q.kind === 'ice' && q.vx !== 0) c.rotate(q.vx > 0 ? -Math.PI / 2 : Math.PI / 2);
      c.drawImage(img, -Math.floor(img.width / 2), -Math.floor(img.height / 2));
      c.restore();
    }
  }

  zigzag(x: number, y0: number, y1: number, frame: number) {
    const c = this.ctx;
    c.strokeStyle = '#fff6a0';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y0);
    let y = y0;
    let i = 0;
    while (y < y1) {
      y += 12;
      c.lineTo(x + ((i++ + frame) % 2 ? 5 : -5), Math.min(y, y1));
    }
    c.stroke();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1;
    c.stroke();
  }

  effects() {
    const c = this.ctx;
    for (const p of this.parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.t--;
      c.fillStyle = p.color;
      c.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    this.parts = this.parts.filter((p) => p.t > 0);
    for (const b of this.bolts) {
      b.t--;
      this.zigzag(b.x, b.y0, b.y1, b.t);
    }
    this.bolts = this.bolts.filter((b) => b.t > 0);
    for (const r of this.rings) {
      r.t--;
      const k = 1 - r.t / 20;
      c.strokeStyle = r.color;
      c.globalAlpha = r.t / 20;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(r.x, r.y, r.r * k, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }
    this.rings = this.rings.filter((r) => r.t > 0);
    c.font = FONT;
    c.textAlign = 'center';
    for (const f of this.floats) {
      f.t--;
      f.y -= 0.5;
      c.globalAlpha = Math.min(1, f.t / 15);
      outlined(c, f.text, Math.round(f.x), Math.round(f.y), f.color);
    }
    c.globalAlpha = 1;
    this.floats = this.floats.filter((f) => f.t > 0);
  }

  underwater(st: Stage) {
    const c = this.ctx;
    c.fillStyle = 'rgba(30,110,170,0.22)';
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    c.fillStyle = 'rgba(220,245,255,0.5)';
    for (let i = 0; i < 18; i++) {
      const x = (i * 83 + Math.sin(st.frame / 30 + i) * 6 - st.camX * 0.3) % VIEW_W;
      const y = VIEW_H - ((st.frame * (0.4 + (i % 3) * 0.2) + i * 47) % (VIEW_H + 20));
      c.fillRect(Math.round((x + VIEW_W) % VIEW_W), Math.round(y), 2, 2);
    }
  }

  darkness(st: Stage, camX: number, camY: number) {
    if (!this.dark) {
      this.dark = document.createElement('canvas');
      this.dark.width = VIEW_W;
      this.dark.height = VIEW_H;
    }
    const d = this.dark.getContext('2d')!;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, VIEW_W, VIEW_H);
    d.fillStyle = 'rgba(6,4,12,0.93)';
    d.fillRect(0, 0, VIEW_W, VIEW_H);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number) => {
      const g = d.createRadialGradient(x, y, r * 0.3, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath();
      d.arc(x, y, r, 0, Math.PI * 2);
      d.fill();
    };
    const p = st.player;
    hole(p.x + p.w / 2 - camX, p.y + p.h / 2 - camY, 78 + Math.sin(st.frame / 20) * 3);
    const x0 = Math.floor(camX / T) - 2, x1 = x0 + 30, y0 = Math.floor(camY / T) - 2, y1 = y0 + 19;
    for (let y = Math.max(0, y0); y <= Math.min(st.h - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(st.w - 1, x1); x++) {
        const ch = st.grid[y][x];
        if (ch === 't') hole(x * T + 9 - camX, y * T + 6 - camY, 56);
        else if (ch === '~' || ch === 'G' || ch === 'H') hole(x * T + 9 - camX, y * T + 9 - camY, 28);
      }
    for (const q of st.projs) if (q.kind === 'fire' || q.kind === 'bolt' || q.kind === 'warn') hole(q.x + q.w / 2 - camX, q.y + q.h / 2 - camY, 34);
    for (const b of st.bars) hole(b.x - camX, b.y - camY, 46);
    this.ctx.drawImage(this.dark, 0, 0);
  }

  windLines(st: Stage) {
    const c = this.ctx;
    const k = Math.abs(st.wind);
    c.strokeStyle = `rgba(255,255,255,${0.15 + k * 0.25})`;
    c.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const x = ((-(st.frame * (4 + k * 3)) + i * 97) % (VIEW_W + 60) + VIEW_W + 60) % (VIEW_W + 60) - 30;
      const y = (i * 41) % VIEW_H;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 20 + k * 14, y);
      c.stroke();
    }
  }

  hud(st: Stage) {
    const c = this.ctx;
    const s = st.save;
    const sts = stats(s);
    c.font = FONT;
    c.textAlign = 'left';
    // Panel
    c.fillStyle = 'rgba(20,12,28,0.72)';
    c.fillRect(4, 4, 150, 34);
    outlined(c, `Nv${s.level}`, 8, 15, '#f2c94c', 'left');
    bar(c, 44, 8, 104, 7, s.hp / sts.maxHp, '#e04848', '#5a1a24');
    bar(c, 44, 18, 104, 5, s.mp / sts.maxMp, '#5a8cff', '#1c2a5a');
    bar(c, 8, 30, 140, 3, s.xp / xpToNext(s.level), '#9fd0ff', '#22324a');
    c.font = SMALL;
    outlined(c, `${s.hp}/${sts.maxHp}`, 96, 15, '#fff', 'center');
    outlined(c, `PM ${s.mp}`, 8, 24, '#9fb4ff', 'left');
    c.font = FONT;
    // Hechizo elegido
    const sk = SKILL[s.spell];
    if (sk && s.level >= sk.level) {
      c.fillStyle = 'rgba(20,12,28,0.72)';
      c.fillRect(158, 4, 30, 34);
      const icon = SPELL_ICON[sk.id]?.();
      if (icon) c.drawImage(icon, Math.round(173 - icon.width / 2), Math.round(17 - icon.height / 2));
      c.font = SMALL;
      outlined(c, `${sk.mp}`, 173, 34, s.mp >= sk.mp ? '#9fb4ff' : '#ff7070', 'center');
      c.font = FONT;
    }
    // Llaves y palanca
    let hx = 192;
    if (st.keys > 0) {
      c.fillStyle = 'rgba(20,12,28,0.72)';
      c.fillRect(hx, 4, 34, 18);
      c.drawImage(art().key, hx + 1, 9);
      c.font = SMALL;
      outlined(c, `${st.keys}`, hx + 27, 17, '#f2c94c', 'center');
      c.font = FONT;
      hx += 38;
    }
    if (st.lvl.grid.some((r) => r.includes('l'))) {
      c.fillStyle = 'rgba(20,12,28,0.72)';
      c.fillRect(hx, 4, 18, 18);
      c.fillStyle = st.switchOn ? '#4878d8' : '#d84848';
      c.fillRect(hx + 4, 8, 10, 10);
    }
    // Monedas y objetos
    const tl = this.sh.tiles.pradera;
    c.fillStyle = 'rgba(20,12,28,0.72)';
    c.fillRect(VIEW_W - 96, 4, 92, 34);
    c.drawImage(tl, 11 * 18, 7 * 18, 18, 18, VIEW_W - 96, 2, 18, 18);
    outlined(c, String(s.coins + st.coinsGot), VIEW_W - 76, 16, '#f2c94c', 'left');
    const pot = (s.inv.pocion ?? 0) + (s.inv.pocion_g ?? 0);
    c.drawImage(this.sh.dungeon, ITEMS.pocion.icon[0] * 16, ITEMS.pocion.icon[1] * 16, 16, 16, VIEW_W - 94, 21, 16, 16);
    outlined(c, `${pot}`, VIEW_W - 76, 33, '#fff', 'left');
    c.drawImage(this.sh.dungeon, ITEMS.eter.icon[0] * 16, ITEMS.eter.icon[1] * 16, 16, 16, VIEW_W - 52, 21, 16, 16);
    outlined(c, `${s.inv.eter ?? 0}`, VIEW_W - 34, 33, '#fff', 'left');
    // Jefe
    const b = st.boss;
    if (b && (!b.dead || b.deadT > 60)) {
      c.fillStyle = 'rgba(20,12,28,0.8)';
      c.fillRect(VIEW_W / 2 - 110, VIEW_H - 24, 220, 18);
      outlined(c, b.def.name, VIEW_W / 2, VIEW_H - 15, '#ff9070', 'center');
      bar(c, VIEW_W / 2 - 104, VIEW_H - 11, 208, 3, b.hp / b.maxHp, '#ff5040', '#401018');
    }
    // Título del nivel al empezar
    if (this.intro > 0) {
      this.intro--;
      c.globalAlpha = Math.min(1, this.intro / 30);
      c.fillStyle = 'rgba(20,12,28,0.7)';
      c.fillRect(0, 96, VIEW_W, 46);
      outlined(c, `${st.def.id}  ${st.def.name}`, VIEW_W / 2, 116, '#fff', 'center');
      c.font = SMALL;
      outlined(c, st.world.name, VIEW_W / 2, 132, '#c9c2d9', 'center');
      c.globalAlpha = 1;
      c.font = FONT;
    }
    // Aviso grande (nivel, jefe, secreto)
    if (this.banner) {
      const bn = this.banner;
      bn.t--;
      c.globalAlpha = Math.min(1, bn.t / 20);
      const h = 18 + bn.lines.length * 14;
      c.fillStyle = 'rgba(20,12,28,0.75)';
      c.fillRect(0, 54, VIEW_W, h);
      bn.lines.forEach((l, i) => outlined(c, l, VIEW_W / 2, 70 + i * 14, i === 0 ? bn.color : '#fff', 'center'));
      c.globalAlpha = 1;
      if (bn.t <= 0) this.banner = null;
    }
    // Ayudas la primera vez que aparece cada cosa
    const tip = this.tipFor(st);
    if (tip && this.intro <= 0) {
      c.fillStyle = 'rgba(20,12,28,0.7)';
      c.fillRect(VIEW_W / 2 - 180, 46, 360, 34);
      outlined(c, tip[0], VIEW_W / 2, 60, '#fff', 'center');
      outlined(c, tip[1], VIEW_W / 2, 74, '#fff', 'center');
    }
  }

  tipFor(st: Stage): [string, string] | null {
    if (st.frame > 60 * 12) return null;
    const id = st.def.id;
    if (id === '1-1') return ['Flechas = moverte   Z = saltar', 'X = golpe de fémur   Esc = pausa'];
    if (st.def.type === 'carro') return ['¡La vagoneta no frena!', 'Z = saltar   Derecha acelera, izquierda frena'];
    if (st.def.water) return ['Bajo el agua: Z = dar una brazada', 'No puedes pisar a los monstruos'];
    if (st.def.lava) return ['¡La lava sube!', 'Trepa sin parar hasta la cima'];
    if (st.def.mech.includes('llave') && st.frame < 60 * 8) return ['Busca la llave para abrir la cerradura', 'Las puertas se abren con ↑'];
    if (st.def.mech.includes('palanca') && st.frame < 60 * 8) return ['Golpea las palancas para cambiar', 'los bloques rojos y azules'];
    if (st.def.mech.includes('muro') && st.frame < 60 * 8) return ['Los muros agrietados se rompen', 'a golpes (3 golpes o una embestida)'];
    return null;
  }
}

export function outlined(c: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'center') {
  c.textAlign = align;
  c.fillStyle = '#140c1c';
  c.fillText(text, x + 1, y + 1);
  c.fillText(text, x - 1, y + 1);
  c.fillText(text, x + 1, y - 1);
  c.fillText(text, x - 1, y - 1);
  c.fillStyle = color;
  c.fillText(text, x, y);
}

export function bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number, fg: string, bgc: string) {
  c.fillStyle = '#140c1c';
  c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = bgc;
  c.fillRect(x, y, w, h);
  c.fillStyle = fg;
  c.fillRect(x, y, Math.max(0, Math.round(w * Math.max(0, Math.min(1, k)))), h);
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.fillRect(x, y, Math.max(0, Math.round(w * Math.max(0, Math.min(1, k)))), 1);
}
