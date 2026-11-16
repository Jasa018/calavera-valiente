// Dibuja un nivel: fondo, casillas, personajes, efectos y HUD.
import { ITEMS } from '../data/items';
import type { SpriteRef } from '../data/monsters';
import type { Theme } from '../data/worlds';
import { stats, xpToNext } from '../game/progress';
import type { Enemy, Stage } from '../game/stage';
import { type GameEvent, ROWS, TILE as T, VIEW_H, VIEW_W } from '../game/types';
import { art } from './art';
import type { Sheets } from './sheets';

export const FONT = '8px "Press Start 2P", monospace';

interface ThemeLook {
  groundRow: number;
  sky: [string, string];
  bgCol: number;
  block: [number, number];
  deco: { sheet: 'tiles' | 'dungeon'; c: number; r: number }[];
}

export const LOOK: Record<Theme, ThemeLook> = {
  pradera: {
    groundRow: 0, sky: ['#6fc3f0', '#c4ecff'], bgCol: 6, block: [6, 1],
    deco: [{ sheet: 'tiles', c: 4, r: 6 }, { sheet: 'tiles', c: 5, r: 6 }, { sheet: 'dungeon', c: 5, r: 5 }, { sheet: 'tiles', c: 8, r: 6 }, { sheet: 'dungeon', c: 4, r: 5 }],
  },
  desierto: {
    groundRow: 2, sky: ['#f0a060', '#ffe0a8'], bgCol: 4, block: [6, 1],
    deco: [{ sheet: 'tiles', c: 7, r: 6 }, { sheet: 'tiles', c: 7, r: 6 }, { sheet: 'dungeon', c: 5, r: 5 }, { sheet: 'tiles', c: 6, r: 4 }, { sheet: 'tiles', c: 4, r: 6 }],
  },
  nieve: {
    groundRow: 4, sky: ['#8fb8e0', '#eaf6ff'], bgCol: 0, block: [7, 2],
    deco: [{ sheet: 'tiles', c: 4, r: 7 }, { sheet: 'tiles', c: 5, r: 7 }, { sheet: 'tiles', c: 6, r: 6 }, { sheet: 'tiles', c: 4, r: 7 }, { sheet: 'tiles', c: 6, r: 6 }],
  },
  castillo: {
    groundRow: 0, sky: ['#1a0a1e', '#4a1430'], bgCol: 6, block: [7, 2],
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

export class StageView {
  floats: Float[] = [];
  parts: Part[] = [];
  banner: { lines: string[]; t: number; color: string } | null = null;
  intro = 150;

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
  }

  draw(st: Stage) {
    const c = this.ctx;
    const theme = st.world.theme;
    const look = LOOK[theme];
    let camX = Math.round(st.camX);
    let camY = 0;
    if (st.shake > 0) {
      camX += Math.round((Math.random() - 0.5) * Math.min(6, st.shake));
      camY += Math.round((Math.random() - 0.5) * Math.min(6, st.shake));
    }
    this.background(theme, camX);
    c.save();
    c.translate(-camX, -camY);
    this.tiles(st, camX, look);
    // Plataformas móviles
    const tl = this.sh.tiles[theme];
    for (const p of st.plats) for (let i = 0; i < 3; i++) c.drawImage(tl, (i === 0 ? 8 : i === 2 ? 10 : 9) * 18, 2 * 18, 18, 9, Math.round(p.x + i * T), Math.round(p.y), 18, 9);
    // Recogibles
    for (const k of st.pickups) c.drawImage(tl, 4 * 18, 2 * 18, 18, 18, Math.round(k.x - 3), Math.round(k.y - 4), 18, 18);
    for (const q of st.pops) c.drawImage(tl, 11 * 18, 7 * 18, 18, 18, Math.round(q.x - 9), Math.round(q.y - 9), 18, 18);
    for (const e of st.enemies) this.enemy(e, st);
    this.player(st);
    this.projs(st);
    this.effects();
    c.restore();
    if (st.rainT > 0) {
      c.fillStyle = `rgba(80,0,120,${(st.rainT / 50) * 0.25})`;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    this.hud(st);
  }

  background(theme: Theme, camX: number) {
    const c = this.ctx;
    const look = LOOK[theme];
    const g = c.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, look.sky[0]);
    g.addColorStop(1, look.sky[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    if (theme === 'castillo') {
      c.fillStyle = '#ffe9b0';
      for (let i = 0; i < 40; i++) c.fillRect((i * 97 - camX * 0.05) % VIEW_W < 0 ? ((i * 97 - camX * 0.05) % VIEW_W) + VIEW_W : (i * 97 - camX * 0.05) % VIEW_W, (i * 53) % 120, 1, 1);
      c.fillStyle = '#ffd0a0';
      c.beginPath();
      c.arc(380, 50, 18, 0, Math.PI * 2);
      c.fill();
    } else if (theme !== 'nieve') {
      // nubes simples
      c.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 5; i++) {
        const x = ((i * 130 - camX * 0.15) % 620) + (i * 130 - camX * 0.15 < 0 ? 620 : 0) - 70;
        const y = 24 + ((i * 37) % 50);
        c.fillRect(x, y, 44, 8);
        c.fillRect(x + 8, y - 6, 26, 6);
      }
    }
    const bg = this.sh.bg[theme];
    // Colinas lejanas (fila 1 de la hoja) en dos capas de paralaje
    const layer = (par: number, y: number, col0: number) => {
      const off = -((camX * par) % 48);
      for (let x = off - 48; x < VIEW_W + 48; x += 24) {
        const col = col0 + (Math.floor((x - off) / 24 + 100) % 2);
        c.drawImage(bg, col * 24, 24, 24, 24, Math.round(x), y, 24, 24);
      }
      c.drawImage(bg, col0 * 24, 48, 24, 24, 0, y + 24, VIEW_W, VIEW_H - y - 24);
    };
    layer(0.25, 150, look.bgCol);
  }

  tiles(st: Stage, camX: number, look: ThemeLook) {
    const c = this.ctx;
    const tl = this.sh.tiles[st.world.theme];
    const x0 = Math.max(0, Math.floor(camX / T) - 1);
    const x1 = Math.min(st.w - 1, Math.ceil((camX + VIEW_W) / T) + 1);
    const draw = (col: number, row: number, x: number, y: number) => c.drawImage(tl, col * 18, row * 18, 18, 18, x * T, y * T, 18, 18);
    const solidish = (x: number, y: number) => {
      const ch = st.tile(x, y);
      return ch === '#';
    };
    // Adornos detrás
    for (const d of st.lvl.deco) {
      if (d.tx < x0 || d.tx > x1) continue;
      const dc = look.deco[d.v % look.deco.length];
      if (dc.sheet === 'tiles') draw(dc.c, dc.r, d.tx, d.ty);
      else c.drawImage(this.sh.dungeon, dc.c * 16, dc.r * 16, 16, 16, d.tx * T + 1, d.ty * T + 2, 16, 16);
    }
    const frame = Math.floor(st.frame / 12);
    for (let y = 0; y < ROWS; y++) {
      for (let x = x0; x <= x1; x++) {
        const ch = st.grid[y][x];
        switch (ch) {
          case '#': {
            const top = !solidish(x, y - 1) && y > 0;
            const bot = y < ROWS - 1 && !solidish(x, y + 1);
            const l = !solidish(x - 1, y) && x > 0;
            const r = !solidish(x + 1, y) && x < st.w - 1;
            const col = l && r ? 0 : l ? 1 : r ? 3 : 2;
            if (top) draw(col, look.groundRow + (bot ? 0 : 1), x, y);
            else draw(col, bot ? 7 : 6, x, y);
            break;
          }
          case 'X':
            draw(look.block[0], look.block[1], x, y);
            break;
          case 'B':
            draw(6, 0, x, y);
            break;
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
          case '-': {
            const l = st.tile(x - 1, y) === '-', r = st.tile(x + 1, y) === '-';
            draw(!l ? 8 : !r ? 10 : 9, 2, x, y);
            break;
          }
          case '^':
            draw(8, 3, x, y);
            break;
          case '~':
            draw(13, st.tile(x, y - 1) === '~' ? 2 : 1, x, y);
            break;
          case 'S':
            draw(st.springs.has(x) ? 7 : 8, 5, x, y);
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
            const up = st.flags.has(x);
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
          case 'W':
            if (st.gateClosed) draw(7, 2, x, y);
            break;
        }
      }
    }
  }

  sprite(ref: SpriteRef, frame: number, x: number, y: number, flip: boolean, flash: boolean, alpha = 1) {
    const c = this.ctx;
    const f = ref.frames[frame % ref.frames.length];
    const sc = ref.scale ?? 1;
    let img: CanvasImageSource, sx = 0, sy = 0, sw: number, sh: number;
    if (typeof f === 'string') {
      const a = art() as unknown as Record<string, HTMLCanvasElement>;
      img = a[f];
      sw = a[f].width;
      sh = a[f].height;
    } else {
      const size = ref.sheet === 'chars' ? 24 : 16;
      img = ref.sheet === 'chars' ? this.sh.chars : this.sh.dungeon;
      sx = f[0] * size;
      sy = f[1] * size;
      sw = sh = size;
    }
    const w = sw * sc, h = sh * sc;
    c.save();
    c.globalAlpha = alpha;
    c.translate(Math.round(x), Math.round(y));
    if (flip) {
      c.scale(-1, 1);
      c.translate(-w, 0);
    }
    c.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    if (flash) {
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.fillRect(0, 0, w, h);
    }
    c.restore();
    return { w, h };
  }

  enemy(e: Enemy, st: Stage) {
    const ref = e.def.sprite;
    const f = ref.frames[0];
    const size = typeof f === 'string' ? (art() as unknown as Record<string, HTMLCanvasElement>)[f].width : ref.sheet === 'chars' ? 24 : 16;
    const sc = ref.scale ?? 1;
    const w = size * sc;
    const hgt = (typeof f === 'string' ? (art() as unknown as Record<string, HTMLCanvasElement>)[f].height : size) * sc;
    let frame = Math.floor(e.t / 10);
    if (e.def.behavior === 'thwomp' || e.def.id === 'bloque_titan') frame = e.state === 'wait' || e.state === 'hover' || e.state === 'rise' ? 0 : 1;
    let alpha = 1;
    if (e.dead) alpha = Math.max(0, e.deadT / (e.boss ? 120 : 24));
    if (e.def.behavior === 'ghost') alpha *= 0.8;
    if (e.state === 'tele' && e.timer < 20) alpha *= 1 - e.timer / 20;
    if (e.state === 'intro') alpha *= 1 - e.timer / 70;
    const x = e.x + e.w / 2 - w / 2;
    const y = e.y + e.h - hgt + (ref.sheet === 'chars' && !ref.scale ? 3 : 0) + (e.boss && ref.sheet === 'chars' ? 6 : 0);
    const shakeX = e.state === 'wind' ? Math.round(Math.sin(st.frame) * 1.5) : 0;
    this.sprite(ref, frame, x + shakeX, y, e.face > 0 === !ref.facesLeft ? false : true, e.flash > 0 && e.flash % 4 < 2, alpha);
    // Barra de vida al recibir daño (los jefes la tienen abajo)
    if (!e.boss && !e.dead && e.hp < e.maxHp) {
      const c = this.ctx;
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
    let img: HTMLCanvasElement;
    if (st.state === 'dead') img = a.pile;
    else if (p.healT > 0) img = a.up;
    else if (p.attackT > 6) img = p.ground ? a.swing : a.air;
    else if (p.dashT > 0) img = a.air;
    else if (!p.ground) img = p.vy < 0 ? a.jump : a.fall;
    else if (Math.abs(p.vx) > 0.3) img = a.walk[Math.floor(p.anim / 8) % 2];
    else img = a.idle[Math.floor(p.anim / 30) % 2];
    if (st.state === 'clear') {
      const k = Math.min(1, st.stateT / 40);
      c.globalAlpha = 1 - k;
    }
    if (p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0 && st.state === 'play') c.globalAlpha = 0.35;
    const x = Math.round(p.x + p.w / 2 - 12);
    const y = Math.round(p.y + p.h - 24);
    // Estela de la embestida
    if (p.dashT > 0) {
      c.save();
      c.globalAlpha = 0.3;
      for (let i = 1; i <= 3; i++) this.flipDraw(img, x - p.face * i * 7, y, p.face < 0);
      c.restore();
    }
    this.flipDraw(img, x, y, p.face < 0);
    c.globalAlpha = 1;
    // Fémur en el golpe
    if (p.attackT > 4 && st.state === 'play') {
      const k = (16 - p.attackT) / 10;
      const ang = -1.4 + k * 2.2;
      const ox = p.x + p.w / 2 + p.face * 6, oy = p.y + 9;
      c.save();
      c.translate(ox, oy);
      c.scale(p.face, 1);
      c.rotate(ang);
      c.fillStyle = '#2b1f33';
      c.fillRect(0, -2, 17, 5);
      c.fillStyle = '#f4efe1';
      c.fillRect(1, -1, 15, 3);
      c.fillRect(13, -3, 4, 7);
      c.restore();
      if (p.attackT <= 12 && p.attackT >= 6) {
        c.strokeStyle = 'rgba(255,255,255,0.7)';
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
      const img = q.kind === 'bone' ? a.bone : q.kind === 'fire' ? a.fire[Math.floor(st.frame / 6) % 2] : q.kind === 'skull' ? a.skull : q.kind === 'bubble' ? a.bubble : q.kind === 'ice' ? a.ice : a.wave;
      c.save();
      c.translate(Math.round(q.x + q.w / 2), Math.round(q.y + q.h / 2));
      if (q.kind === 'bone') c.rotate(Math.round(q.rot / (Math.PI / 2)) * (Math.PI / 2));
      c.drawImage(img, -Math.floor(img.width / 2), -Math.floor(img.height / 2));
      c.restore();
    }
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
    c.font = '6px "Press Start 2P", monospace';
    outlined(c, `${s.hp}/${sts.maxHp}`, 96, 15, '#fff', 'center');
    outlined(c, `PM ${s.mp}`, 8, 24, '#9fb4ff', 'left');
    c.font = FONT;
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
      c.font = '6px "Press Start 2P", monospace';
      outlined(c, st.world.name, VIEW_W / 2, 132, '#c9c2d9', 'center');
      c.globalAlpha = 1;
      c.font = FONT;
    }
    // Aviso grande (nivel, jefe)
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
    // Ayuda de controles al principio del 1-1
    if (st.def.id === '1-1' && st.frame < 60 * 14 && this.intro <= 0) {
      c.globalAlpha = Math.min(1, (60 * 14 - st.frame) / 40);
      c.fillStyle = 'rgba(20,12,28,0.7)';
      c.fillRect(VIEW_W / 2 - 170, 46, 340, 34);
      outlined(c, 'Flechas = moverte   Z = saltar', VIEW_W / 2, 60, '#fff', 'center');
      outlined(c, 'X = golpe de fémur   Esc = pausa', VIEW_W / 2, 74, '#fff', 'center');
      c.globalAlpha = 1;
    }
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


