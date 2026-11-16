// Comprobaciones en Node: datos, niveles alcanzables, balance y una prueba de humo de cada nivel.
// Uso: npm run sim
import { CHUNKS } from '../src/data/chunks';
import { ITEMS } from '../src/data/items';
import { MONSTERS } from '../src/data/monsters';
import { SKILL } from '../src/data/skills';
import { LEVELS, WORLDS } from '../src/data/worlds';
import { buildLevel } from '../src/game/level';
import { baseStats, newSave, stats, xpToNext } from '../src/game/progress';
import { PHYS, Stage } from '../src/game/stage';
import { NO_INPUT, ROWS, TILE } from '../src/game/types';

let errors = 0;
const fail = (m: string) => {
  errors++;
  console.log('  ✗ ' + m);
};

// ── 1. Física real del salto ──
function jumpReach(v0: number) {
  let y = 0, vy = v0, t = 0, top = 0;
  while (true) {
    vy = Math.min(vy + PHYS.g, PHYS.maxFall);
    y += vy;
    t++;
    top = Math.min(top, y);
    if (y >= 0) break;
  }
  return { rise: -top, frames: t, dist: t * PHYS.maxV };
}
const J = jumpReach(PHYS.jumpV), D = jumpReach(PHYS.doubleV), S = jumpReach(PHYS.springV);
console.log('Física');
console.log(`  salto: ${J.rise.toFixed(0)} px (${(J.rise / TILE).toFixed(1)} casillas), ${J.frames} f, ${(J.dist / TILE).toFixed(1)} casillas de largo`);
console.log(`  doble salto: +${D.rise.toFixed(0)} px · resorte: ${(S.rise / TILE).toFixed(1)} casillas`);

// ── 2. Datos ──
console.log('Datos');
for (const [name, ch] of Object.entries(CHUNKS)) {
  if (ch.rows.length !== ROWS) fail(`tramo ${name}: ${ch.rows.length} filas`);
  const w = ch.rows[0].length;
  ch.rows.forEach((r, y) => r.length !== w && fail(`tramo ${name} fila ${y}: ancho ${r.length} ≠ ${w}`));
  for (const x of [0, w - 1]) {
    if (ch.rows[13][x] !== '#' || ch.rows[14][x] !== '#') fail(`tramo ${name}: la columna ${x} no tiene suelo`);
    for (let y = 0; y < 13; y++) if (!'.dPW'.includes(ch.rows[y][x]) && !(name === 'techo' && y < 2) && ch.rows[y][x] !== 'X') fail(`tramo ${name}: borde ${x},${y} = ${ch.rows[y][x]}`);
  }
}
for (const w of WORLDS) for (const k of Object.values(w.roster)) if (!MONSTERS[k]) fail(`monstruo desconocido ${k}`);
for (const w of WORLDS) for (const it of w.shop) if (!ITEMS[it]) fail(`objeto desconocido ${it}`);
for (const w of WORLDS) for (const l of w.levels) if (l.boss && !MONSTERS[l.boss]) fail(`jefe desconocido ${l.boss}`);
for (const w of WORLDS) {
  const ids = new Set(w.nodes.map((n) => n.id));
  for (const [a, b] of w.edges) {
    if (!ids.has(a) || !ids.has(b)) fail(`arista con nodo desconocido ${a}-${b}`);
    const na = w.nodes.find((n) => n.id === a)!, nb = w.nodes.find((n) => n.id === b)!;
    if (na && nb && na.x !== nb.x && na.y !== nb.y) fail(`arista ${a}-${b} no es recta`);
  }
  for (const n of w.nodes) if (n.level && !LEVELS[n.level]) fail(`nodo ${n.id}: nivel ${n.level} no existe`);
}

