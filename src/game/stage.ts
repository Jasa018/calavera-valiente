// Simulación de un nivel a 60 fotogramas por segundo. No usa DOM ni canvas:
// `scripts/sim.ts` la ejecuta en Node. Avisa a la interfaz con `events`.
import { ITEMS } from '../data/items';
import { MONSTERS, type BossMove, type MonsterDef, type ProjKind } from '../data/monsters';
import { type Element, SKILL, type SkillId } from '../data/skills';
import { LEVELS, WORLDS, type LevelDef, type WorldDef } from '../data/worlds';
import { tierStats, type TierStats } from './formulas';
import { buildLevel, type BuiltLevel } from './level';
import { gainXp, hasSkill, knownSpells, stats, useItem, type Save } from './progress';
import { Rng } from './rng';
import { type GameEvent, type Input, type Rect, TILE as T, VIEW_H, VIEW_W } from './types';

// ── Física ──
export const PHYS = {
  g: 0.38,
  maxFall: 6.5,
  acc: 0.32,
  airAcc: 0.24,
  fric: 0.3,
  maxV: 2.5,
  jumpV: -7.8,
  doubleV: -6.6,
  cutV: -3,
  springV: -11.4,
  coyote: 6,
  buffer: 7,
  // Bajo el agua
  wG: 0.09,
  wMaxFall: 1.4,
  wStroke: -2.7,
  wMaxV: 1.7,
  // Hielo
  iceAcc: 0.09,
  iceFric: 0.035,
  iceMaxV: 2.9,
  // Vagoneta
  cartV: 2.7,
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Actor extends Box {
  vx: number;
  vy: number;
  ground: boolean;
}

export const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const cx = (a: Box) => a.x + a.w / 2;
const cy = (a: Box) => a.y + a.h / 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const key = (x: number, y: number) => `${x},${y}`;

export class Player implements Actor {
  x = 0;
  y = 0;
  w = 10;
  h = 20;
  vx = 0;
  vy = 0;
  ground = false;
  face: 1 | -1 = 1;
  coyote = 0;
  buffer = 0;
  airJumps = 0;
  airDash = false;
  inv = 0;
  hurtT = 0;
  attackT = 0;
  attackHit = new Set<Enemy>();
  castCd = 0;
  dashT = 0;
  dashCd = 0;
  dashHit = new Set<Enemy>();
  pound = false;
  healT = 0;
  onPlat: Platform | null = null;
  anim = 0;
  airT = 0;
}

export class Enemy implements Actor {
  x: number;
  y: number;
  w: number;
  h: number;
  vx = 0;
  vy = 0;
  ground = false;
  face: 1 | -1 = -1;
  hp: number;
  maxHp: number;
  atk: number;
  dfn: number;
  xp: number;
  gold: number;
  state = 'idle';
  timer = 60;
  flash = 0;
  dead = false;
  deadT = 0;
  homeX: number;
  homeY: number;
  active = false;
  t = 0;
  phase = 1;
  count = 0;
  /** Fotogramas que le quedan congelado. */
  frozen = 0;
  /** Bajo tierra (no se le puede tocar). */
  hidden = false;
  /** Para no repetir el aviso de «¡Débil!». */
  tagT = 0;
  /** Último ataque del jefe (para no repetirlo). */
  lastMove = '';
  /** Invocado por un jefe: no da experiencia ni oro. */
  minion = false;
  /** Fondo de la zona donde nació (si cae más abajo, muere). */
  floorY = 0;
  constructor(
    public def: MonsterDef,
    x: number,
    y: number,
    base: TierStats,
  ) {
    this.w = def.w;
    this.h = def.h;
    this.x = x;
    this.y = y;
    this.hp = this.maxHp = Math.max(1, Math.round(base.hp * def.hp));
    this.atk = Math.max(1, Math.round(base.atk * def.atk));
    this.dfn = Math.round(base.def * def.def);
    this.xp = Math.max(def.xp ? 1 : 0, Math.round(base.xp * def.xp));
    this.gold = Math.round(base.gold * def.gold);
    this.homeX = x;
    this.homeY = y;
  }
  get boss() {
    return this.def.behavior === 'boss';
  }
  get spikyNow() {
    if (this.def.behavior === 'puffer') return this.state === 'puff';
    return !!this.def.spiky;
  }
}

export interface Platform extends Box {
  axis: 'x' | 'y';
  ox: number;
  oy: number;
  range: number;
  t: number;
  dx: number;
  dy: number;
}

export interface Proj extends Box {
  vx: number;
  vy: number;
  mine: boolean;
  power: number;
  kind: ProjKind;
  grav: number;
  life: number;
  rot: number;
  elem: Element;
  /** Atraviesa paredes. */
  ghost?: boolean;
  /** Rebota en el suelo (bola de fuego). */
  bounce?: boolean;
  /** Congela. */
  freeze?: boolean;
  /** Atraviesa monstruos (lanzas de tierra). */
  pierce?: boolean;
  /** Recorre el suelo. */
  crawl?: boolean;
  hit?: Set<Enemy>;
  target?: Enemy;
}

export interface Pickup extends Box {
  vy: number;
  kind: 'heart';
}

export interface Pop {
  x: number;
  y: number;
  vy: number;
  t: number;
}

export interface FireBar {
  x: number;
  y: number;
  ang: number;
  speed: number;
  n: number;
}

export interface Cannon {
  tx: number;
  ty: number;
  timer: number;
}

export type StageState = 'play' | 'dead' | 'clear';

const SOLID = new Set(['#', 'X', 'B', '?', 'Q', 'U', 'I', 'L', 'R', 'O', 'A']);
export const ONE_WAY = new Set(['-', '=', 'C', 'v', 'V']);

export class Stage {
  readonly def: LevelDef;
  readonly world: WorldDef;
  readonly worldIndex: number;
  readonly lvl: BuiltLevel;
  readonly base: TierStats;
  grid: string[][];
  w: number;
  h: number;
  player = new Player();
  enemies: Enemy[] = [];
  plats: Platform[] = [];
  projs: Proj[] = [];
  pickups: Pickup[] = [];
  pops: Pop[] = [];
  bars: FireBar[] = [];
  cannons: Cannon[] = [];
  events: GameEvent[] = [];
  camX = 0;
  camY = 0;
  region: Rect;
  frame = 0;
  state: StageState = 'play';
  stateT = 0;
  checkpoint: { x: number; y: number } | null = null;
  checkCoins = 0;
  flags = new Set<string>();
  /** Resortes comprimidos: "x,y" → fotogramas. */
  springs = new Map<string, number>();
  /** Tablones que se caen: "x,y" → fotogramas hasta caer. */
  crumbling = new Map<string, number>();
  /** Tablones caídos: "x,y" → fotogramas hasta volver. */
  fallen = new Map<string, number>();
  /** Golpes recibidos por los muros agrietados. */
  cracks = new Map<string, number>();
  /** Muros falsos descubiertos. */
  revealed = new Set<string>();
  keys = 0;
  switchOn = false;
  leverCd = 0;
  lastSafe = { x: 0, y: 0 };
  coinsGot = 0;
  xpGot = 0;
  kills = 0;
  boss: Enemy | null = null;
  bossDone = false;
  gateClosed = false;
  /** Salida usada: normal o secreta. */
  exit: 'n' | 's' = 'n';
  /** Lava que sube (torres), en píxeles; Infinity si no hay. */
  lavaY = Infinity;
  wind = 0;
  /** Fotogramas de temblor de pantalla restantes. */
  shake = 0;
  rng: Rng;
  mpTick = 0;
  /** Efecto de la lluvia de calaveras. */
  rainT = 0;
  doorCd = 0;

  constructor(
    levelId: string,
    public save: Save,
    opts: { seed?: number; fromCheckpoint?: { x: number; y: number; coins: number } } = {},
  ) {
    const info = LEVELS[levelId];
    if (!info) throw new Error(`Nivel desconocido: ${levelId}`);
    this.def = info.def;
    this.worldIndex = info.world;
    this.world = WORLDS[info.world];
    this.base = tierStats(this.def.tier);
    this.lvl = buildLevel(this.def);
    this.grid = this.lvl.grid;
    this.w = this.lvl.w;
    this.h = this.lvl.h;
    this.rng = new Rng(opts.seed ?? 1234);
    const p = this.player;
    p.x = this.lvl.start.tx * T + (T - p.w) / 2;
    p.y = (this.lvl.start.ty + 1) * T - p.h;
    if (opts.fromCheckpoint) {
      p.x = opts.fromCheckpoint.x;
      p.y = opts.fromCheckpoint.y;
      this.checkpoint = { x: p.x, y: p.y };
      this.coinsGot = this.checkCoins = opts.fromCheckpoint.coins;
      // Las banderas anteriores al punto de control quedan levantadas
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++) if (this.grid[y][x] === 'K' && (x * T <= p.x + T || y * T >= p.y)) this.flags.add(key(x, y));
    }
    this.region = this.regionAt(cx(p), cy(p));
    this.lastSafe = { x: p.x, y: p.y };
    for (const s of this.lvl.spawns) {
      if (s.kind === 'enemy') this.addEnemy(s.id, s.tx, s.ty);
      else if (s.kind === 'platX' || s.kind === 'platY') {
        this.plats.push({
          x: s.tx * T, y: s.ty * T, w: 3 * T, h: 8, axis: s.kind === 'platX' ? 'x' : 'y',
          ox: s.tx * T, oy: s.ty * T, range: s.kind === 'platX' ? 5 * T : 4 * T, t: 0, dx: 0, dy: 0,
        });
      }
    }
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.grid[y][x];
        if (c === 'O') this.bars.push({ x: x * T + 9, y: y * T + 9, ang: (x * 1.7) % 6.28, speed: (x % 2 ? 1 : -1) * 0.035, n: 4 });
        else if (c === 'A') this.cannons.push({ tx: x, ty: y, timer: 60 + ((x * 37) % 100) });
      }
    if (this.def.lava) this.lavaY = this.h * T + 30;
    const st = stats(save);
    save.hp = st.maxHp;
    save.mp = st.maxMp;
    this.updateCam(true);
  }

  addEnemy(id: string, tx: number, ty: number) {
    const def = MONSTERS[id];
    if (!def) throw new Error(`Monstruo desconocido: ${id}`);
    const e = new Enemy(def, tx * T + (T - def.w) / 2, (ty + 1) * T - def.h, this.base);
    const reg = this.regionAt(tx * T + 9, ty * T + 9);
    e.floorY = reg.y1 * T;
    const b = def.behavior;
    if (b === 'flyer' || b === 'swimmer' || b === 'jelly' || b === 'puffer' || b === 'ghost') e.homeY = e.y = ty * T + (T - def.h) / 2;
    if (b === 'cloud') {
      e.y = Math.max(reg.y0 * T + 4, ty * T - 3 * T);
      e.homeY = e.y;
    }
    if (b === 'thwomp') {
      // Flota hasta 4 casillas por encima, sin atravesar techo
      let up = 0;
      while (up < 4 && !this.solidAt(tx, ty - up - 1) && ty - up - 1 > reg.y0 + 1) up++;
      e.y -= up * T;
      e.homeY = e.y;
      e.state = 'wait';
    }
    if (b === 'dropper') {
      // Se cuelga del techo más cercano (o del borde de arriba)
      let y = ty;
      while (y > reg.y0 && !this.solidAt(tx, y - 1) && ty - y < 10) y--;
      e.y = y * T;
      e.homeY = e.y;
      e.state = 'hang';
    }
    if (b === 'burrower') {
      e.state = 'under';
      e.hidden = true;
      e.timer = 40;
    }
    e.face = -1;
    this.enemies.push(e);
    return e;
  }

  // ── Casillas ──
  tile(tx: number, ty: number) {
    if (tx < 0 || tx >= this.w) return 'X';
    if (ty < 0 || ty >= this.h) return '.';
    return this.grid[ty][tx];
  }
  solidAt(tx: number, ty: number) {
    const c = this.tile(tx, ty);
    if (SOLID.has(c)) return true;
    if (c === 'E') return !this.switchOn;
    if (c === 'F') return this.switchOn;
    if (c === 'W') return this.gateClosed;
    return false;
  }
  setTile(tx: number, ty: number, c: string) {
    if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) this.grid[ty][tx] = c;
  }
  regionAt(px: number, py: number): Rect {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    for (const r of this.lvl.regions) if (tx >= r.x0 && tx < r.x1 && ty >= r.y0 - 2 && ty < r.y1 + 4) return r;
    return this.lvl.regions[0];
  }

  moveX(a: Actor): boolean {
    a.x += a.vx;
    const top = Math.floor(a.y / T);
    const bot = Math.floor((a.y + a.h - 0.01) / T);
    if (a.vx > 0) {
      const tx = Math.floor((a.x + a.w - 0.01) / T);
      for (let ty = top; ty <= bot; ty++)
        if (this.solidAt(tx, ty)) {
          a.x = tx * T - a.w;
          return true;
        }
    } else if (a.vx < 0) {
      const tx = Math.floor(a.x / T);
      for (let ty = top; ty <= bot; ty++)
        if (this.solidAt(tx, ty)) {
          a.x = (tx + 1) * T;
          return true;
        }
    }
    return false;
  }

  /** Mueve en vertical. Devuelve las casillas del techo golpeadas. */
  moveY(a: Actor, drop = false, isPlayer = false): { floor: boolean; ceil: [number, number][] } {
    const oldBottom = a.y + a.h;
    a.y += a.vy;
    const l = Math.floor(a.x / T);
    const r = Math.floor((a.x + a.w - 0.01) / T);
    const res = { floor: false, ceil: [] as [number, number][] };
    a.ground = false;
    if (a.vy > 0) {
      const ty = Math.floor((a.y + a.h - 0.01) / T);
      for (let tx = l; tx <= r; tx++) {
        const c = this.tile(tx, ty);
        if (this.solidAt(tx, ty) || (ONE_WAY.has(c) && !drop && oldBottom <= ty * T + 0.5)) {
          a.y = ty * T - a.h;
          a.vy = 0;
          a.ground = true;
          res.floor = true;
          break;
        }
      }
    } else if (a.vy < 0) {
      const ty = Math.floor(a.y / T);
      for (let tx = l; tx <= r; tx++) if (this.solidAt(tx, ty) || (isPlayer && this.tile(tx, ty) === 'i')) res.ceil.push([tx, ty]);
      if (res.ceil.length) {
        a.y = (ty + 1) * T;
        a.vy = 0;
      }
    }
    return res;
  }

  updateCam(snap = false) {
    const p = this.player;
    const cart = this.def.type === 'carro';
    const tx = this.clampCamX(cx(p) - VIEW_W / 2 + (cart ? 90 : p.face * 30));
    const ty = this.clampCamY(cy(p) - VIEW_H * 0.55);
    if (snap) {
      this.camX = tx;
      this.camY = ty;
    } else {
      this.camX += (tx - this.camX) * (cart ? 0.2 : 0.1);
      this.camY += (ty - this.camY) * 0.12;
    }
  }
  clampCamX(x: number) {
    let r = this.region;
    if (this.gateClosed && this.lvl.arena) r = this.lvl.arena;
    const x0 = r.x0 * T, x1 = r.x1 * T;
    if (x1 - x0 <= VIEW_W) return (x0 + x1) / 2 - VIEW_W / 2;
    return clamp(x, x0, x1 - VIEW_W);
  }
  clampCamY(y: number) {
    const r = this.region;
    const y0 = r.y0 * T, y1 = r.y1 * T;
    if (y1 - y0 <= VIEW_H) return y0;
    return clamp(y, y0, y1 - VIEW_H);
  }

  emit(e: GameEvent) {
    this.events.push(e);
  }
  sound(s: Extract<GameEvent, { t: 'sound' }>['s']) {
    this.emit({ t: 'sound', s });
  }
  float(x: number, y: number, text: string, color = '#fff') {
    this.emit({ t: 'float', x, y, text, color });
  }
  onScreen(b: Box, m = 0) {
    return b.x + b.w > this.camX - m && b.x < this.camX + VIEW_W + m && b.y + b.h > this.camY - m && b.y < this.camY + VIEW_H + m;
  }

  // ── Bucle ──
  update(inp: Input) {
    this.frame++;
    if (this.shake > 0) this.shake--;
    if (this.state !== 'play') {
      this.stateT++;
      this.updatePlats();
      this.updateEnemies();
      this.updateProjs();
      return;
    }
    if (this.leverCd > 0) this.leverCd--;
    if (this.doorCd > 0) this.doorCd--;
    this.updateWorld();
    this.updatePlats();
    this.updatePlayer(inp);
    this.updateEnemies();
    this.updateProjs();
    this.updateHazards();
    this.updatePickups();
    this.collide();
    this.triggers();
    this.updateCam();
    // Regeneración de PM
    const st = stats(this.save);
    if (++this.mpTick >= (hasSkill(this.save, 'vigor') ? 40 : 120)) {
      this.mpTick = 0;
      if (this.save.mp < st.maxMp) this.save.mp++;
    }
    if (this.rainT > 0) this.rainT--;
  }

  /** Viento, lava, tablones que caen y resortes. */
  updateWorld() {
    if (this.def.wind) this.wind = -this.def.wind * (0.5 + 0.5 * Math.sin((this.frame / 300) * Math.PI * 2));
    if (this.def.lava && this.frame > 150) {
      const top = (this.region.y0 + 4) * T;
      this.lavaY = Math.max(top, Math.min(this.lavaY - this.def.lava, this.camY + VIEW_H + 50));
    }
    for (const [k, v] of this.springs) v <= 1 ? this.springs.delete(k) : this.springs.set(k, v - 1);
    for (const [k, v] of this.crumbling) {
      if (v <= 1) {
        this.crumbling.delete(k);
        const [x, y] = k.split(',').map(Number);
        this.setTile(x, y, '.');
        this.fallen.set(k, 300);
        this.emit({ t: 'parts', x: x * T + 9, y: y * T + 4, color: '#b5843c', n: 6 });
      } else this.crumbling.set(k, v - 1);
    }
    for (const [k, v] of this.fallen) {
      if (v <= 1) {
        const [x, y] = k.split(',').map(Number);
        if (overlap(this.player, { x: x * T, y: y * T - 4, w: T, h: T + 4 })) continue;
        this.fallen.delete(k);
        this.setTile(x, y, 'V');
      } else this.fallen.set(k, v - 1);
    }
  }

  updatePlats() {
    for (const pl of this.plats) {
      pl.t++;
      const k = (1 - Math.cos((pl.t / 180) * Math.PI * 2)) / 2; // ida y vuelta suave
      const nx = pl.axis === 'x' ? pl.ox + k * pl.range : pl.ox;
      const ny = pl.axis === 'y' ? pl.oy - k * pl.range : pl.oy;
      pl.dx = nx - pl.x;
      pl.dy = ny - pl.y;
      pl.x = nx;
      pl.y = ny;
    }
  }

  /** ¿Pisa hielo? */
  onIce() {
    const p = this.player;
    if (!p.ground) return false;
    const c = this.tile(Math.floor(cx(p) / T), Math.floor((p.y + p.h + 1) / T));
    return c === 'I' || (this.def.ice && c === '#');
  }

  updatePlayer(inp: Input) {
    const p = this.player;
    const s = this.save;
    const st = stats(s);
    const water = this.def.water;
    const cart = this.def.type === 'carro';
    p.anim++;
    if (p.inv > 0) p.inv--;
    if (p.castCd > 0) p.castCd--;
    if (p.dashCd > 0) p.dashCd--;
    if (p.attackT > 0) p.attackT--;

    // Llevado por una plataforma
    if (p.onPlat) {
      const own = p.vx;
      p.vx = p.onPlat.dx;
      this.moveX(p);
      p.vx = own;
      p.y = p.onPlat.y - p.h;
    }

    // Puertas
    if (inp.upP && this.doorCd === 0 && (p.ground || water) && this.tryDoor()) return;

    // Objetos rápidos
    if (inp.item1P) this.quickItem(s.inv.pocion ? 'pocion' : 'pocion_g');
    if (inp.item2P) this.quickItem('eter');
    // Elegir hechizo
    if (inp.nextP || inp.prevP) this.cycleSpell(inp.nextP ? 1 : -1);

    // Rearmarse (curación)
    if (p.healT > 0) {
      p.healT--;
      p.vx *= 0.7;
      if (p.healT === 0) {
        const amount = Math.round(st.maxHp * 0.35);
        const before = s.hp;
        s.hp = Math.min(st.maxHp, s.hp + amount);
        this.float(cx(p), p.y - 4, `+${s.hp - before}`, '#7dffa0');
        this.sound('heal');
        this.emit({ t: 'parts', x: cx(p), y: cy(p), color: '#7dffa0', n: 14 });
      }
      this.applyGravityAndMove(inp, false);
      return;
    }

    const control = p.hurtT <= 0;
    if (p.hurtT > 0) p.hurtT--;

    // Embestida
    if (p.dashT > 0) {
      p.dashT--;
      p.vx = p.face * 6.5;
      p.vy = 0;
      const before = p.x;
      if (this.moveX(p)) {
        // Rompe muros agrietados al chocar
        const tx = Math.floor((p.face > 0 ? p.x + p.w + 1 : p.x - 1) / T);
        let broke = false;
        for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h - 1) / T); ty++)
          if (this.tile(tx, ty) === 'R' || this.tile(tx, ty) === 'B') {
            this.crack(tx, ty, 3);
            broke = true;
          }
        if (!broke) p.dashT = 0;
        else p.x = before;
      }
      if (p.dashT === 0) p.vx = p.face * PHYS.maxV;
      this.moveYPlayer(false);
      return;
    }

    if (control) {
      const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (cart) {
        // La vagoneta siempre avanza: derecha acelera, izquierda frena
        const target = PHYS.cartV + (inp.right ? 0.8 : 0) - (inp.left ? 1 : 0);
        p.vx += (target - p.vx) * 0.08;
        p.face = 1;
      } else if (!p.pound) {
        const ice = this.onIce();
        const maxV = water ? PHYS.wMaxV : ice ? PHYS.iceMaxV : PHYS.maxV;
        const acc = water ? 0.14 : ice ? PHYS.iceAcc : p.ground ? PHYS.acc : PHYS.airAcc;
        const fric = water ? 0.08 : ice ? PHYS.iceFric : PHYS.fric;
        if (dir) {
          p.vx += dir * acc;
          if (p.attackT === 0) p.face = dir as 1 | -1;
        } else if (p.ground || water) {
          p.vx = Math.abs(p.vx) <= fric ? 0 : p.vx - Math.sign(p.vx) * fric;
        } else p.vx *= 0.96;
        p.vx = clamp(p.vx, -maxV, maxV);
      }

      if (water) {
        // Nadar: cada pulsación es una brazada
        if (inp.jumpP) {
          p.vy = PHYS.wStroke;
          p.ground = false;
          p.onPlat = null;
          this.sound('swim');
          this.emit({ t: 'parts', x: cx(p), y: p.y + 4, color: '#bfe8ff', n: 3 });
        }
      } else {
        // Salto (con tiempo de coyote y búfer)
        if (inp.jumpP) p.buffer = PHYS.buffer;
        else if (p.buffer > 0) p.buffer--;
        if (p.ground) {
          p.coyote = PHYS.coyote;
          p.airJumps = 0;
          p.airDash = false;
        } else if (p.coyote > 0) p.coyote--;

        const dropping = inp.down && p.ground && this.onOneWay();
        if (p.buffer > 0 && dropping) {
          p.buffer = 0;
          p.y += 2; // caer a través del tablón
          p.ground = false;
          p.onPlat = null;
          p.coyote = 0;
        } else if (inp.jumpP && !p.ground && p.coyote <= 0 && inp.down && hasSkill(s, 'pisoton') && !p.pound) {
          p.pound = true;
          p.buffer = 0;
          p.vx = 0;
          p.vy = -2.5;
          this.sound('dash');
        } else if (p.buffer > 0 && (p.ground || p.coyote > 0)) {
          this.jump(PHYS.jumpV);
        } else if (inp.jumpP && !p.ground && !p.pound && p.airJumps < 1 && hasSkill(s, 'doble')) {
          p.airJumps++;
          p.buffer = 0;
          this.jump(PHYS.doubleV);
          this.emit({ t: 'parts', x: cx(p), y: p.y + p.h, color: '#f4efe1', n: 6 });
        }
        if (!inp.jump && p.vy < PHYS.cutV && !p.pound) p.vy = PHYS.cutV;
      }

      // Ataques
      if (inp.attackP && p.attackT === 0) {
        p.attackT = 16;
        p.attackHit.clear();
        this.sound('swing');
      }
      if (inp.castP && p.castCd === 0) this.castSpell(s.spell);
      if (inp.dashP && p.dashCd === 0 && !p.airDash && hasSkill(s, 'embestida') && !cart) {
        if (this.spendMp(3)) {
          p.dashT = 14;
          p.dashCd = 30;
          p.dashHit.clear();
          p.pound = false;
          if (!p.ground) p.airDash = true;
          if (inp.left) p.face = -1;
          if (inp.right) p.face = 1;
          this.sound('dash');
          return;
        }
      }
      if (inp.healP && hasSkill(s, 'rearmarse') && (p.ground || water) && s.hp < st.maxHp) {
        if (this.spendMp(6)) {
          p.healT = 30;
          p.attackT = 0;
          this.sound('magic');
          return;
        }
      }
      if (inp.rainP && hasSkill(s, 'lluvia')) this.skullRain();
      // Palanca a mano
      if (inp.upP) this.leverAt(this.boxTiles(p));
    }

    // Golpe de fémur: fotogramas activos del 12 al 6
    if (p.attackT <= 12 && p.attackT >= 6) {
      const hb = this.attackBox();
      const elem = ITEMS[s.weapon]?.elem ?? 'fisico';
      for (const e of this.enemies) {
        if (e.dead || !e.active || p.attackHit.has(e) || !overlap(hb, e)) continue;
        p.attackHit.add(e);
        this.damageEnemy(e, st.atk, p.face, elem);
      }
      if (p.attackT === 10) {
        const tiles = this.boxTiles(hb);
        for (const [tx, ty] of tiles) {
          const c = this.tile(tx, ty);
          if (c === 'B') this.breakBrick(tx, ty);
          else if (c === 'R') this.crack(tx, ty, 1);
        }
        this.leverAt(tiles);
      }
    }

    this.applyGravityAndMove(inp, control);
  }

  boxTiles(b: Box): [number, number][] {
    const out: [number, number][] = [];
    for (let ty = Math.floor(b.y / T); ty <= Math.floor((b.y + b.h - 0.01) / T); ty++)
      for (let tx = Math.floor(b.x / T); tx <= Math.floor((b.x + b.w - 0.01) / T); tx++) out.push([tx, ty]);
    return out;
  }

  attackBox(): Box {
    const p = this.player;
    return { x: p.face > 0 ? p.x + p.w - 2 : p.x - 20, y: p.y + 1, w: 22, h: 16 };
  }

  jump(v: number) {
    const p = this.player;
    p.vy = v;
    p.ground = false;
    p.coyote = 0;
    p.buffer = 0;
    p.onPlat = null;
    this.sound('jump');
  }

  onOneWay() {
    const p = this.player;
    if (p.onPlat) return false;
    const ty = Math.floor((p.y + p.h + 1) / T);
    const l = Math.floor(p.x / T);
    const r = Math.floor((p.x + p.w - 0.01) / T);
    let one = false;
    for (let tx = l; tx <= r; tx++) {
      if (this.solidAt(tx, ty)) return false;
      if (ONE_WAY.has(this.tile(tx, ty))) one = true;
    }
    return one;
  }

  applyGravityAndMove(inp: Input, control: boolean) {
    const p = this.player;
    if (this.def.water) p.vy = Math.min(p.vy + PHYS.wG, PHYS.wMaxFall);
    else if (p.pound) p.vy = Math.min(p.vy + 0.9, 9);
    else p.vy = Math.min(p.vy + PHYS.g, PHYS.maxFall);
    if (this.moveX(p)) {
      if (this.def.type === 'carro' && Math.abs(p.vx) > 1.5) this.hurtFixed(Math.max(1, Math.round(stats(this.save).maxHp * 0.1)), p.x + p.w + 10);
      p.vx = 0;
    }
    // Viento
    if (this.wind) {
      const own = p.vx;
      p.vx = this.wind * (p.ground ? 0.45 : 0.9);
      this.moveX(p);
      p.vx = own;
    }
    this.moveYPlayer(control && inp.down && this.onOneWay());
    // Bordes de la zona
    const r = this.region;
    if (p.y < r.y0 * T) {
      p.y = r.y0 * T;
      if (p.vy < 0) p.vy = 0;
    }
    p.x = clamp(p.x, r.x0 * T, r.x1 * T - p.w);
  }

  moveYPlayer(drop: boolean) {
    const p = this.player;
    const oldBottom = p.y + p.h;
    const res = this.moveY(p, drop, true);
    // Plataformas móviles y monstruos congelados (solo desde arriba)
    p.onPlat = null;
    if (p.vy >= 0 && !res.floor) {
      for (const pl of this.plats) {
        if (p.x + p.w > pl.x && p.x < pl.x + pl.w && oldBottom <= pl.y - pl.dy + 1 && p.y + p.h >= pl.y) {
          p.y = pl.y - p.h;
          p.vy = 0;
          p.ground = true;
          p.onPlat = pl;
          break;
        }
      }
      if (!p.ground)
        for (const e of this.enemies) {
          if (e.frozen <= 0 || e.dead) continue;
          if (p.x + p.w > e.x && p.x < e.x + e.w && oldBottom <= e.y + 1 && p.y + p.h >= e.y) {
            p.y = e.y - p.h;
            p.vy = 0;
            p.ground = true;
            break;
          }
        }
    }
    if (res.ceil.length) this.bumpCeiling(res.ceil);
    if (p.ground) {
      if (p.pound) this.poundLand();
      p.airT = 0;
      const ty = Math.floor((p.y + p.h + 1) / T);
      const l = Math.floor(p.x / T);
      const r = Math.floor((p.x + p.w - 0.01) / T);
      // Tablones que se caen
      for (let tx = l; tx <= r; tx++) if (this.tile(tx, ty) === 'V' && !this.crumbling.has(key(tx, ty))) this.crumbling.set(key(tx, ty), 32);
      // Último sitio seguro: suelo firme bajo los dos pies y sin pinchos
      const firm = (x: number) => this.solidAt(x, ty) || '-=Cv'.includes(this.tile(x, ty));
      if (!p.onPlat && firm(l) && firm(r) && this.tile(l, ty - 1) !== '^' && this.tile(r, ty - 1) !== '^' && this.tile(l, ty) !== 'V')
        this.lastSafe = { x: p.x, y: p.y };
    } else p.airT++;
  }

  bumpCeiling(tiles: [number, number][]) {
    const p = this.player;
    // La casilla más centrada sobre la cabeza
    tiles.sort((a, b) => Math.abs((a[0] + 0.5) * T - cx(p)) - Math.abs((b[0] + 0.5) * T - cx(p)));
    const [tx, ty] = tiles[0];
    const c = this.tile(tx, ty);
    if (c === '?' || c === 'i') {
      this.setTile(tx, ty, 'U');
      this.addCoins(1, tx * T + 9, ty * T);
      this.pops.push({ x: tx * T + 9, y: ty * T - 4, vy: -4, t: 24 });
      this.sound('coin');
    } else if (c === 'Q') {
      this.setTile(tx, ty, 'U');
      this.pickups.push({ kind: 'heart', x: tx * T + 3, y: ty * T - 14, w: 12, h: 12, vy: -3 });
      this.sound('bump');
    } else if (c === 'B') {
      this.breakBrick(tx, ty);
    } else this.sound('bump');
    // Golpear un bloque daña a quien esté encima
    for (const e of this.enemies)
      if (!e.dead && !e.boss && e.ground && Math.abs(e.y + e.h - ty * T) < 2 && e.x < (tx + 1) * T && e.x + e.w > tx * T)
        this.damageEnemy(e, stats(this.save).atk, Math.sign(cx(e) - cx(p)) || 1);
  }

  breakBrick(tx: number, ty: number) {
    this.setTile(tx, ty, '.');
    this.sound('break');
    this.emit({ t: 'parts', x: tx * T + 9, y: ty * T + 9, color: '#b5643c', n: 10 });
  }

  /** Golpea un muro agrietado (o un ladrillo). Con 3 golpes se rompe. */
  crack(tx: number, ty: number, n: number) {
    const c = this.tile(tx, ty);
    if (c === 'B') {
      this.breakBrick(tx, ty);
      return;
    }
    if (c !== 'R') return;
    const k = key(tx, ty);
    const hits = (this.cracks.get(k) ?? 0) + n;
    if (hits >= 3) {
      this.cracks.delete(k);
      this.setTile(tx, ty, '.');
      this.sound('break');
      this.emit({ t: 'parts', x: tx * T + 9, y: ty * T + 9, color: '#9a8c7a', n: 12 });
      this.shake = Math.max(this.shake, 4);
    } else {
      this.cracks.set(k, hits);
      this.sound('crack');
      this.emit({ t: 'parts', x: tx * T + 9, y: ty * T + 9, color: '#9a8c7a', n: 4 });
    }
  }

  /** Mueve las palancas de esas casillas. */
  leverAt(tiles: [number, number][]) {
    if (this.leverCd > 0) return;
    for (const [tx, ty] of tiles)
      if (this.tile(tx, ty) === 'l') {
        this.switchOn = !this.switchOn;
        this.leverCd = 24;
        this.sound('lever');
        this.float(tx * T + 9, ty * T - 6, this.switchOn ? '¡Azul!' : '¡Rojo!', this.switchOn ? '#7fb4ff' : '#ff7a7a');
        this.shake = Math.max(this.shake, 4);
        // Si un bloque aparece encima de Osmo, lo saca hacia arriba
        const p = this.player;
        for (let i = 0; i < 4 && this.boxTiles(p).some(([x, y]) => this.solidAt(x, y)); i++) p.y -= T;
        return;
      }
  }

  tryDoor() {
    const p = this.player;
    const tx = Math.floor(cx(p) / T);
    for (const ty of [Math.floor((p.y + p.h - 2) / T), Math.floor(cy(p) / T)]) {
      const to = this.lvl.doors.get(key(tx, ty));
      if (!to) continue;
      p.x = to.tx * T + (T - p.w) / 2;
      p.y = (to.ty + 1) * T - p.h;
      p.vx = p.vy = 0;
      p.onPlat = null;
      this.doorCd = 30;
      this.region = this.regionAt(cx(p), cy(p));
      this.lastSafe = { x: p.x, y: p.y };
      this.updateCam(true);
      this.sound('door');
      this.emit({ t: 'door' });
      return true;
    }
    return false;
  }

  poundLand() {
    const p = this.player;
    p.pound = false;
    this.shake = 10;
    this.sound('pound');
    const st = stats(this.save);
    this.emit({ t: 'parts', x: cx(p), y: p.y + p.h, color: '#d8c8a8', n: 16 });
    for (const e of this.enemies) {
      if (e.dead || !e.active) continue;
      if (Math.abs(cx(e) - cx(p)) < 52 && Math.abs(e.y + e.h - (p.y + p.h)) < 30) this.damageEnemy(e, st.atk * 1.5, Math.sign(cx(e) - cx(p)) || 1);
    }
    const ty = Math.floor((p.y + p.h + 1) / T);
    for (let tx = Math.floor((p.x - 6) / T); tx <= Math.floor((p.x + p.w + 6) / T); tx++) {
      for (const y of [ty, ty - 1]) if (this.tile(tx, y) === 'B' || this.tile(tx, y) === 'R') this.crack(tx, y, 3);
    }
  }

  spendMp(n: number) {
    if (this.save.mp < n) {
      this.float(cx(this.player), this.player.y - 6, 'Sin PM', '#9fb4ff');
      this.sound('nomp');
      return false;
    }
    this.save.mp -= n;
    return true;
  }

  quickItem(id: string) {
    const r = useItem(this.save, id);
    const p = this.player;
    if (r) {
      this.float(cx(p), p.y - 6, r, id === 'eter' ? '#9fb4ff' : '#7dffa0');
      this.sound('heal');
    } else this.sound('nomp');
  }

  cycleSpell(d: number) {
    const known = knownSpells(this.save);
    if (!known.length) return;
    const i = known.findIndex((k) => k.id === this.save.spell);
    this.save.spell = known[(i + d + known.length) % known.length].id;
    this.sound('move');
    this.float(cx(this.player), this.player.y - 8, SKILL[this.save.spell].name, '#c9c2d9');
  }

  // ── Hechizos ──
  castSpell(id: SkillId) {
    const s = this.save;
    const p = this.player;
    const sk = SKILL[id];
    if (!sk?.spell || !hasSkill(s, id)) return;
    const atk = stats(s).atk;
    const power = atk * (sk.power ?? 1);
    const elem = sk.elem ?? 'fisico';
    const shot = (o: Partial<Proj> & Pick<Proj, 'kind' | 'vx' | 'vy' | 'w' | 'h'>) =>
      this.projs.push({ x: cx(p) - o.w / 2 + p.face * 6, y: p.y + 4, mine: true, power, grav: 0, life: 100, rot: 0, elem, ...o });
    if (id === 'rayo') {
      const targets = this.enemies
        .filter((e) => !e.dead && e.active && !e.hidden && this.onScreen(e))
        .sort((a, b) => Math.hypot(cx(a) - cx(p), cy(a) - cy(p)) - Math.hypot(cx(b) - cx(p), cy(b) - cy(p)));
      if (!targets.length) {
        this.float(cx(p), p.y - 8, 'Sin objetivo', '#c9c2d9');
        this.sound('nomp');
        return;
      }
      if (!this.spendMp(sk.mp)) return;
      p.castCd = 30;
      p.attackT = Math.max(p.attackT, 10);
      const first = targets[0];
      this.strike(first, power);
      const second = targets.find((e) => e !== first && Math.hypot(cx(e) - cx(first), cy(e) - cy(first)) < 120);
      if (second) this.strike(second, power * 0.6);
      this.sound('thunder');
      this.shake = Math.max(this.shake, 6);
      return;
    }
    if (id === 'luz') {
      if (!this.spendMp(sk.mp)) return;
      p.castCd = 40;
      this.emit({ t: 'ring', x: cx(p), y: cy(p), r: 86, color: '#fff6c8' });
      this.sound('holy');
      for (const e of this.enemies)
        if (!e.dead && e.active && Math.hypot(cx(e) - cx(p), cy(e) - cy(p)) < 86 + Math.max(e.w, e.h) / 2) this.damageEnemy(e, power, Math.sign(cx(e) - cx(p)) || 1, 'luz');
      return;
    }
    if (!this.spendMp(sk.mp)) return;
    p.attackT = Math.max(p.attackT, 10);
    if (id === 'hueso') {
      p.castCd = 22;
      shot({ kind: 'bone', w: 8, h: 8, vx: p.face * 4.2 + p.vx * 0.3, vy: -2.6, grav: 0.18 });
      this.sound('throw');
    } else if (id === 'fuego') {
      p.castCd = 24;
      shot({ kind: 'fire', w: 9, h: 9, vx: p.face * 3.4, vy: 1, grav: 0.32, bounce: true, life: 120 });
      this.sound('fire');
    } else if (id === 'hielo') {
      p.castCd = 26;
      shot({ kind: 'ice', w: 10, h: 8, vx: p.face * 4.6, vy: 0, life: 55, freeze: true });
      this.sound('freeze');
    } else if (id === 'tierra') {
      p.castCd = 40;
      this.projs.push({
        x: cx(p) - 6 + p.face * 10, y: p.y + p.h - 14, w: 12, h: 14, vx: p.face * 3.6, vy: 0, mine: true, power, kind: 'spike',
        grav: 0, life: 70, rot: 0, elem, pierce: true, crawl: true, hit: new Set(),
      });
      this.sound('earth');
    }
  }

  strike(e: Enemy, power: number) {
    this.emit({ t: 'bolt', x: cx(e), y0: this.camY - 10, y1: cy(e) });
    this.damageEnemy(e, power, 1, 'rayo');
  }

  skullRain() {
    const targets = this.enemies.filter((e) => !e.dead && e.active && !e.hidden && this.onScreen(e));
    if (!this.spendMp(SKILL.lluvia.mp)) return;
    const atk = stats(this.save).atk;
    this.rainT = 50;
    this.sound('magic');
    targets.forEach((e, i) => {
      this.projs.push({
        x: cx(e) - 5, y: this.camY - 20 - i * 14, w: 10, h: 10, vx: 0, vy: 5, mine: true, power: atk * 2, kind: 'skull',
        grav: 0.1, life: 160, rot: 0, ghost: true, target: e, elem: 'fisico',
      });
    });
    for (let i = 0; i < 8; i++) {
      this.projs.push({
        x: this.camX + this.rng.range(0, VIEW_W), y: this.camY - 20 - this.rng.range(0, 80), w: 10, h: 10, vx: 0, vy: 4,
        mine: true, power: atk * 2, kind: 'skull', grav: 0.1, life: 120, rot: 0, ghost: true, elem: 'fisico',
      });
    }
  }

  addCoins(n: number, x: number, y: number) {
    this.coinsGot += n;
    if (n > 1) this.float(x, y - 8, `+${n}`, '#f2c94c');
  }

  // ── Peligros del escenario ──
  updateHazards() {
    const p = this.player;
    const pb = { x: p.x + 1, y: p.y + 2, w: p.w - 2, h: p.h - 3 };
    for (const b of this.bars) {
      b.ang += b.speed;
      if (Math.abs(b.x - cx(p)) > 120 || Math.abs(b.y - cy(p)) > 120) continue;
      for (let k = 1; k <= b.n; k++) {
        const bx = b.x + Math.cos(b.ang) * k * 8, by = b.y + Math.sin(b.ang) * k * 8;
        if (overlap(pb, { x: bx - 3, y: by - 3, w: 6, h: 6 })) {
          this.hurtPlayer(this.base.atk, bx);
          break;
        }
      }
    }
    for (const cn of this.cannons) {
      if (--cn.timer > 0) continue;
      cn.timer = 170;
      const x = cn.tx * T + 9, y = cn.ty * T + 9;
      const dx = cx(p) - x;
      if (Math.abs(dx) > 300 || Math.abs(cy(p) - y) > 150 || Math.abs(dx) < 20) continue;
      const dir = Math.sign(dx);
      this.projs.push({ x: x - 5 + dir * 10, y: y - 5, w: 10, h: 10, vx: dir * 2.4, vy: 0, mine: false, power: this.base.atk, kind: 'bullet', grav: 0, life: 220, rot: 0, elem: 'fisico', ghost: true });
      this.sound('pound');
    }
    // Lava que sube
    if (this.lavaY < Infinity && p.y + p.h > this.lavaY + 4 && this.state === 'play') {
      p.vy = -9;
      p.ground = false;
      p.onPlat = null;
      this.sound('splash');
      this.emit({ t: 'parts', x: cx(p), y: this.lavaY, color: '#ff8030', n: 12 });
      if (p.inv <= 0) this.hurtFixed(Math.max(1, Math.round(stats(this.save).maxHp * 0.2)), cx(p), true);
    }
  }

  // ── Recogida, pinchos, agua, meta ──
  updatePickups() {
    const p = this.player;
    for (const pop of this.pops) {
      pop.y += pop.vy;
      pop.vy += 0.4;
      pop.t--;
    }
    this.pops = this.pops.filter((q) => q.t > 0);
    for (const k of this.pickups) {
      const a = k as unknown as Actor;
      k.vy = Math.min(k.vy + 0.3, 5);
      a.vx = 0;
      this.moveY(a);
    }
    const st = stats(this.save);
    const heal = () => {
      const before = this.save.hp;
      this.save.hp = Math.min(st.maxHp, this.save.hp + Math.round(st.maxHp * 0.3));
      this.float(cx(p), p.y - 4, `+${this.save.hp - before}`, '#7dffa0');
      this.sound('heal');
    };
    this.pickups = this.pickups.filter((k) => {
      if (!overlap(k, p)) return true;
      heal();
      return false;
    });

    for (const [tx, ty] of this.boxTiles(p)) {
      const c = this.tile(tx, ty);
      if (c === 'o') {
        this.setTile(tx, ty, '.');
        this.addCoins(1, tx * T + 9, ty * T);
        this.sound('coin');
      } else if (c === 'g') {
        this.setTile(tx, ty, '.');
        this.addCoins(10, tx * T + 9, ty * T);
        this.sound('gem');
      } else if (c === 'h') {
        this.setTile(tx, ty, '.');
        heal();
      } else if (c === 'k') {
        this.setTile(tx, ty, '.');
        this.keys++;
        this.float(cx(p), p.y - 10, '¡Llave!', '#f2c94c');
        this.sound('key');
      } else if (c === 'Y') {
        const k = key(tx, ty);
        if (!this.revealed.has(k)) {
          // Descubre todo el muro falso de golpe
          const stack = [[tx, ty]];
          let first = this.revealed.size === 0 || ![...this.revealed].some((r) => r === k);
          while (stack.length) {
            const [x, y] = stack.pop()!;
            const kk = key(x, y);
            if (this.revealed.has(kk) || this.tile(x, y) !== 'Y') continue;
            this.revealed.add(kk);
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
          }
          if (first) {
            this.sound('secret');
            first = false;
          }
        }
      }
    }
    // Cerraduras: basta con tocarlas llevando una llave
    if (this.keys > 0) {
      for (const [tx, ty] of this.boxTiles({ x: p.x - 3, y: p.y - 2, w: p.w + 6, h: p.h + 4 }))
        if (this.tile(tx, ty) === 'L') {
          this.unlock(tx, ty);
          break;
        }
    }
  }

  unlock(tx: number, ty: number) {
    this.keys--;
    const stack = [[tx, ty]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (this.tile(x, y) !== 'L') continue;
      this.setTile(x, y, '.');
      this.emit({ t: 'parts', x: x * T + 9, y: y * T + 9, color: '#f2c94c', n: 4 });
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    this.sound('unlock');
    this.float(tx * T + 9, ty * T - 6, '¡Abierto!', '#f2c94c');
  }

  triggers() {
    const p = this.player;
    const st = stats(this.save);
    for (const [tx, ty] of this.boxTiles(p)) {
      const c = this.tile(tx, ty);
      if (c === 'K' && !this.flags.has(key(tx, ty))) {
        this.flags.add(key(tx, ty));
        this.checkpoint = { x: tx * T + (T - p.w) / 2, y: (ty + 1) * T - p.h };
        this.checkCoins = this.coinsGot;
        this.float(cx(p), p.y - 10, '¡Punto de control!', '#f2c94c');
        this.sound('checkpoint');
      } else if (c === 'S' && p.vy >= 0 && p.y + p.h >= ty * T + 8) {
        p.vy = this.def.water ? -5 : PHYS.springV;
        p.ground = false;
        p.onPlat = null;
        p.pound = false;
        p.airJumps = 0;
        p.airDash = false;
        this.springs.set(key(tx, ty), 12);
        this.sound('spring');
      } else if (c === 'G' && !this.boss) {
        this.win('n');
        return;
      } else if (c === 'H') {
        this.win('s');
        return;
      }
    }
    // Pinchos: al estar de pie sobre ellos o tocarlos
    const feet = Math.floor((p.y + p.h - 2) / T);
    const l = Math.floor(p.x / T), r = Math.floor((p.x + p.w - 0.01) / T);
    for (let tx = l; tx <= r; tx++) {
      if (this.tile(tx, feet) === '^' && p.y + p.h > feet * T + 8) {
        this.hurtFixed(Math.max(1, Math.round(st.maxHp * 0.15)), (tx + 0.5) * T);
        break;
      }
    }
    // Agua mala, lava o abismo
    const midTile = this.tile(Math.floor(cx(p) / T), Math.floor((p.y + p.h - 4) / T));
    if (midTile === '~' || p.y > this.region.y1 * T + 24) {
      this.sound('splash');
      const lava = this.def.look === 'castillo' || this.def.look === 'cueva';
      this.hurtFixed(Math.max(1, Math.round(st.maxHp * (lava && midTile === '~' ? 0.3 : 0.2))), cx(p), true);
      if (this.state === 'play') {
        p.x = this.lastSafe.x;
        p.y = this.lastSafe.y;
        p.vx = p.vy = 0;
        p.pound = false;
        p.dashT = 0;
        p.inv = 90;
        this.region = this.regionAt(cx(p), cy(p));
        this.updateCam(true);
      }
    }
    // Sala del jefe
    const arena = this.lvl.arena;
    if (arena && !this.gateClosed && !this.bossDone && p.x > (arena.x0 + 3) * T) this.startBoss();
  }

  startBoss() {
    const sp = this.lvl.spawns.find((s) => s.kind === 'boss');
    if (!sp) return;
    this.gateClosed = true;
    const b = this.addEnemy(sp.id, sp.tx, sp.ty);
    b.active = true;
    b.state = 'intro';
    b.timer = 70;
    if (b.def.boss?.base !== 'suelo') b.y = 4 * T;
    this.boss = b;
    this.emit({ t: 'boss', name: b.def.name });
    this.sound('boss');
    this.shake = 20;
  }

  win(exit: 'n' | 's') {
    this.state = 'clear';
    this.stateT = 0;
    this.exit = exit;
    this.player.vx = 0;
    this.save.coins += this.coinsGot;
    this.sound('clear');
    if (exit === 's') this.emit({ t: 'banner', text: '¡Salida secreta!', color: '#c890ff' });
    this.emit({ t: 'clear' });
  }

  // ── Daño ──
  calcDmg(power: number, def: number) {
    const v = power * this.rng.range(0.9, 1.1) - def * 0.5;
    return Math.max(1, Math.round(v));
  }

  damageEnemy(e: Enemy, power: number, dir: number, elem: Element = 'fisico', freeze = false) {
    if (e.dead || e.state === 'intro' || e.hidden) return false;
    const d = e.def;
    let mult = 1;
    let tag = '';
    if (d.immune?.includes(elem)) {
      if (e.tagT <= 0) {
        this.float(cx(e), e.y - 2, 'Inmune', '#a0a0b0');
        e.tagT = 30;
      }
      this.sound('bump');
      return false;
    }
    if (d.weak?.includes(elem)) {
      mult = 2;
      tag = '¡Débil!';
    } else if (d.resist?.includes(elem)) {
      mult = 0.5;
      tag = 'Resiste';
    }
    if (e.frozen > 0) mult *= 1.25;
    const dmg = this.calcDmg(power * mult, e.dfn);
    e.hp -= dmg;
    e.flash = 10;
    this.float(cx(e), e.y - 2, String(dmg), mult > 1 ? '#ffb040' : mult < 1 ? '#b0b0c0' : '#ffe066');
    if (tag && e.tagT <= 0) {
      this.float(cx(e), e.y - 14, tag, mult > 1 ? '#ff9040' : '#a0a0b0');
      e.tagT = 40;
    }
    this.sound(mult > 1 ? 'weak' : 'hit');
    if (elem === 'fuego' && e.frozen > 0) e.frozen = 0;
    if (freeze && !e.boss && e.hp > 0 && !d.resist?.includes('hielo')) {
      e.frozen = 240;
      e.vx = 0;
      this.emit({ t: 'parts', x: cx(e), y: cy(e), color: '#bfefff', n: 8 });
    }
    if (!e.boss && !d.heavy && e.frozen <= 0 && d.behavior !== 'thwomp' && d.behavior !== 'dropper') {
      e.vx = dir * 2;
      if (e.ground) e.vy = -2;
      if (d.behavior === 'hopper' || d.behavior === 'walker' || d.behavior === 'roller') e.timer = Math.max(e.timer, 20);
      if (d.behavior === 'charger') {
        e.state = 'tired';
        e.timer = 40;
      }
    }
    if (e.hp <= 0) this.killEnemy(e);
    return true;
  }

  killEnemy(e: Enemy, reward = true) {
    e.dead = true;
    e.deadT = e.boss ? 120 : 24;
    e.hp = 0;
    e.frozen = 0;
    this.emit({ t: 'parts', x: cx(e), y: cy(e), color: e.boss ? '#ff7050' : '#e8e0ff', n: e.boss ? 40 : e.def.size === 'G' ? 24 : 12 });
    if (e.boss) {
      this.shake = 40;
      this.sound('die');
    } else this.sound('stomp');
    if (!reward || e.minion) return;
    this.kills++;
    this.save.kills++;
    if (e.gold) this.addCoins(e.gold, cx(e), e.y);
    if (e.xp) {
      this.xpGot += e.xp;
      this.float(cx(e), e.y - 12, `+${e.xp} XP`, '#9fd0ff');
      const ups = gainXp(this.save, e.xp);
      for (const u of ups) {
        this.emit({ t: 'levelup', level: u.level, skills: u.skills });
        this.sound('levelup');
      }
    }
    if (e.boss) {
      this.bossDone = true;
      if (e.def.id === 'rey_diablo') this.save.won = true;
      // Los secuaces se desvanecen con el jefe
      for (const m of this.enemies) if (m !== e && !m.dead) this.killEnemy(m, false);
      this.projs = this.projs.filter((q) => q.mine);
    }
  }

  hurtPlayer(power: number, fromX: number) {
    const p = this.player;
    if (p.inv > 0 || p.dashT > 0 || this.state !== 'play') return;
    let dmg = this.calcDmg(power, stats(this.save).def);
    if (hasSkill(this.save, 'acero')) dmg = Math.max(1, Math.round(dmg * 0.75));
    this.applyHurt(dmg, fromX);
  }

  hurtFixed(dmg: number, fromX: number, force = false) {
    const p = this.player;
    if (!force && (p.inv > 0 || p.dashT > 0)) return;
    if (this.state !== 'play') return;
    this.applyHurt(dmg, fromX);
  }

  applyHurt(dmg: number, fromX: number) {
    const p = this.player;
    this.save.hp -= dmg;
    p.inv = 70;
    p.hurtT = 16;
    p.healT = 0;
    p.pound = false;
    p.vx = (cx(p) < fromX ? -1 : 1) * 2.8;
    p.vy = this.def.water ? -1.5 : -3.5;
    p.ground = false;
    p.onPlat = null;
    this.float(cx(p), p.y - 4, String(dmg), '#ff5a5a');
    this.sound('hurt');
    this.shake = Math.max(this.shake, 6);
    if (this.save.hp <= 0) {
      this.save.hp = 0;
      this.state = 'dead';
      this.stateT = 0;
      this.save.deaths++;
      p.vx = 0;
      this.sound('die');
      this.emit({ t: 'dead' });
    }
  }

  // ── Choques jugador-enemigo ──
  collide() {
    const p = this.player;
    const st = stats(this.save);
    for (const e of this.enemies) {
      if (e.dead || !e.active || e.hidden || e.frozen > 0 || e.state === 'intro' || !overlap(p, e)) continue;
      // Embestida: golpea y atraviesa
      if (p.dashT > 0) {
        if (!p.dashHit.has(e)) {
          p.dashHit.add(e);
          this.damageEnemy(e, st.atk, p.face);
        }
        continue;
      }
      const prevBottom = p.y + p.h - p.vy;
      const stomp = p.vy > 0 && prevBottom <= e.y + 7 && !this.def.water;
      if (stomp) {
        if (e.spikyNow) {
          this.hurtPlayer(e.atk, cx(e));
          continue;
        }
        const power = p.pound ? st.atk * 1.5 : st.atk * 1.2;
        const wasPound = p.pound;
        p.pound = false;
        if (!e.def.stompImmune) this.damageEnemy(e, power, Math.sign(cx(e) - cx(p)) || 1);
        else this.sound('bump');
        p.y = e.y - p.h;
        p.vy = wasPound ? -5 : PHYS.jumpV * 0.75;
        p.airJumps = 0;
        p.airDash = false;
        p.inv = Math.max(p.inv, 6);
        continue;
      }
      this.hurtPlayer(e.atk, cx(e));
    }
  }

  // ── Proyectiles ──
  updateProjs() {
    const p = this.player;
    const fresh: Proj[] = [];
    for (const q of this.projs) {
      q.life--;
      if (q.kind === 'warn') {
        if (q.life <= 0) {
          // El aviso se convierte en un rayo que cae de arriba abajo
          const a = this.arenaBox();
          fresh.push({ x: q.x + q.w / 2 - 8, y: a.top, w: 16, h: a.floor - a.top, vx: 0, vy: 0, mine: false, power: q.power, kind: 'bolt', grav: 0, life: 18, rot: 0, elem: 'rayo', ghost: true });
          this.sound('thunder');
          this.shake = Math.max(this.shake, 5);
        }
        continue;
      }
      q.vy += q.grav;
      q.rot += q.kind === 'bone' ? 0.35 : 0.1;
      if (q.target && !q.target.dead) q.x += (cx(q.target) - 5 - q.x) * 0.15;
      if (q.crawl) {
        this.crawl(q);
        if (q.life <= 0) continue;
      } else {
        q.x += q.vx;
        q.y += q.vy;
      }
      if (!q.ghost && !q.crawl) {
        const tx = Math.floor((q.x + q.w / 2) / T), ty = Math.floor((q.y + q.h / 2) / T);
        if (this.solidAt(tx, ty)) {
          const c = this.tile(tx, ty);
          if (q.mine && (c === 'B' || c === 'R')) this.crack(tx, ty, q.kind === 'bone' ? 1 : 3);
          if (q.mine && (q.kind === 'bone' || q.kind === 'fire')) this.leverAt([[tx, ty]]);
          if (q.bounce && q.vy > 0 && q.y + q.h / 2 - q.vy < ty * T + 2) {
            q.y = ty * T - q.h / 2 - 1 - q.h / 2;
            q.vy = -3.2;
          } else if (q.kind === 'wave' && q.vy >= 0) {
            q.y = ty * T - q.h;
            q.vy = 0;
          } else {
            q.life = 0;
            this.emit({ t: 'parts', x: q.x + q.w / 2, y: q.y + q.h / 2, color: q.mine ? '#f4efe1' : '#ff9040', n: 4 });
          }
        } else if (q.mine && this.tile(tx, ty) === 'l') this.leverAt([[tx, ty]]);
      }
      if (q.y > this.region.y1 * T + 40 || q.y < this.region.y0 * T - 200) q.life = 0;
      if (q.life <= 0) continue;
      if (q.mine) {
        for (const e of this.enemies) {
          if (e.dead || !e.active || e.hidden || !overlap(q, e)) continue;
          if (q.target && q.target !== e && !q.target.dead) continue;
          if (q.pierce) {
            if (q.hit!.has(e)) continue;
            if (e.def.behavior === 'flyer' || e.def.behavior === 'cloud') continue;
            q.hit!.add(e);
            this.damageEnemy(e, q.power, Math.sign(q.vx) || 1, q.elem);
            continue;
          }
          this.damageEnemy(e, q.power, Math.sign(q.vx) || 1, q.elem, q.freeze);
          q.life = 0;
          break;
        }
      } else if (overlap(q, p) && this.state === 'play') {
        if (p.inv <= 0 && p.dashT <= 0) {
          this.hurtPlayer(q.power, q.x + q.w / 2);
          if (q.kind !== 'bolt') q.life = 0;
        }
      }
    }
    this.projs = this.projs.filter((q) => q.life > 0).concat(fresh);
  }

  /** Las lanzas de tierra avanzan pegadas al suelo y derriban muros. */
  crawl(q: Proj) {
    q.x += q.vx;
    const front = Math.floor((q.vx > 0 ? q.x + q.w : q.x) / T);
    const row = Math.floor((q.y + q.h - 2) / T);
    for (const y of [row, row - 1]) {
      const c = this.tile(front, y);
      if (c === 'R' || c === 'B') this.crack(front, y, 3);
    }
    if (this.solidAt(front, row)) {
      q.life = 0;
      return;
    }
    const below = this.tile(Math.floor((q.x + q.w / 2) / T), row + 1);
    if (!this.solidAt(Math.floor((q.x + q.w / 2) / T), row + 1) && !ONE_WAY.has(below)) q.life = 0;
    if (q.life % 4 === 0) this.emit({ t: 'parts', x: q.x + q.w / 2, y: q.y + q.h, color: '#c8a060', n: 2 });
  }

  enemyShot(e: Enemy, kind: ProjKind, vx: number, vy: number, grav = 0, power = e.atk, w = 8, h = 8) {
    const wave = kind === 'wave';
    this.projs.push({
      x: cx(e) - w / 2, y: wave ? e.y + e.h - h : cy(e) - h / 2, w, h, vx, vy: wave ? 0 : vy, mine: false, power, kind,
      grav: wave ? 0 : grav, life: wave ? 120 : 240, rot: 0, ghost: wave || kind === 'bolt', elem: 'fisico',
    });
  }

  aimShot(e: Enemy, kind: ProjKind, speed: number, spread = 0, size = 10) {
    const p = this.player;
    const dx = cx(p) - cx(e), dy = cy(p) - cy(e);
    const ang = Math.atan2(dy, dx) + spread;
    this.enemyShot(e, kind, Math.cos(ang) * speed, Math.sin(ang) * speed, 0, e.atk, size, size);
  }

  // ── Enemigos ──
  updateEnemies() {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) {
        e.deadT--;
        if (e.boss && e.deadT % 8 === 0) this.emit({ t: 'parts', x: e.x + this.rng.range(0, e.w), y: e.y + this.rng.range(0, e.h), color: '#ffb050', n: 6 });
        if (e.boss && e.deadT === 0 && this.state === 'play') this.win('n');
        continue;
      }
      if (!e.active) {
        if (!this.onScreen(e, 30)) continue;
        e.active = true;
      }
      if (!this.onScreen(e, 260)) continue;
      e.t++;
      if (e.flash > 0) e.flash--;
      if (e.tagT > 0) e.tagT--;
      if (this.state !== 'play' && !e.boss) continue;
      if (e.frozen > 0) {
        e.frozen--;
        e.vx = 0;
        const b = e.def.behavior;
        if (b !== 'flyer' && b !== 'swimmer' && b !== 'jelly' && b !== 'puffer' && b !== 'ghost' && b !== 'cloud' && b !== 'dropper') this.gravity(e);
        continue;
      }
      const dx = cx(p) - cx(e);
      const dy = cy(p) - cy(e);
      switch (e.def.behavior) {
        case 'walker':
        case 'roller':
          this.walk(e, e.def.speed);
          if (e.def.shot) this.walkShoot(e, dx, dy);
          break;
        case 'hopper':
          this.hop(e, dx);
          break;
        case 'flyer':
          this.fly(e, dx, dy);
          break;
        case 'ghost': {
          const d = Math.hypot(dx, dy) || 1;
          const facingMe = Math.sign(dx) === -p.face; // el jugador le mira
          if (d < 220 && !facingMe) {
            e.x += (dx / d) * e.def.speed;
            e.y += (dy / d) * e.def.speed;
          }
          e.face = dx < 0 ? -1 : 1;
          break;
        }
        case 'thwomp':
          this.thwomp(e, dx, p);
          break;
        case 'dropper':
          this.dropper(e, dx, p);
          break;
        case 'shooter':
          this.shooter(e, dx, dy);
          break;
        case 'plant':
          this.plant(e, dx, dy);
          break;
        case 'charger':
          this.charger(e, dx, dy);
          break;
        case 'swimmer':
          this.swim(e, dx, dy);
          break;
        case 'puffer':
          this.puffer(e, dx, dy);
          break;
        case 'jelly':
          this.jelly(e, dx, dy);
          break;
        case 'burrower':
          this.burrow(e, dx);
          break;
        case 'cloud':
          this.cloud(e, dx);
          break;
        case 'boss':
          this.updateBoss(e, dx, dy);
          break;
      }
      if (this.lavaY < Infinity && e.y > this.lavaY + 10 && !e.boss) this.killEnemy(e, false);
      if (e.y > e.floorY + 40 && !e.boss) this.killEnemy(e, false);
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.deadT > 0);
  }

  gravity(e: Enemy) {
    const w = this.def.water;
    e.vy = Math.min(e.vy + (w ? 0.14 : PHYS.g), w ? 2 : PHYS.maxFall);
    const hitX = this.moveX(e);
    this.moveY(e);
    return hitX;
  }

  groundAhead(e: Enemy) {
    const fx = e.face > 0 ? e.x + e.w + 1 : e.x - 1;
    const ty = Math.floor((e.y + e.h + 2) / T);
    const tx = Math.floor(fx / T);
    return this.solidAt(tx, ty) || ONE_WAY.has(this.tile(tx, ty));
  }

  walk(e: Enemy, speed: number) {
    if (e.timer > 0 && e.state === 'idle') e.timer--;
    if (e.ground && e.timer <= 0) e.vx = e.face * speed;
    else if (e.ground) e.vx *= 0.8;
    if (this.gravity(e)) e.face = (e.face * -1) as 1 | -1;
    else if (e.ground && !this.groundAhead(e)) {
      e.face = (e.face * -1) as 1 | -1;
      e.vx = 0;
    }
  }

  walkShoot(e: Enemy, dx: number, dy: number) {
    if (e.t % 150 !== 75 || Math.abs(dx) > 180 || Math.abs(dy) > 40) return;
    e.face = dx < 0 ? -1 : 1;
    this.enemyShot(e, e.def.shot!, e.face * 2.6, 0, 0, e.atk, 9, 7);
    this.sound('fire');
  }

  hop(e: Enemy, dx: number) {
    if (e.ground) {
      e.vx *= 0.7;
      if (--e.timer <= 0 && Math.abs(dx) < 200) {
        e.face = dx < 0 ? -1 : 1;
        e.vy = (e.def.jump ?? -5) * (this.def.water ? 0.6 : 1);
        e.vx = e.face * e.def.speed;
        e.timer = 70 + this.rng.int(0, 40);
        if (e.def.size === 'G') this.shake = Math.max(this.shake, 2);
      }
    }
    if (this.gravity(e)) e.vx = 0;
  }

  fly(e: Enemy, dx: number, dy: number) {
    const s = e.def.speed;
    if (e.state === 'idle') {
      e.x = e.homeX + Math.sin(e.t * 0.02 * s) * 40;
      e.y = e.homeY + Math.sin(e.t * 0.06) * 6;
      e.face = Math.cos(e.t * 0.02 * s) > 0 ? 1 : -1;
      if (Math.abs(dx) < 110 && dy > -10 && dy < 120 && e.t % 40 === 0) {
        e.state = 'swoop';
        e.timer = 70;
        const d = Math.hypot(dx, dy) || 1;
        e.vx = (dx / d) * s * 2;
        e.vy = (dy / d) * s * 2;
      }
    } else if (e.state === 'swoop') {
      e.x += e.vx;
      e.y += e.vy;
      e.face = e.vx < 0 ? -1 : 1;
      if (--e.timer <= 0) e.state = 'back';
    } else {
      // vuelve a su ruta
      const tx = e.homeX + Math.sin(e.t * 0.02 * s) * 40;
      const ty = e.homeY;
      e.x += (tx - e.x) * 0.04;
      e.y += (ty - e.y) * 0.04;
      if (Math.abs(tx - e.x) < 3 && Math.abs(ty - e.y) < 3) e.state = 'idle';
    }
  }

  thwomp(e: Enemy, dx: number, p: Player) {
    if (e.state === 'wait') {
      if (Math.abs(dx) < 28 && p.y > e.y) {
        e.state = 'fall';
        e.vy = 1;
      }
    } else if (e.state === 'fall') {
      e.vy = Math.min(e.vy + 0.6, 8);
      this.moveY(e);
      if (e.ground) {
        e.state = 'land';
        e.timer = 50;
        if (this.onScreen(e)) this.shake = Math.max(this.shake, 6);
        this.sound('pound');
      }
    } else if (e.state === 'land') {
      if (--e.timer <= 0) e.state = 'rise';
    } else if (e.state === 'rise') {
      e.y = Math.max(e.homeY, e.y - 1);
      if (e.y <= e.homeY) e.state = 'wait';
    }
  }

  dropper(e: Enemy, dx: number, p: Player) {
    if (e.state === 'hang') {
      if (Math.abs(dx) < 26 && p.y > e.y) {
        e.state = 'shake';
        e.timer = 22;
      }
    } else if (e.state === 'shake') {
      if (--e.timer <= 0) e.state = 'fall';
    } else {
      e.vy = Math.min(e.vy + 0.5, 7);
      this.moveY(e);
      if (e.ground) {
        this.emit({ t: 'parts', x: cx(e), y: e.y + e.h, color: '#c0b8d0', n: 8 });
        this.sound('break');
        this.killEnemy(e, false);
      }
    }
  }

  shooter(e: Enemy, dx: number, dy: number) {
    e.face = dx < 0 ? -1 : 1;
    e.vx *= 0.8;
    this.gravity(e);
    if (--e.timer <= 0) {
      e.timer = 110 + this.rng.int(0, 50);
      if (Math.hypot(dx, dy) < 190) {
        this.aimShot(e, e.def.shot ?? 'fire', 2.2, 0, 8);
        this.sound('fire');
      }
    }
  }

  plant(e: Enemy, dx: number, dy: number) {
    e.face = dx < 0 ? -1 : 1;
    this.gravity(e);
    if (--e.timer <= 0) {
      e.timer = 130 + this.rng.int(0, 40);
      if (Math.abs(dx) < 200 && Math.abs(dy) < 120) {
        const t = 50;
        this.enemyShot(e, e.def.shot ?? 'seed', dx / t, -3.4 + dy / t / 2, 0.13, e.atk, 8, 8);
        this.sound('throw');
      }
    }
  }

  charger(e: Enemy, dx: number, dy: number) {
    const big = e.def.size === 'G';
    if (e.state === 'idle') {
      this.walk(e, e.def.speed);
      if (Math.abs(dy) < (big ? 40 : 22) && Math.abs(dx) < 140 && Math.sign(dx) === e.face) {
        e.state = 'wind';
        e.timer = big ? 34 : 24;
      }
    } else if (e.state === 'wind') {
      e.vx = 0;
      this.gravity(e);
      if (--e.timer <= 0) {
        e.state = 'charge';
        e.timer = 70;
      }
    } else if (e.state === 'charge') {
      e.vx = e.face * (big ? 2.8 : e.def.id === 'pinguino' ? 3.9 : 3.4);
      const hit = this.gravity(e);
      if (hit || --e.timer <= 0 || (e.ground && !this.groundAhead(e))) {
        e.state = 'tired';
        e.timer = 50;
        e.vx = 0;
        if (hit && big) this.shake = Math.max(this.shake, 4);
      }
    } else {
      e.vx *= 0.8;
      this.gravity(e);
      if (--e.timer <= 0) {
        e.state = 'idle';
        e.face = dx < 0 ? -1 : 1;
      }
    }
  }

  swim(e: Enemy, dx: number, dy: number) {
    const s = e.def.speed;
    const d = Math.hypot(dx, dy) || 1;
    if (e.def.chase && d < 150) {
      e.vx = clamp(e.vx + Math.sign(dx) * 0.06, -s * 1.3, s * 1.3);
      e.vy = clamp(e.vy + Math.sign(dy) * 0.04, -s, s);
    } else {
      e.vx = e.face * s;
      e.vy = (e.homeY + Math.sin(e.t * 0.05) * 8 - e.y) * 0.1;
      if (Math.abs(e.x - e.homeX) > 6 * T && Math.sign(e.x - e.homeX) === e.face) e.face = (e.face * -1) as 1 | -1;
    }
    if (this.moveX(e)) {
      e.face = (e.face * -1) as 1 | -1;
      e.vx = -e.vx;
    }
    this.moveY(e);
    if (e.vx) e.face = e.vx < 0 ? -1 : 1;
  }

  puffer(e: Enemy, dx: number, dy: number) {
    const cyc = e.t % 240;
    e.state = cyc > 150 ? 'puff' : 'idle';
    const s = e.def.speed * (e.state === 'puff' ? 0.3 : 1);
    const d = Math.hypot(dx, dy) || 1;
    if (d < 180) {
      e.vx = (dx / d) * s;
      e.vy = (dy / d) * s;
    } else {
      e.vx = 0;
      e.vy = (e.homeY - e.y) * 0.02;
    }
    this.moveX(e);
    this.moveY(e);
    e.face = dx < 0 ? -1 : 1;
  }

  jelly(e: Enemy, dx: number, dy: number) {
    if (e.t % 70 === 0 && dy < 20) {
      e.vy = -1.8;
      e.vx = clamp(dx * 0.01, -0.6, 0.6);
    }
    e.vy = Math.min(e.vy + 0.03, 0.5);
    e.vx *= 0.99;
    this.moveX(e);
    this.moveY(e);
  }

  burrow(e: Enemy, dx: number) {
    if (e.state === 'under') {
      e.hidden = true;
      e.vx = Math.sign(dx) * e.def.speed * 0.9;
      e.face = dx < 0 ? -1 : 1;
      this.gravity(e);
      if (e.t % 10 === 0) this.emit({ t: 'parts', x: cx(e), y: e.y + e.h, color: '#a08060', n: 1 });
      if (--e.timer <= 0 && Math.abs(dx) < 24) {
        e.state = 'rise';
        e.hidden = false;
        e.vy = this.def.water ? -3 : -6;
        e.vx = 0;
        this.emit({ t: 'parts', x: cx(e), y: e.y + e.h, color: '#a08060', n: 10 });
        this.sound('break');
      }
    } else if (e.state === 'rise') {
      this.gravity(e);
      if (e.ground && e.vy >= 0) {
        e.state = 'out';
        e.timer = 80;
      }
    } else if (e.state === 'out') {
      this.walk(e, e.def.speed * 0.5);
      if (--e.timer <= 0) {
        e.state = 'dig';
        e.timer = 24;
      }
    } else {
      e.vx = 0;
      this.gravity(e);
      if (--e.timer <= 0) {
        e.state = 'under';
        e.hidden = true;
        e.timer = 70;
      }
    }
  }

  cloud(e: Enemy, dx: number) {
    e.vx = clamp(e.vx + Math.sign(dx) * 0.04, -e.def.speed, e.def.speed);
    e.x += e.vx;
    e.y = e.homeY + Math.sin(e.t * 0.05) * 5;
    e.face = dx < 0 ? -1 : 1;
    if (e.t % 120 === 0 && Math.abs(dx) < 30) {
      this.projs.push({ x: cx(e) - 3, y: e.y + e.h, w: 6, h: 14, vx: 0, vy: 4.2, mine: false, power: e.atk, kind: 'bolt', grav: 0, life: 90, rot: 0, elem: 'rayo', ghost: true });
      this.sound('thunder');
    }
  }

  // ── Jefes ──
  arenaBox() {
    const a = this.lvl.arena ?? { x0: Math.floor(this.camX / T), x1: Math.floor(this.camX / T) + 26, y0: 0, y1: 15 };
    return { x0: (a.x0 + 1) * T, x1: (a.x1 - 1) * T, top: a.y0 * T, floor: (a.y1 - 2) * T };
  }
  arenaX(f: number) {
    const a = this.arenaBox();
    return a.x0 + f * (a.x1 - a.x0);
  }

  updateBoss(e: Enemy, dx: number, dy: number) {
    const B = e.def.boss!;
    const a = this.arenaBox();
    const p = this.player;
    const p2 = e.phase === 2;
    const fly = B.base !== 'suelo';
    const minions = () => this.enemies.filter((m) => m.minion && !m.dead).length;
    const idle = () => {
      e.state = 'idle';
      e.timer = p2 ? 28 : 46;
      e.vx = 0;
      e.count = 0;
    };
    if (e.state === 'intro') {
      e.face = dx < 0 ? -1 : 1;
      if (!fly) this.gravity(e);
      if (--e.timer <= 0) {
        e.state = 'idle';
        e.timer = 30;
      }
      return;
    }
    if (e.phase === 1 && e.hp < e.maxHp / 2) {
      e.phase = 2;
      this.float(cx(e), e.y - 16, '¡Se enfurece!', '#ff7050');
      this.shake = 16;
      this.sound('boss');
    }
    const keepIn = () => {
      e.x = clamp(e.x, a.x0, a.x1 - e.w);
      e.y = clamp(e.y, a.top + 4, a.floor - e.h);
    };
    if (e.state === 'idle') {
      e.face = dx < 0 ? -1 : 1;
      if (B.base === 'vuelo') {
        const tx = clamp(cx(p) + Math.sin(e.t * 0.02) * 90, a.x0 + e.w / 2, a.x1 - e.w / 2);
        const ty = a.top + 4 * T + Math.sin(e.t * 0.05) * 12;
        e.x += clamp((tx - cx(e)) * 0.03, -e.def.speed, e.def.speed);
        e.y += clamp((ty - e.y) * 0.05, -2, 2);
        keepIn();
      } else if (B.base === 'nado') {
        e.x += clamp(dx * 0.01, -0.8, 0.8);
        e.y += clamp(dy * 0.01 + Math.sin(e.t * 0.05) * 0.4, -0.8, 0.8);
        keepIn();
      } else {
        e.vx *= 0.8;
        this.gravity(e);
      }
      if (--e.timer <= 0) {
        const opts: BossMove[] = [...B.moves, ...(p2 ? B.moves2 : [])].filter((m) => {
          if (m === 'invocar' && (minions() >= 3 || !B.minion)) return false;
          if (m === 'salto' && fly) return false;
          if (m === 'remolino' && B.base !== 'nado') return false;
          return true;
        });
        let m = opts[this.rng.int(0, opts.length - 1)];
        if (m === e.lastMove && opts.length > 1) m = opts[this.rng.int(0, opts.length - 1)];
        e.lastMove = m;
        e.state = m;
        e.timer = 0;
        e.count = 0;
      }
      return;
    }
    e.timer++;
    const fast = p2 ? 1.25 : 1;
    switch (e.state as BossMove) {
      case 'salto': {
        if (e.timer === 1) {
          e.vy = this.def.water ? -6 : e.count % 2 ? -10 : -8;
          e.vx = Math.sign(dx) * Math.min(3.2, Math.abs(dx) / 30 + 0.5);
          e.face = dx < 0 ? -1 : 1;
        } else if (e.ground && e.vy >= 0 && e.timer > 6) {
          this.shake = 14;
          this.sound('pound');
          this.enemyShot(e, 'wave', -2.8 * fast, 0, 0, e.atk, 12, 10);
          this.enemyShot(e, 'wave', 2.8 * fast, 0, 0, e.atk, 12, 10);
          if (B.rain && p2) for (let i = 0; i < 3; i++) this.rainOne(B.rain, e.atk);
          idle();
          break;
        }
        this.gravity(e);
        break;
      }
      case 'carga': {
        if (!fly) {
          if (e.timer < 30) {
            e.vx = 0;
            e.face = dx < 0 ? -1 : 1;
          } else if (e.count === 0) {
            if (e.timer === 30) this.sound('dash');
            e.vx = e.face * 4.6 * fast;
            if (this.moveXPeek(e) || e.timer > 140) {
              e.count = 1;
              e.timer = 100;
              this.shake = 14;
              this.sound('pound');
              e.vx = 0;
            }
          } else if (e.timer > (p2 ? 135 : 150)) idle();
          this.gravity(e);
        } else {
          if (e.timer < 26) {
            e.face = dx < 0 ? -1 : 1;
          } else if (e.timer === 26) {
            const d = Math.hypot(dx, dy) || 1;
            e.vx = (dx / d) * 4.6 * fast;
            e.vy = (dy / d) * 4.6 * fast;
            this.sound('dash');
          } else {
            e.x += e.vx;
            e.y += e.vy;
            keepIn();
            if (e.timer > 70) idle();
          }
        }
        break;
      }
      case 'disparo': {
        if (!fly) this.gravity(e);
        e.face = dx < 0 ? -1 : 1;
        if (e.timer % (p2 ? 10 : 14) === 0) {
          this.aimShot(e, B.shot, 2.6, (e.count - 1) * 0.18, 10);
          this.sound('fire');
          if (++e.count >= (p2 ? 5 : 3)) idle();
        }
        break;
      }
      case 'abanico': {
        if (!fly) this.gravity(e);
        if (e.timer === 20 || (p2 && e.timer === 50)) {
          const n = p2 ? 7 : 5;
          for (let i = 0; i < n; i++) this.aimShot(e, B.shot, 2.3, (i - (n - 1) / 2) * 0.28, 10);
          this.sound('fire');
        }
        if (e.timer > 70) idle();
        break;
      }
      case 'burbujas': {
        if (!fly) this.gravity(e);
        if (e.timer === 20) {
          const n = p2 ? 5 : 3;
          for (let i = 0; i < n; i++) this.enemyShot(e, B.shot, (Math.sign(dx) || 1) * (1 + i * 0.85), -4.2 - (i % 2) * 0.8, 0.13, e.atk, 10, 10);
          this.sound('fire');
        }
        if (e.timer > 50) idle();
        break;
      }
      case 'invocar': {
        if (!fly) this.gravity(e);
        if (e.timer === 30 && B.minion) {
          const md = MONSTERS[B.minion];
          const air = md.behavior === 'flyer' || md.behavior === 'swimmer' || md.behavior === 'jelly' || md.behavior === 'cloud';
          for (const f of [0.15, 0.85]) {
            const m = this.addEnemy(B.minion, Math.floor(this.arenaX(f) / T), air ? 5 : 12);
            m.minion = true;
            m.active = true;
            this.emit({ t: 'parts', x: cx(m), y: cy(m), color: '#c040ff', n: 12 });
          }
          this.sound('magic');
        }
        if (e.timer > 50) idle();
        break;
      }
      case 'caida': {
        if (e.count === 0) {
          const tx = clamp(cx(p) - e.w / 2, a.x0, a.x1 - e.w);
          e.x += clamp((tx - e.x) * 0.07, -2.4 * fast, 2.4 * fast);
          e.y += (a.top + T - e.y) * 0.08;
          if ((Math.abs(tx - e.x) < 8 && e.timer > 30) || e.timer > 140) {
            e.count = 1;
            e.vy = 0;
          }
        } else if (e.count === 1) {
          e.vy = Math.min(e.vy + 0.7, 9);
          this.moveY(e);
          if (e.ground || e.y >= a.floor - e.h) {
            e.count = 2;
            e.timer = 0;
            this.shake = 18;
            this.sound('pound');
            const n = p2 ? 7 : 4;
            for (let i = 0; i < n; i++) this.rainOne(B.rain ?? 'rock', e.atk, i * 18);
          }
        } else if (e.timer > (p2 ? 45 : 65)) idle();
        break;
      }
      case 'lluvia': {
        if (!fly) this.gravity(e);
        if (e.timer % 9 === 0 && e.timer < 90) this.rainOne(B.rain ?? B.shot, e.atk);
        if (e.timer > 100) idle();
        break;
      }
      case 'tele': {
        if (!fly) this.gravity(e);
        if (e.timer === 20) {
          const left = cx(p) > this.arenaX(0.5);
          e.x = this.arenaX(left ? 0.06 : 0.94) - e.w / 2;
          e.y = fly ? a.top + 3 * T : 4 * T;
          e.vy = 0;
          this.emit({ t: 'parts', x: cx(e), y: cy(e), color: '#c040ff', n: 16 });
          this.sound('magic');
        }
        if (e.timer > 40) idle();
        break;
      }
      case 'rayo': {
        if (e.timer === 10) {
          const n = p2 ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const x = i === 0 ? cx(p) : this.arenaX(this.rng.next());
            this.projs.push({ x: x - 8, y: a.floor - 10, w: 16, h: 10, vx: 0, vy: 0, mine: false, power: e.atk, kind: 'warn', grav: 0, life: 50 + i * 6, rot: 0, elem: 'rayo', ghost: true });
          }
        }
        if (e.timer > 80) idle();
        break;
      }
      case 'remolino': {
        if (e.timer === 20) {
          const d = Math.hypot(dx, dy) || 1;
          e.vx = (dx / d) * 4.2 * fast;
          e.vy = (dy / d) * 4.2 * fast;
          this.sound('dash');
        } else if (e.timer > 20) {
          e.x += e.vx;
          e.y += e.vy;
          if (e.x <= a.x0 || e.x + e.w >= a.x1) e.vx = -e.vx;
          if (e.y <= a.top + 4 || e.y + e.h >= a.floor) e.vy = -e.vy;
          keepIn();
          e.face = e.vx < 0 ? -1 : 1;
          if (e.timer > 90) idle();
        }
        break;
      }
    }
  }

  rainOne(kind: ProjKind, power: number, delay = 0) {
    const a = this.arenaBox();
    this.projs.push({
      x: this.arenaX(this.rng.next()), y: a.top - 12 - delay, w: 10, h: 12, vx: 0, vy: 1.5, mine: false, power, kind, grav: 0.12, life: 220, rot: 0, elem: 'fisico',
    });
  }

  /** ¿Chocaría con una pared al avanzar con su velocidad actual? */
  moveXPeek(e: Enemy) {
    const nx = e.x + e.vx;
    const tx = Math.floor((e.vx > 0 ? nx + e.w : nx) / T);
    for (let ty = Math.floor(e.y / T); ty <= Math.floor((e.y + e.h - 1) / T); ty++) if (this.solidAt(tx, ty)) return true;
    return false;
  }
}
