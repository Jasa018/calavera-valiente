// Simulación de un nivel a 60 fotogramas por segundo. No usa DOM ni canvas:
// `scripts/sim.ts` la ejecuta en Node. Avisa a la interfaz con `events`.
import { MONSTERS, type MonsterDef } from '../data/monsters';
import { LEVELS, WORLDS, type LevelDef, type WorldDef } from '../data/worlds';
import { buildLevel, type BuiltLevel } from './level';
import { gainXp, hasSkill, stats, useItem, type Save } from './progress';
import { Rng } from './rng';
import { type GameEvent, type Input, ROWS, TILE as T, VIEW_W } from './types';

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
  throwCd = 0;
  dashT = 0;
  dashCd = 0;
  dashHit = new Set<Enemy>();
  pound = false;
  healT = 0;
  onPlat: Platform | null = null;
  anim = 0;
  /** Fotogramas desde que tocó el suelo por última vez (para la animación). */
  airT = 0;
  hidden = false;
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
  /** Invocado por un jefe: no da experiencia ni oro. */
  minion = false;
  constructor(
    public def: MonsterDef,
    x: number,
    y: number,
  ) {
    this.w = def.w;
    this.h = def.h;
    this.x = x;
    this.y = y;
    this.hp = this.maxHp = def.hp;
    this.homeX = x;
    this.homeY = y;
  }
  get boss() {
    return this.def.behavior === 'boss';
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

export type ProjKind = 'bone' | 'fire' | 'bubble' | 'ice' | 'skull' | 'wave';
export interface Proj extends Box {
  vx: number;
  vy: number;
  mine: boolean;
  power: number;
  kind: ProjKind;
  grav: number;
  life: number;
  rot: number;
  /** Atraviesa paredes. */
  ghost?: boolean;
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

export type StageState = 'play' | 'dead' | 'clear';

const SOLID = new Set(['#', 'X', 'B', '?', 'Q', 'U']);

export class Stage {
  readonly def: LevelDef;
  readonly world: WorldDef;
  readonly worldIndex: number;
  readonly lvl: BuiltLevel;
  grid: string[][];
  w: number;
  player = new Player();
  enemies: Enemy[] = [];
  plats: Platform[] = [];
  projs: Proj[] = [];
  pickups: Pickup[] = [];
  pops: Pop[] = [];
  events: GameEvent[] = [];
  camX = 0;
  frame = 0;
  state: StageState = 'play';
  stateT = 0;
  checkpoint: { x: number; y: number } | null = null;
  checkCoins = 0;
  flags = new Set<number>();
  /** Resortes comprimidos: columna → fotogramas. */
  springs = new Map<number, number>();
  lastSafe = { x: 0, y: 0 };
  coinsGot = 0;
  xpGot = 0;
  kills = 0;
  boss: Enemy | null = null;
  bossDone = false;
  gateClosed = false;
  /** Fotogramas de temblor de pantalla restantes. */
  shake = 0;
  rng: Rng;
  mpTick = 0;
  /** Efecto de la lluvia de calaveras. */
  rainT = 0;

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
    this.lvl = buildLevel(this.def, this.world);
    this.grid = this.lvl.grid;
    this.w = this.lvl.w;
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
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < this.w; x++) if (this.grid[y][x] === 'K' && x * T <= p.x + T) this.flags.add(x);
    }
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
    const st = stats(save);
    save.hp = st.maxHp;
    save.mp = st.maxMp;
    this.camX = this.clampCam(p.x - VIEW_W / 2);
  }

  addEnemy(id: string, tx: number, ty: number) {
    const def = MONSTERS[id];
    const e = new Enemy(def, tx * T + (T - def.w) / 2, (ty + 1) * T - def.h);
    if (def.behavior === 'flyer') e.homeY = e.y = ty * T + (T - def.h) / 2;
    if (def.behavior === 'thwomp') {
      // Flota hasta 4 casillas por encima, sin atravesar techo
      let up = 0;
      while (up < 4 && !this.solidAt(tx, ty - up - 1) && ty - up - 1 > 1) up++;
      e.y -= up * T;
      e.homeY = e.y;
      e.state = 'wait';
    }
    e.face = -1;
    this.enemies.push(e);
    return e;
  }

  // ── Casillas ──
  tile(tx: number, ty: number) {
    if (tx < 0 || tx >= this.w) return 'X';
    if (ty < 0 || ty >= ROWS) return '.';
    return this.grid[ty][tx];
  }
  solidAt(tx: number, ty: number) {
    const c = this.tile(tx, ty);
    return SOLID.has(c) || (c === 'W' && this.gateClosed);
  }
  setTile(tx: number, ty: number, c: string) {
    if (tx >= 0 && tx < this.w && ty >= 0 && ty < ROWS) this.grid[ty][tx] = c;
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
  moveY(a: Actor, drop = false): { floor: boolean; ceil: [number, number][] } {
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
        if (this.solidAt(tx, ty) || (c === '-' && !drop && oldBottom <= ty * T + 0.5)) {
          a.y = ty * T - a.h;
          a.vy = 0;
          a.ground = true;
          res.floor = true;
          break;
        }
      }
    } else if (a.vy < 0) {
      const ty = Math.floor(a.y / T);
      for (let tx = l; tx <= r; tx++) if (this.solidAt(tx, ty)) res.ceil.push([tx, ty]);
      if (res.ceil.length) {
        a.y = (ty + 1) * T;
        a.vy = 0;
      }
    }
    return res;
  }

  clampCam(x: number) {
    const arena = this.lvl.arena;
    if (this.gateClosed && arena) {
      return Math.max(arena.x0 * T, Math.min(arena.x1 * T - VIEW_W, x));
    }
    return Math.max(0, Math.min(this.w * T - VIEW_W, x));
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
    this.updatePlats();
    this.updatePlayer(inp);
    this.updateEnemies();
    this.updateProjs();
    this.updatePickups();
    this.collide();
    this.triggers();
    const p = this.player;
    const target = cx(p) - VIEW_W / 2 + p.face * 30;
    this.camX = this.clampCam(this.camX + (target - this.camX) * 0.1);
    // Regeneración de PM
    const st = stats(this.save);
    if (++this.mpTick >= 120) {
      this.mpTick = 0;
      if (this.save.mp < st.maxMp) this.save.mp++;
    }
    if (this.rainT > 0) this.rainT--;
    for (const [k, v] of this.springs) v <= 1 ? this.springs.delete(k) : this.springs.set(k, v - 1);
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

  updatePlayer(inp: Input) {
    const p = this.player;
    const s = this.save;
    const st = stats(s);
    p.anim++;
    if (p.inv > 0) p.inv--;
    if (p.throwCd > 0) p.throwCd--;
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

    // Objetos rápidos
    if (inp.item1P) this.quickItem(s.inv.pocion ? 'pocion' : 'pocion_g');
    if (inp.item2P) this.quickItem('eter');

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
      if (this.moveX(p)) p.dashT = 0;
      if (p.dashT === 0) p.vx = p.face * PHYS.maxV;
      this.moveYPlayer(false);
      return;
    }

    if (control) {
      const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (!p.pound) {
        const acc = p.ground ? PHYS.acc : PHYS.airAcc;
        if (dir) {
          p.vx += dir * acc;
          if (p.attackT === 0) p.face = dir as 1 | -1;
        } else if (p.ground) {
          p.vx = Math.abs(p.vx) <= PHYS.fric ? 0 : p.vx - Math.sign(p.vx) * PHYS.fric;
        } else p.vx *= 0.96;
        p.vx = Math.max(-PHYS.maxV, Math.min(PHYS.maxV, p.vx));
      }

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

      // Ataques
      if (inp.attackP && p.attackT === 0) {
        p.attackT = 16;
        p.attackHit.clear();
        this.sound('swing');
      }
      if (inp.throwP && p.throwCd === 0 && hasSkill(s, 'hueso')) {
        if (this.spendMp(2)) {
          p.throwCd = 22;
          p.attackT = Math.max(p.attackT, 10);
          this.projs.push({
            x: cx(p) - 4 + p.face * 6, y: p.y + 3, w: 8, h: 8, vx: p.face * 4.2 + p.vx * 0.3, vy: -2.6,
            mine: true, power: st.atk * 0.8, kind: 'bone', grav: 0.18, life: 100, rot: 0,
          });
          this.sound('throw');
        }
      }
      if (inp.dashP && p.dashCd === 0 && !p.airDash && hasSkill(s, 'embestida')) {
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
      if (inp.healP && hasSkill(s, 'rearmarse') && p.ground && s.hp < st.maxHp) {
        if (this.spendMp(6)) {
          p.healT = 30;
          p.attackT = 0;
          this.sound('magic');
          return;
        }
      }
      if (inp.rainP && hasSkill(s, 'lluvia')) this.skullRain();
    }

    // Golpe de fémur: casillas activas del 12 al 6
    if (p.attackT <= 12 && p.attackT >= 6) {
      const hb = this.attackBox();
      for (const e of this.enemies) {
        if (e.dead || !e.active || p.attackHit.has(e) || !overlap(hb, e)) continue;
        p.attackHit.add(e);
        this.damageEnemy(e, st.atk, p.face);
      }
      // Rompe ladrillos
      for (let ty = Math.floor(hb.y / T); ty <= Math.floor((hb.y + hb.h) / T); ty++)
        for (let tx = Math.floor(hb.x / T); tx <= Math.floor((hb.x + hb.w) / T); tx++)
          if (this.tile(tx, ty) === 'B') this.breakBrick(tx, ty);
    }

    this.applyGravityAndMove(inp, control);
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
      if (this.tile(tx, ty) === '-') one = true;
    }
    return one;
  }

  applyGravityAndMove(inp: Input, control: boolean) {
    const p = this.player;
    if (p.pound) p.vy = Math.min(p.vy + 0.9, 9);
    else p.vy = Math.min(p.vy + PHYS.g, PHYS.maxFall);
    if (this.moveX(p)) p.vx = 0;
    this.moveYPlayer(control && inp.down && this.onOneWay());
  }

  moveYPlayer(drop: boolean) {
    const p = this.player;
    const wasGround = p.ground;
    const oldBottom = p.y + p.h;
    const res = this.moveY(p, drop);
    // Plataformas móviles (solo desde arriba)
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
    }
    if (res.ceil.length) this.bumpCeiling(res.ceil);
    if (p.ground) {
      if (p.pound) this.poundLand();
      p.airT = 0;
      if (!wasGround && !p.pound) {
        /* aterrizaje */
      }
      // Último sitio seguro: suelo firme bajo los dos pies y sin pinchos
      const ty = Math.floor((p.y + p.h + 1) / T);
      const l = Math.floor(p.x / T);
      const r = Math.floor((p.x + p.w - 0.01) / T);
      if (!p.onPlat && this.solidAt(l, ty) && this.solidAt(r, ty) && this.tile(l, ty - 1) !== '^' && this.tile(r, ty - 1) !== '^')
        this.lastSafe = { x: p.x, y: p.y };
    } else p.airT++;
  }

  bumpCeiling(tiles: [number, number][]) {
    const p = this.player;
    // La casilla más centrada sobre la cabeza
    tiles.sort((a, b) => Math.abs((a[0] + 0.5) * T - cx(p)) - Math.abs((b[0] + 0.5) * T - cx(p)));
    const [tx, ty] = tiles[0];
    const c = this.tile(tx, ty);
    if (c === '?') {
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
    for (let tx = Math.floor((p.x - 6) / T); tx <= Math.floor((p.x + p.w + 6) / T); tx++) if (this.tile(tx, ty) === 'B') this.breakBrick(tx, ty);
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

  skullRain() {
    const targets = this.enemies.filter((e) => !e.dead && e.active && e.x + e.w > this.camX && e.x < this.camX + VIEW_W);
    if (!this.spendMp(12)) return;
    const atk = stats(this.save).atk;
    this.rainT = 50;
    this.sound('magic');
    targets.forEach((e, i) => {
      this.projs.push({
        x: cx(e) - 5, y: -20 - i * 14, w: 10, h: 10, vx: 0, vy: 5, mine: true, power: atk * 2, kind: 'skull',
        grav: 0.1, life: 160, rot: 0, ghost: true, target: e,
      });
    });
    for (let i = 0; i < 8; i++) {
      this.projs.push({
        x: this.camX + this.rng.range(0, VIEW_W), y: -20 - this.rng.range(0, 80), w: 10, h: 10, vx: 0, vy: 4,
        mine: true, power: atk * 2, kind: 'skull', grav: 0.1, life: 120, rot: 0, ghost: true,
      });
    }
  }

  addCoins(n: number, x: number, y: number) {
    this.coinsGot += n;
    if (n > 1) this.float(x, y - 8, `+${n}`, '#f2c94c');
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
    this.pickups = this.pickups.filter((k) => {
      if (!overlap(k, p)) return true;
      const before = this.save.hp;
      this.save.hp = Math.min(st.maxHp, this.save.hp + Math.round(st.maxHp * 0.3));
      this.float(cx(p), p.y - 4, `+${this.save.hp - before}`, '#7dffa0');
      this.sound('heal');
      return false;
    });

    // Monedas, gemas y corazones del mapa
    const l = Math.floor(p.x / T), r = Math.floor((p.x + p.w - 0.01) / T);
    const t = Math.floor(p.y / T), b = Math.floor((p.y + p.h - 0.01) / T);
    for (let ty = t; ty <= b; ty++)
      for (let tx = l; tx <= r; tx++) {
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
          const before = this.save.hp;
          this.save.hp = Math.min(st.maxHp, this.save.hp + Math.round(st.maxHp * 0.3));
          this.float(cx(p), p.y - 4, `+${this.save.hp - before}`, '#7dffa0');
          this.sound('heal');
        }
      }
  }

  triggers() {
    const p = this.player;
    const l = Math.floor(p.x / T), r = Math.floor((p.x + p.w - 0.01) / T);
    const t = Math.floor(p.y / T), b = Math.floor((p.y + p.h - 0.01) / T);
    const st = stats(this.save);
    for (let ty = t; ty <= b; ty++)
      for (let tx = l; tx <= r; tx++) {
        const c = this.tile(tx, ty);
        if (c === 'K' && !this.flags.has(tx)) {
          this.flags.add(tx);
          this.checkpoint = { x: tx * T + (T - p.w) / 2, y: (ty + 1) * T - p.h };
          this.checkCoins = this.coinsGot;
          this.float(cx(p), p.y - 10, '¡Punto de control!', '#f2c94c');
          this.sound('checkpoint');
        } else if (c === 'S' && p.vy >= 0 && p.y + p.h >= ty * T + 8) {
          p.vy = PHYS.springV;
          p.ground = false;
          p.onPlat = null;
          p.pound = false;
          p.airJumps = 0;
          p.airDash = false;
          this.springs.set(tx, 12);
          this.sound('spring');
        } else if (c === 'G' && !this.boss) {
          this.win();
          return;
        }
      }
    // Pinchos: al estar de pie sobre ellos o tocarlos
    const feet = Math.floor((p.y + p.h - 2) / T);
    for (let tx = l; tx <= r; tx++) {
      if (this.tile(tx, feet) === '^' && p.y + p.h > feet * T + 8) {
        this.hurtFixed(Math.max(1, Math.round(st.maxHp * 0.15)), (tx + 0.5) * T);
        break;
      }
    }
    // Agua o abismo
    const midTile = this.tile(Math.floor(cx(p) / T), Math.floor((p.y + p.h - 4) / T));
    if (midTile === '~' || p.y > ROWS * T + 24) {
      this.sound('splash');
      this.hurtFixed(Math.max(1, Math.round(st.maxHp * (this.world.theme === 'castillo' && midTile === '~' ? 0.3 : 0.2))), cx(p), true);
      if (this.state === 'play') {
        p.x = this.lastSafe.x;
        p.y = this.lastSafe.y;
        p.vx = p.vy = 0;
        p.pound = false;
        p.dashT = 0;
        p.inv = 90;
        this.camX = this.clampCam(cx(p) - VIEW_W / 2);
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
    this.boss = b;
    this.emit({ t: 'boss', name: b.def.name });
    this.sound('boss');
    this.shake = 20;
  }

  win() {
    this.state = 'clear';
    this.stateT = 0;
    this.player.vx = 0;
    this.save.coins += this.coinsGot;
    this.sound('clear');
    this.emit({ t: 'clear' });
  }

  // ── Daño ──
  calcDmg(power: number, def: number) {
    const v = power * this.rng.range(0.9, 1.1) - def * 0.5;
    return Math.max(1, Math.round(v));
  }

  damageEnemy(e: Enemy, power: number, dir: number) {
    if (e.dead || e.state === 'intro' || e.state === 'gone') return;
    const dmg = this.calcDmg(power, e.def.def);
    e.hp -= dmg;
    e.flash = 10;
    this.float(cx(e), e.y - 2, String(dmg), '#ffe066');
    this.sound('hit');
    if (!e.boss && e.def.behavior !== 'thwomp') {
      e.vx = dir * 2;
      if (e.ground) e.vy = -2;
      if (e.def.behavior === 'hopper' || e.def.behavior === 'walker' || e.def.behavior === 'roller') e.timer = Math.max(e.timer, 20);
      if (e.def.behavior === 'charger') e.state = 'tired';
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e: Enemy, reward = true) {
    e.dead = true;
    e.deadT = e.boss ? 120 : 24;
    e.hp = 0;
    this.emit({ t: 'parts', x: cx(e), y: cy(e), color: e.boss ? '#ff7050' : '#e8e0ff', n: e.boss ? 40 : 12 });
    if (e.boss) {
      this.shake = 40;
      this.sound('die');
    } else this.sound('stomp');
    if (!reward || e.minion) return;
    this.kills++;
    this.save.kills++;
    if (e.def.gold) this.addCoins(e.def.gold, cx(e), e.y);
    if (e.def.xp) {
      this.xpGot += e.def.xp;
      this.float(cx(e), e.y - 12, `+${e.def.xp} XP`, '#9fd0ff');
      const ups = gainXp(this.save, e.def.xp);
      for (const u of ups) {
        this.emit({ t: 'levelup', level: u.level, skills: u.skills });
        this.sound('levelup');
      }
    }
    if (e.boss) {
      this.bossDone = true;
      if (this.def.id === '4-C') this.save.won = true;
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
    p.vy = -3.5;
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
      if (e.dead || !e.active || e.state === 'intro' || e.state === 'gone' || !overlap(p, e)) continue;
      // Embestida: golpea y atraviesa
      if (p.dashT > 0) {
        if (!p.dashHit.has(e)) {
          p.dashHit.add(e);
          this.damageEnemy(e, st.atk, p.face);
        }
        continue;
      }
      const prevBottom = p.y + p.h - p.vy;
      const stomp = p.vy > 0 && prevBottom <= e.y + 7;
      if (stomp) {
        if (e.def.spiky) {
          this.hurtPlayer(e.def.atk, cx(e));
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
      this.hurtPlayer(e.def.atk, cx(e));
    }
  }

  // ── Proyectiles ──
  updateProjs() {
    const p = this.player;
    for (const q of this.projs) {
      q.life--;
      q.vy += q.grav;
      q.rot += q.kind === 'bone' ? 0.35 : 0.1;
      if (q.target && !q.target.dead) {
        q.x += (cx(q.target) - 5 - q.x) * 0.15;
      }
      q.x += q.vx;
      q.y += q.vy;
      if (!q.ghost) {
        const tx = Math.floor((q.x + q.w / 2) / T), ty = Math.floor((q.y + q.h / 2) / T);
        if (this.solidAt(tx, ty)) {
          if (q.mine && this.tile(tx, ty) === 'B') this.breakBrick(tx, ty);
          if (q.kind === 'wave' && q.vy >= 0) {
            q.y = ty * T - q.h;
            q.vy = 0;
          } else {
            q.life = 0;
            this.emit({ t: 'parts', x: q.x + q.w / 2, y: q.y + q.h / 2, color: q.mine ? '#f4efe1' : '#ff9040', n: 4 });
          }
        }
      }
      if (q.y > ROWS * T + 40) q.life = 0;
      if (q.life <= 0) continue;
      if (q.mine) {
        for (const e of this.enemies) {
          if (e.dead || !e.active || !overlap(q, e)) continue;
          if (q.target && q.target !== e && !q.target.dead) continue;
          this.damageEnemy(e, q.power, Math.sign(q.vx) || 1);
          q.life = 0;
          break;
        }
      } else if (overlap(q, p) && this.state === 'play') {
        if (p.inv <= 0 && p.dashT <= 0) {
          this.hurtPlayer(q.power, q.x + q.w / 2);
          q.life = 0;
        }
      }
    }
    this.projs = this.projs.filter((q) => q.life > 0);
  }

  enemyShot(e: Enemy, kind: ProjKind, vx: number, vy: number, grav = 0, power = e.def.atk, w = 8, h = 8) {
    const wave = kind === 'wave';
    this.projs.push({
      x: cx(e) - w / 2, y: wave ? e.y + e.h - h : cy(e) - h / 2, w, h, vx, vy: wave ? 0 : vy, mine: false, power, kind,
      grav: wave ? 0 : grav, life: wave ? 120 : 240, rot: 0, ghost: wave,
    });
  }

  // ── Enemigos ──
  updateEnemies() {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) {
        e.deadT--;
        if (e.boss && e.deadT % 8 === 0) this.emit({ t: 'parts', x: e.x + this.rng.range(0, e.w), y: e.y + this.rng.range(0, e.h), color: '#ffb050', n: 6 });
        if (e.boss && e.deadT === 0 && this.state === 'play') this.win();
        continue;
      }
      const near = e.x + e.w > this.camX - 30 && e.x < this.camX + VIEW_W + 30;
      if (!e.active) {
        if (!near) continue;
        e.active = true;
      }
      if (e.x + e.w < this.camX - 260 || e.x > this.camX + VIEW_W + 260) continue;
      e.t++;
      if (e.flash > 0) e.flash--;
      if (this.state !== 'play' && !e.boss) continue;
      const dx = cx(p) - cx(e);
      const dy = cy(p) - cy(e);
      switch (e.def.behavior) {
        case 'walker':
        case 'roller':
          this.walk(e, e.def.speed);
          break;
        case 'hopper':
          this.hop(e, dx);
          break;
        case 'flyer':
          this.fly(e, dx, dy);
          break;
        case 'ghost': {
          const d = Math.hypot(dx, dy);
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
        case 'shooter':
          this.shooter(e, dx, dy);
          break;
        case 'charger':
          this.charger(e, dx, dy);
          break;
        case 'boss':
          this.updateBoss(e, dx, dy);
          break;
      }
      if (e.y > ROWS * T + 40 && !e.boss) this.killEnemy(e, false);
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.deadT > 0);
  }

  gravity(e: Enemy) {
    e.vy = Math.min(e.vy + PHYS.g, PHYS.maxFall);
    const hitX = this.moveX(e);
    this.moveY(e);
    return hitX;
  }

  groundAhead(e: Enemy) {
    const fx = e.face > 0 ? e.x + e.w + 1 : e.x - 1;
    const ty = Math.floor((e.y + e.h + 2) / T);
    const tx = Math.floor(fx / T);
    return this.solidAt(tx, ty) || this.tile(tx, ty) === '-';
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

  hop(e: Enemy, dx: number) {
    if (e.ground) {
      e.vx *= 0.7;
      if (--e.timer <= 0 && Math.abs(dx) < 200) {
        e.face = dx < 0 ? -1 : 1;
        e.vy = e.def.id === 'ciclope' ? -6.4 : -5;
        e.vx = e.face * e.def.speed;
        e.timer = 70 + this.rng.int(0, 40);
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
        if (Math.abs(e.x - this.camX - VIEW_W / 2) < VIEW_W) this.shake = Math.max(this.shake, 6);
        this.sound('pound');
      }
    } else if (e.state === 'land') {
      if (--e.timer <= 0) e.state = 'rise';
    } else if (e.state === 'rise') {
      e.y = Math.max(e.homeY, e.y - 1);
      if (e.y <= e.homeY) e.state = 'wait';
    }
  }

  shooter(e: Enemy, dx: number, dy: number) {
    e.face = dx < 0 ? -1 : 1;
    e.vx *= 0.8;
    this.gravity(e);
    if (--e.timer <= 0) {
      e.timer = 110 + this.rng.int(0, 50);
      const d = Math.hypot(dx, dy);
      if (d < 190) {
        this.enemyShot(e, 'fire', (dx / d) * 2.2, (dy / d) * 2.2);
        this.sound('fire');
      }
    }
  }

  charger(e: Enemy, dx: number, dy: number) {
    if (e.state === 'idle') {
      this.walk(e, e.def.speed);
      if (Math.abs(dy) < 22 && Math.abs(dx) < 140 && Math.sign(dx) === e.face) {
        e.state = 'wind';
        e.timer = 24;
      }
    } else if (e.state === 'wind') {
      e.vx = 0;
      this.gravity(e);
      if (--e.timer <= 0) {
        e.state = 'charge';
        e.timer = 70;
      }
    } else if (e.state === 'charge') {
      e.vx = e.face * 3.4;
      const hit = this.gravity(e);
      if (hit || --e.timer <= 0 || (e.ground && !this.groundAhead(e))) {
        e.state = 'tired';
        e.timer = 50;
        e.vx = 0;
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

  // ── Jefes ──
  arenaX(f: number) {
    const a = this.lvl.arena!;
    return (a.x0 + 1) * T + f * ((a.x1 - a.x0 - 2) * T);
  }

  updateBoss(e: Enemy, dx: number, dy: number) {
    if (e.state === 'intro') {
      e.face = dx < 0 ? -1 : 1;
      this.gravity(e);
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
    const minions = () => this.enemies.filter((m) => m.minion && !m.dead).length;
    switch (e.def.id) {
      case 'gran_babosa': {
        if (e.ground) {
          e.vx *= 0.8;
          if (e.state === 'air') {
            // aterriza: ondas por el suelo
            e.state = 'idle';
            e.timer = e.phase === 2 ? 34 : 50;
            this.shake = 10;
            this.sound('pound');
            this.enemyShot(e, 'wave', -2.6, 0, 0.3, e.def.atk, 12, 10);
            this.enemyShot(e, 'wave', 2.6, 0, 0.3, e.def.atk, 12, 10);
            if (e.phase === 2 && ++e.count % 2 === 0 && minions() < 3) {
              const m = this.addEnemy('babosa', Math.floor(cx(e) / T), Math.floor((e.y + e.h) / T) - 1);
              m.minion = true;
              m.active = true;
              m.vy = -4;
            }
          } else if (--e.timer <= 0) {
            e.face = dx < 0 ? -1 : 1;
            e.vy = ++e.count % 3 === 0 ? -10 : -7.5;
            e.vx = e.face * (Math.min(Math.abs(dx) / 40, 1) * 2.4 + 0.4);
            e.state = 'air';
          }
        }
        this.gravity(e);
        break;
      }
      case 'cangrejo_colosal': {
        const fast = e.phase === 2 ? 1.3 : 1;
        if (e.state === 'idle' || e.state === 'walk') {
          e.state = 'walk';
          e.face = dx < 0 ? -1 : 1;
          e.vx = e.face * 1.3 * fast;
          if (--e.timer <= 0) {
            e.state = 'shoot';
            e.timer = 40;
            e.vx = 0;
          }
        } else if (e.state === 'shoot') {
          e.vx = 0;
          if (e.timer === 20) {
            const n = e.phase === 2 ? 5 : 3;
            for (let i = 0; i < n; i++) this.enemyShot(e, 'bubble', Math.sign(dx) * (1.2 + i * 0.9), -4.2 - (i % 2) * 0.8, 0.13, e.def.atk, 10, 10);
            this.sound('fire');
          }
          if (--e.timer <= 0) {
            e.state = 'wind';
            e.timer = 30;
            e.face = dx < 0 ? -1 : 1;
          }
        } else if (e.state === 'wind') {
          e.vx = 0;
          if (--e.timer <= 0) {
            e.state = 'charge';
            this.sound('dash');
          }
        } else if (e.state === 'charge') {
          e.vx = e.face * 4.5 * fast;
          if (this.moveXPeek(e)) {
            e.state = 'stun';
            e.timer = e.phase === 2 ? 40 : 60;
            this.shake = 14;
            this.sound('pound');
            e.vx = 0;
          }
        } else if (e.state === 'stun') {
          e.vx = 0;
          if (--e.timer <= 0) {
            e.state = 'walk';
            e.timer = 90;
          }
        }
        this.gravity(e);
        break;
      }
      case 'bloque_titan': {
        const a = this.lvl.arena!;
        const topY = 2 * T;
        if (e.state === 'idle' || e.state === 'hover') {
          e.state = 'hover';
          const tx = Math.max((a.x0 + 1) * T, Math.min((a.x1 - 1) * T - e.w, cx(this.player) - e.w / 2));
          e.x += Math.max(-2.2, Math.min(2.2, (tx - e.x) * 0.06));
          e.y += (topY - e.y) * 0.08;
          if (--e.timer <= 0 && Math.abs(tx - e.x) < 10) {
            e.state = 'drop';
            e.vy = 0;
          }
          if (e.timer < -120) {
            e.state = 'drop';
            e.vy = 0;
          }
        } else if (e.state === 'drop') {
          e.vy = Math.min(e.vy + 0.7, 9);
          this.moveY(e);
          if (e.ground) {
            e.state = 'rest';
            e.timer = e.phase === 2 ? 55 : 75;
            this.shake = 18;
            this.sound('pound');
            const n = e.phase === 2 ? 7 : 4;
            for (let i = 0; i < n; i++) {
              this.projs.push({
                x: this.arenaX(this.rng.next()), y: -10 - i * 18, w: 8, h: 12, vx: 0, vy: 1, mine: false, power: e.def.atk,
                kind: 'ice', grav: 0.15, life: 200, rot: 0,
              });
            }
          }
        } else if (e.state === 'rest') {
          if (--e.timer <= 0) e.state = 'rise';
        } else if (e.state === 'rise') {
          e.y -= 1.8;
          if (e.y <= topY) {
            e.state = 'hover';
            e.timer = e.phase === 2 ? 50 : 80;
          }
        }
        break;
      }
      case 'rey_diablo': {
        const p2 = e.phase === 2;
        if (e.state === 'idle') {
          e.face = dx < 0 ? -1 : 1;
          e.vx = 0;
          if (--e.timer <= 0) {
            const opts = ['fuego', 'fuego', 'salto', minions() < 2 ? 'invocar' : 'fuego', 'tele'];
            if (p2) opts.push('lluvia', 'carga', 'lluvia');
            e.state = opts[this.rng.int(0, opts.length - 1)];
            e.timer = 0;
            e.count = 0;
          }
        } else if (e.state === 'fuego') {
          e.timer++;
          if (e.timer % (p2 ? 10 : 14) === 0) {
            const d = Math.hypot(dx, dy) || 1;
            const spread = (e.count - 1) * 0.25;
            const ang = Math.atan2(dy / d, dx / d) + spread;
            this.enemyShot(e, 'fire', Math.cos(ang) * 2.6, Math.sin(ang) * 2.6, 0, e.def.atk, 10, 10);
            this.sound('fire');
            if (++e.count >= (p2 ? 5 : 3)) this.bossIdle(e, p2);
          }
        } else if (e.state === 'salto') {
          if (e.timer === 0) {
            e.vy = -9;
            e.vx = Math.sign(dx) * Math.min(3.5, Math.abs(dx) / 30);
            e.timer = 1;
          } else if (e.ground && e.vy >= 0 && e.timer > 5) {
            this.shake = 14;
            this.sound('pound');
            this.enemyShot(e, 'wave', -3, 0, 0.3, e.def.atk, 12, 12);
            this.enemyShot(e, 'wave', 3, 0, 0.3, e.def.atk, 12, 12);
            this.bossIdle(e, p2);
          } else e.timer++;
        } else if (e.state === 'invocar') {
          e.timer++;
          if (e.timer === 30) {
            for (const f of [0.15, 0.85]) {
              const m = this.addEnemy('diablillo', Math.floor(this.arenaX(f) / T), 12);
              m.minion = true;
              m.active = true;
              this.emit({ t: 'parts', x: cx(m), y: cy(m), color: '#c040ff', n: 12 });
            }
            this.sound('magic');
          }
          if (e.timer > 50) this.bossIdle(e, p2);
        } else if (e.state === 'tele') {
          e.timer++;
          if (e.timer === 20) {
            const left = cx(this.player) > this.arenaX(0.5);
            e.x = this.arenaX(left ? 0.08 : 0.92) - e.w / 2;
            e.y = 4 * T;
            e.vy = 0;
            this.emit({ t: 'parts', x: cx(e), y: cy(e), color: '#c040ff', n: 16 });
            this.sound('magic');
          }
          if (e.timer > 40) this.bossIdle(e, p2);
        } else if (e.state === 'lluvia') {
          e.timer++;
          if (e.timer % 9 === 0 && e.timer < 90) {
            this.projs.push({
              x: this.arenaX(this.rng.next()), y: -12, w: 10, h: 10, vx: 0, vy: 2, mine: false, power: e.def.atk,
              kind: 'fire', grav: 0.08, life: 200, rot: 0,
            });
          }
          if (e.timer > 100) this.bossIdle(e, p2);
        } else if (e.state === 'carga') {
          e.timer++;
          if (e.timer < 30) e.vx = 0;
          else {
            e.vx = e.face * 6;
            if (this.moveXPeek(e) || e.timer > 100) {
              this.shake = 12;
              this.bossIdle(e, p2);
            }
          }
        }
        this.gravity(e);
        break;
      }
    }
    if (e.state === 'gone') e.state = 'idle';
  }

  bossIdle(e: Enemy, p2: boolean) {
    e.state = 'idle';
    e.timer = p2 ? 26 : 44;
    e.vx = 0;
  }

  /** ¿Chocaría con una pared al avanzar con su velocidad actual? */
  moveXPeek(e: Enemy) {
    const nx = e.x + e.vx;
    const tx = Math.floor((e.vx > 0 ? nx + e.w : nx) / T);
    for (let ty = Math.floor(e.y / T); ty <= Math.floor((e.y + e.h - 1) / T); ty++) if (this.solidAt(tx, ty)) return true;
    return false;
  }
}