// ── 3. Niveles alcanzables (búsqueda por casillas con el alcance del salto) ──
console.log('Niveles');
function reachable(levelId: string, double: boolean) {
  const info = LEVELS[levelId];
  const lv = buildLevel(info.def, WORLDS[info.world]);
  const W = lv.w;
  const g = lv.grid.map((r) => [...r]);
  // Plataformas móviles: todo su recorrido cuenta como tablón
  for (const s of lv.spawns) {
    if (s.kind === 'platX') for (let x = s.tx; x < s.tx + 8; x++) g[s.ty][x] = '-';
    if (s.kind === 'platY') for (let y = s.ty - 4; y <= s.ty; y++) for (let x = s.tx; x < s.tx + 3; x++) g[y][x] = '-';
  }
  const t = (x: number, y: number) => (x < 0 || x >= W ? 'X' : y < 0 ? '.' : y >= ROWS ? '~' : g[y][x]);
  const solid = (c: string) => '#XB?QU'.includes(c);
  const free = (x: number, y: number) => !solid(t(x, y));
  const stand = (x: number, y: number) => {
    const below = t(x, y + 1);
    return free(x, y) && free(x, y - 1) && (solid(below) || below === '-') && t(x, y) !== '^' && t(x, y) !== '~';
  };
  const clearCells = (cells: [number, number][]) => cells.every(([x, y]) => free(x, y) && free(x, y - 1));
  const path = (x: number, y: number, x2: number, y2: number, top: number) => {
    const cells: [number, number][] = [];
    for (let yy = y; yy >= top; yy--) cells.push([x, yy]);
    for (let xx = Math.min(x, x2); xx <= Math.max(x, x2); xx++) cells.push([xx, top]);
    for (let yy = top; yy <= y2; yy++) cells.push([x2, yy]);
    return clearCells(cells);
  };
  const maxRise = double ? 6 : 4;
  const reach = (dy: number) => {
    // dy > 0 sube; dy < 0 baja
    if (double) return dy >= 6 ? 3 : dy >= 5 ? 4 : dy >= 3 ? 5 : dy >= 0 ? 7 : 7 + Math.floor(-dy / 2);
    return dy >= 4 ? 3 : dy >= 3 ? 4 : dy >= 0 ? 5 : 5 + Math.floor(-dy / 2);
  };
  const start: [number, number] = [lv.start.tx, lv.start.ty];
  const seen = new Set<string>([start.join(',')]);
  const queue: [number, number][] = [start];
  let goal = false;
  let maxX = 0;
  while (queue.length) {
    const [x, y] = queue.shift()!;
    maxX = Math.max(maxX, x);
    if (t(x, y) === 'G' || (lv.arena && x >= lv.arena.x0 + 4)) goal = true;
    const spring = t(x, y) === 'S';
    const rise = spring ? 9 : maxRise;
    for (let dy = rise; dy >= -14; dy--) {
      const r = spring ? 3 : reach(dy);
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y - dy;
        if (ny < 1 || ny >= ROWS || !stand(nx, ny)) continue;
        const k = nx + ',' + ny;
        if (seen.has(k)) continue;
        const top = Math.min(y, ny) - (dy > 0 || dx !== 0 ? 1 : 0);
        const ok = path(x, y, nx, ny, Math.max(1, top)) || (dy <= 0 && path(x, y, nx, ny, y));
        if (!ok) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
  }
  return { goal, maxX, w: W, lv };
}

for (const [wi, w] of WORLDS.entries()) {
  for (const l of w.levels) {
    const lv = buildLevel(l, w);
    const enemies = lv.spawns.filter((s) => s.kind === 'enemy');
    // Monstruos de suelo sobre suelo
    for (const s of enemies) {
      const def = MONSTERS[s.id];
      if (def.behavior === 'flyer' || def.behavior === 'ghost') continue;
      const below = lv.grid[s.ty + 1]?.[s.tx];
      if (!below || !'#XB?QU-'.includes(below)) fail(`${l.id}: ${s.id} en ${s.tx},${s.ty} flota (debajo "${below}")`);
    }
    if (!l.boss && !lv.grid.some((r) => r.includes('G'))) fail(`${l.id}: no tiene salida`);
    if (l.boss && !lv.arena) fail(`${l.id}: tiene jefe pero no sala`);
    const single = reachable(l.id, false);
    const dbl = reachable(l.id, true);
    const needDouble = !single.goal;
    const usesHard = l.chunks.some((c) => CHUNKS[c].hard);
    if (!dbl.goal) fail(`${l.id}: no se llega a la salida ni con doble salto (llega hasta la columna ${dbl.maxX} de ${dbl.w})`);
    else if (needDouble && wi === 0) fail(`${l.id}: el mundo 1 no debe exigir doble salto (sin él llega a la columna ${single.maxX} de ${single.w})`);
    const coins = lv.grid.flat().filter((c) => c === 'o' || c === '?').length + lv.grid.flat().filter((c) => c === 'g').length * 10;
    console.log(`  ${l.id.padEnd(4)} ${String(lv.w).padStart(3)} col · ${String(enemies.length).padStart(2)} monstruos · ~${coins} monedas${needDouble ? ' · exige doble salto' : ''}${usesHard && !needDouble ? ' (tramo difícil con atajo)' : ''}`);
  }
}

// ── 4. Balance: experiencia acumulada y peleas ──
console.log('Balance (matando a todos una vez)');
let xp = 0;
let lvl = 1;
const levelAt = (total: number) => {
  let l = 1, rest = total;
  while (rest >= xpToNext(l)) rest -= xpToNext(l++);
  return l;
};
const GEAR = [['femur', 'harapos'], ['hueso_afilado', 'tapa_ataud'], ['espada_oxidada', 'cota_huesos'], ['hacha_osaria', 'placas_hierro'], ['guadana', 'manto_liche']];
for (const [wi, w] of WORLDS.entries()) {
  const startLvl = lvl;
  let gold = 0;
  for (const l of w.levels) {
    const lv = buildLevel(l, w);
    for (const s of lv.spawns) {
      if (s.kind === 'enemy' || s.kind === 'boss') {
        xp += MONSTERS[s.id].xp;
        gold += MONSTERS[s.id].gold;
      }
    }
    gold += lv.grid.flat().filter((c) => c === 'o' || c === '?').length + lv.grid.flat().filter((c) => c === 'g').length * 10;
  }
  lvl = levelAt(xp);
  // Pelea típica al empezar el mundo, con el equipo de la tienda anterior
  const save = newSave();
  save.level = startLvl;
  [save.weapon, save.armor] = GEAR[wi];
  const st = stats(save);
  const mons = Object.values(w.roster).map((id) => MONSTERS[id]);
  const hits = mons.map((m) => Math.ceil(m.hp / Math.max(1, st.atk - m.def * 0.5)));
  const taken = mons.map((m) => Math.max(1, Math.round(m.atk - st.def * 0.5)));
  const boss = MONSTERS[w.levels[w.levels.length - 1].boss!];
  const endSave = { ...save, level: lvl, weapon: GEAR[wi + 1]?.[0] ?? 'guadana', armor: GEAR[wi + 1]?.[1] ?? 'manto_liche' };
  const est = stats(endSave);
  const bossHits = Math.ceil(boss.hp / Math.max(1, est.atk - boss.def * 0.5));
  const bossTaken = Math.max(1, Math.round(boss.atk - est.def * 0.5));
  console.log(`  Mundo ${wi + 1}: nivel ${startLvl} → ${lvl} · ~${gold} monedas`);
  console.log(`    al llegar (ATQ ${st.atk}, DEF ${st.def}, PV ${st.maxHp}): golpes para matar ${hits.join('/')} · daño recibido ${taken.join('/')} (${Math.floor(st.maxHp / Math.max(...taken))} golpes para caer)`);
  console.log(`    jefe ${boss.name}: ${bossHits} golpes con ATQ ${est.atk} · te quita ${bossTaken} de ${est.maxHp} PV`);
}
for (const k of Object.values(SKILL)) if (k.level > lvl) fail(`la habilidad ${k.name} (nivel ${k.level}) no se alcanza antes del final (nivel ${lvl})`);
console.log(`  PV/ATQ/DEF a nivel 1, 8 y 16: ${[1, 8, 16].map((l) => Object.values(baseStats(l)).join('/')).join(' · ')}`);

// ── 5. Prueba de humo: cada nivel con un piloto tonto, y cada jefe ──
console.log('Prueba de humo');
for (const id of Object.keys(LEVELS)) {
  const save = newSave();
  save.level = 20;
  const st = new Stage(id, save, { seed: 7 });
  let maxX = 0;
  try {
    for (let f = 0; f < 3600 && st.state === 'play'; f++) {
      const jump = f % 50 < 20;
      st.update({ ...NO_INPUT, right: true, jump, jumpP: f % 50 === 0, attackP: f % 20 === 0, throwP: f % 90 === 0 });
      st.events.length = 0;
      maxX = Math.max(maxX, st.player.x);
    }
    // Jefe: se coloca al jugador en la sala
    if (st.lvl.arena && st.state === 'play') {
      st.player.x = (st.lvl.arena.x0 + 5) * TILE;
      st.player.y = 11 * TILE;
      st.player.inv = 0;
      let f = 0;
      for (; f < 60 * 120 && st.state === 'play'; f++) {
        const b = st.boss;
        const dir = b && !b.dead ? Math.sign(b.x + b.w / 2 - (st.player.x + 5)) : 0;
        st.update({ ...NO_INPUT, left: dir < 0, right: dir > 0, attackP: f % 18 === 0, jump: f % 70 < 15, jumpP: f % 70 === 0 });
        st.events.length = 0;
        st.save.hp = 9999; // inmortal: solo se mide que el jefe se puede vencer
      }
      if (!st.bossDone) fail(`${id}: el piloto no vence al jefe en 2 minutos`);
      else console.log(`  ${id}: jefe vencido por el piloto en ${(f / 60).toFixed(0)} s (nivel 20)`);
    } else {
      console.log(`  ${id}: ${st.state === 'clear' ? 'completado por el piloto' : `sin errores (avanzó hasta x=${Math.round(maxX / TILE)})`}`);
    }
  } catch (e) {
    fail(`${id}: excepción ${(e as Error).stack}`);
  }
}

console.log(errors ? `\n${errors} errores` : '\nTodo bien');
process.exit(errors ? 1 : 0);
