// Comprobaciones en Node: datos, niveles alcanzables, balance y una prueba de humo de cada nivel.
// Uso: npm run sim
import { CHUNKS } from '../src/data/chunks';
import { ITEMS } from '../src/data/items';
import { MONSTERS } from '../src/data/monsters';
import { SKILLS } from '../src/data/skills';
import { LEVELS, WORLDS } from '../src/data/worlds';
import { expectedLevel, tierStats } from '../src/game/formulas';
import { buildLevel, chunkList } from '../src/game/level';
import { baseStats, newSave, stats, xpToNext } from '../src/game/progress';
import { PHYS, Stage } from '../src/game/stage';
import { NO_INPUT, TILE } from '../src/game/types';

const quick = process.argv.includes('--rapido');
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
const SOLIDS = '#XB?QUIOALREF';
for (const [name, ch] of Object.entries(CHUNKS)) {
  const w = ch.rows[0].length;
  ch.rows.forEach((r, y) => r.length !== w && fail(`tramo ${name} fila ${y}: ancho ${r.length} ≠ ${w}`));
  if (ch.tags === 'T') {
    if (w !== 26) fail(`tramo de torre ${name}: ancho ${w}`);
    continue;
  }
  if (ch.rows.length !== 15) fail(`tramo ${name}: ${ch.rows.length} filas`);
  if (name.startsWith('sala_') || name === 'arena' || name === 'trono') continue;
  for (const x of [0, w - 1]) {
    if (ch.rows[13][x] !== '#' || ch.rows[14][x] !== '#') fail(`tramo ${name}: la columna ${x} no tiene suelo`);
    for (let y = 9; y < 13; y++) if (SOLIDS.includes(ch.rows[y][x])) fail(`tramo ${name}: borde ${x},${y} = ${ch.rows[y][x]}`);
  }
}
for (const w of WORLDS) {
  for (const l of w.levels) {
    for (const k of Object.values(l.roster)) if (!MONSTERS[k]) fail(`${l.id}: monstruo desconocido ${k}`);
    if (l.boss && !MONSTERS[l.boss]?.boss) fail(`${l.id}: jefe desconocido ${l.boss}`);
  }
  for (const it of w.shop) if (!ITEMS[it]) fail(`objeto desconocido ${it}`);
  const ids = new Set(w.nodes.map((n) => n.id));
  for (const e of w.edges) {
    if (!ids.has(e.a) || !ids.has(e.b)) fail(`arista con nodo desconocido ${e.a}-${e.b}`);
    const na = w.nodes.find((n) => n.id === e.a), nb = w.nodes.find((n) => n.id === e.b);
    if (na && nb && na.x !== nb.x && na.y !== nb.y) fail(`arista ${e.a}-${e.b} no es recta`);
    if (e.by && !LEVELS[e.by]) fail(`arista ${e.a}-${e.b}: nivel ${e.by} no existe`);
  }
  for (const n of w.nodes) {
    if (n.level && !LEVELS[n.level]) fail(`nodo ${n.id}: nivel ${n.level} no existe`);
    if (n.item && !ITEMS[n.item]?.treasure) fail(`nodo ${n.id}: tesoro ${n.item} no existe`);
    if (n.x < 0 || n.x > 25 || n.y < 0 || n.y > 11) fail(`nodo ${n.id} fuera del mapa (${n.x},${n.y})`);
  }
  // Dos nodos en la misma casilla
  const seen = new Set<string>();
  for (const n of w.nodes) {
    const k = `${n.x},${n.y}`;
    if (seen.has(k)) fail(`${w.name}: dos nodos en ${k}`);
    seen.add(k);
  }
}
for (const m of Object.values(MONSTERS)) {
  if (m.sprite.sheet === 'art') continue;
  if (m.boss?.minion && !MONSTERS[m.boss.minion]) fail(`${m.id}: secuaz desconocido ${m.boss.minion}`);
}

// ── 3. Niveles alcanzables (búsqueda por casillas con el alcance del salto) ──
console.log('Niveles');
type Goal = 'G' | 'H';
function reachable(levelId: string, double: boolean) {
  const info = LEVELS[levelId];
  const def = info.def;
  const lv = buildLevel(def);
  const W = lv.w, H = lv.h;
  const g = lv.grid.map((r) => [...r]);
  // Plataformas móviles: todo su recorrido cuenta como tablón
  for (const s of lv.spawns) {
    if (s.kind === 'platX') for (let x = s.tx; x < s.tx + 8; x++) if (g[s.ty][x] === '.') g[s.ty][x] = '-';
    if (s.kind === 'platY') for (let y = s.ty - 4; y <= s.ty; y++) for (let x = s.tx; x < s.tx + 3; x++) if (g[y][x] === '.') g[y][x] = '-';
  }
  const t = (x: number, y: number) => (x < 0 || x >= W ? 'X' : y < 0 ? 'X' : y >= H ? '~' : g[y][x]);
  // Ladrillos y muros agrietados: se puede estar encima, y también romperlos para pasar
  const solid = (c: string, sw: number, key: number) =>
    '#X?QUIOA'.includes(c) || (c === 'L' && !key) || (c === 'E' && !sw) || (c === 'F' && !!sw);
  const floorOk = (c: string, sw: number, key: number) => solid(c, sw, key) || c === 'B' || c === 'R';
  const oneWay = (c: string) => '-=CvV'.includes(c);
  const free = (x: number, y: number, sw: number, k: number) => !solid(t(x, y), sw, k);
  const stand = (x: number, y: number, sw: number, k: number) => {
    const below = t(x, y + 1);
    const here = t(x, y);
    return free(x, y, sw, k) && free(x, y - 1, sw, k) && (floorOk(below, sw, k) || oneWay(below)) && here !== '^' && here !== '~';
  };
  const clearCells = (cells: [number, number][], sw: number, k: number) => cells.every(([x, y]) => free(x, y, sw, k) && free(x, y - 1, sw, k));
  const path = (x: number, y: number, x2: number, y2: number, top: number, sw: number, k: number) => {
    const cells: [number, number][] = [];
    for (let yy = y; yy >= top; yy--) cells.push([x, yy]);
    for (let xx = Math.min(x, x2); xx <= Math.max(x, x2); xx++) cells.push([xx, top]);
    for (let yy = top; yy <= y2; yy++) cells.push([x2, yy]);
    return clearCells(cells, sw, k);
  };
  const maxRise = double ? 6 : 4;
  const reach = (dy: number) => {
    if (double) return dy >= 6 ? 3 : dy >= 5 ? 4 : dy >= 3 ? 5 : dy >= 0 ? 7 : 7 + Math.floor(-dy / 2);
    return dy >= 4 ? 3 : dy >= 3 ? 4 : dy >= 0 ? 5 : 5 + Math.floor(-dy / 2);
  };
  const start: [number, number, number, number] = [lv.start.tx, lv.start.ty, 0, 0];
  const id = (s: number[]) => s.join(',');
  const seen = new Set<string>([id(start)]);
  const queue: [number, number, number, number][] = [start];
  const found = new Set<Goal>();
  let maxX = 0, minY = H;
  const mainW = lv.regions[0].x1;
  const push = (s: [number, number, number, number]) => {
    const k = id(s);
    if (seen.has(k)) return;
    seen.add(k);
    queue.push(s);
  };
  while (queue.length) {
    const [x, y, sw, key] = queue.shift()!;
    if (x < mainW) maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    for (const yy of [y, y - 1]) {
      if (t(x, yy) === 'G') found.add('G');
      if (t(x, yy) === 'H') found.add('H');
    }
    if (lv.arena && x >= lv.arena.x0 + 4) found.add('G');
    // Llave al alcance (encima de la cabeza)
    let k2 = key;
    for (let yy = y; yy >= y - 3; yy--) if (t(x, yy) === 'k') k2 = 1;
    if (k2 !== key) push([x, y, sw, k2]);
    // Palanca al lado
    for (let xx = x - 1; xx <= x + 1; xx++) for (const yy of [y, y - 1]) if (t(xx, yy) === 'l') push([x, y, sw ? 0 : 1, key]);
    // Puerta
    const door = lv.doors.get(`${x},${y}`);
    if (door) push([door.tx, door.ty, sw, key]);
    if (def.water) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (ny < 1 || ny >= H) continue;
        if (!free(nx, ny, sw, key) || !free(nx, ny - 1, sw, key)) continue;
        const c = t(nx, ny);
        if (c === '^' || c === '~') continue;
        push([nx, ny, sw, key]);
      }
      continue;
    }
    const spring = t(x, y) === 'S';
    const rise = spring ? 9 : maxRise;
    for (let dy = rise; dy >= -14; dy--) {
      const r = spring ? 3 : reach(dy);
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y - dy;
        if (ny < 1 || ny >= H || !stand(nx, ny, sw, key)) continue;
        if (seen.has(id([nx, ny, sw, key]))) continue;
        const top = Math.min(y, ny) - (dy > 0 || dx !== 0 ? 1 : 0);
        const ok = path(x, y, nx, ny, Math.max(1, top), sw, key) || (dy <= 0 && path(x, y, nx, ny, y, sw, key));
        if (!ok) continue;
        push([nx, ny, sw, key]);
      }
    }
  }
  return { found, maxX, minY, w: mainW, h: H, lv };
}

for (const [wi, w] of WORLDS.entries()) {
  for (const l of w.levels) {
    const lv = buildLevel(l);
    const enemies = lv.spawns.filter((s) => s.kind === 'enemy');
    // Monstruos de suelo sobre suelo
    for (const s of enemies) {
      const def = MONSTERS[s.id];
      if (['flyer', 'ghost', 'swimmer', 'jelly', 'puffer', 'cloud', 'dropper', 'thwomp'].includes(def.behavior)) continue;
      if (l.water && def.behavior !== 'walker' && def.behavior !== 'charger') continue;
      const below = lv.grid[s.ty + 1]?.[s.tx];
      if (!below || !'#XB?QUI-=CvV'.includes(below)) fail(`${l.id}: ${s.id} en ${s.tx},${s.ty} flota (debajo "${below}")`);
    }
    if (!l.boss && !lv.grid.some((r) => r.includes('G'))) fail(`${l.id}: no tiene salida`);
    if (l.secret && !lv.grid.some((r) => r.includes('H'))) fail(`${l.id}: no tiene salida secreta`);
    if (l.boss && !lv.arena) fail(`${l.id}: tiene jefe pero no sala`);
    const single = reachable(l.id, false);
    const dbl = reachable(l.id, true);
    const needDouble = !single.found.has('G');
    if (!dbl.found.has('G')) fail(`${l.id}: no se llega a la salida ni con doble salto (llega a x=${dbl.maxX}/${dbl.w}, y=${dbl.minY}/${dbl.h}) [${chunkList(l).join(' ')}]`);
    else if (needDouble && wi === 0 && l.slot !== 'S') fail(`${l.id}: el mundo 1 no debe exigir doble salto (sin él llega a x=${single.maxX}/${single.w}, y=${single.minY}) [${chunkList(l).join(' ')}]`);
    if (l.secret && !dbl.found.has('H')) fail(`${l.id}: la salida secreta no se alcanza [${chunkList(l).join(' ')}]`);
    const coins = lv.grid.flat().filter((c) => c === 'o' || c === '?' || c === 'i').length + lv.grid.flat().filter((c) => c === 'g').length * 10;
    if (!quick)
      console.log(`  ${l.id.padEnd(4)} ${l.type.padEnd(9)} ${String(lv.w).padStart(3)}×${String(lv.h).padEnd(3)} · ${String(enemies.length).padStart(2)} monstruos · ~${coins} monedas${needDouble ? ' · doble salto' : ''}${l.secret ? ' · secreta' : ''}`);
  }
}

// ── 4. Balance ──
console.log('Balance (matando a todos una vez)');
let xp = 0;
let lvl = 1;
const levelAt = (total: number) => {
  let l = 1, rest = total;
  while (rest >= xpToNext(l)) rest -= xpToNext(l++);
  return l;
};
const GEAR = [
  ['femur', 'harapos'], ['hueso_afilado', 'tapa_ataud'], ['espada_oxidada', 'cota_huesos'], ['maza_tumba', 'escudo_lapida'],
  ['hacha_osaria', 'placas_hierro'], ['lanza_coral', 'escamas'], ['espada_runica', 'manto_escarcha'], ['guadana', 'manto_liche'],
];
let coinsTotal = 0;
for (const [wi, w] of WORLDS.entries()) {
  const startLvl = lvl;
  let gold = 0;
  for (const l of w.levels) {
    const lv = buildLevel(l);
    const base = tierStats(l.tier);
    for (const s of lv.spawns) {
      if (s.kind === 'enemy' || s.kind === 'boss') {
        const m = MONSTERS[s.id];
        xp += Math.max(1, Math.round(base.xp * m.xp));
        gold += Math.round(base.gold * m.gold);
      }
    }
    gold += lv.grid.flat().filter((c) => c === 'o' || c === '?' || c === 'i').length + lv.grid.flat().filter((c) => c === 'g').length * 10;
  }
  coinsTotal += gold;
  lvl = levelAt(xp);
  const save = newSave();
  save.level = startLvl;
  [save.weapon, save.armor] = GEAR[wi];
  const st = stats(save);
  const base = tierStats(wi);
  const norm = { hp: Math.round(base.hp), atk: Math.round(base.atk), def: Math.round(base.def) };
  const hits = Math.ceil(norm.hp / Math.max(1, st.atk - norm.def * 0.5));
  const taken = Math.max(1, Math.round(norm.atk - st.def * 0.5));
  const boss = MONSTERS[w.levels.find((l) => l.slot === '8')!.boss!];
  const bt = tierStats(wi + 0.7);
  const endSave = { ...save, level: lvl, weapon: GEAR[wi + 1]?.[0] ?? 'guadana', armor: GEAR[wi + 1]?.[1] ?? 'manto_liche' };
  const est = stats(endSave);
  const bossHits = Math.ceil((bt.hp * boss.hp) / Math.max(1, est.atk - bt.def * boss.def * 0.5));
  const bossTaken = Math.max(1, Math.round(bt.atk * boss.atk - est.def * 0.5));
  const prices = w.shop.map((id) => ITEMS[id].price).reduce((a, b) => a + b, 0);
  console.log(`  Mundo ${wi + 1}: nivel ${startLvl} → ${lvl} (esperado ${expectedLevel(wi).toFixed(0)} → ${expectedLevel(wi + 1).toFixed(0)}) · ~${gold} monedas (tienda: ${prices})`);
  console.log(`    al llegar (ATQ ${st.atk}, DEF ${st.def}, PV ${st.maxHp}): monstruo normal en ${hits} golpes · te quita ${taken} (${Math.floor(st.maxHp / taken)} golpes para caer)`);
  console.log(`    jefe ${boss.name}: ${bossHits} golpes con ATQ ${est.atk} · te quita ${bossTaken} de ${est.maxHp} PV`);
}
for (const k of SKILLS) if (k.level > lvl) fail(`la habilidad ${k.name} (nivel ${k.level}) no se alcanza antes del final (nivel ${lvl})`);
console.log(`  PV/PM/ATQ/DEF a nivel 1, 10, 20 y 35: ${[1, 10, 20, 35].map((l) => Object.values(baseStats(l)).join('/')).join(' · ')}`);

// ── 5. Prueba de humo: cada nivel con un piloto tonto, y cada jefe ──
console.log('Prueba de humo');
for (const id of Object.keys(LEVELS)) {
  const save = newSave();
  save.level = 40;
  const st = new Stage(id, save, { seed: 7 });
  let maxX = 0;
  try {
    for (let f = 0; f < (quick ? 1200 : 3600) && st.state === 'play'; f++) {
      const jump = f % 50 < 20;
      st.update({ ...NO_INPUT, right: true, jump, jumpP: f % 50 === 0, up: f % 50 < 20, upP: f % 97 === 0, attackP: f % 20 === 0, castP: f % 90 === 0, nextP: f % 400 === 0 });
      st.events.length = 0;
      st.save.hp = 9999;
      maxX = Math.max(maxX, st.player.x);
    }
    // Jefe: se coloca al jugador en la sala
    if (st.lvl.arena && st.state === 'play') {
      st.player.x = (st.lvl.arena.x0 + 5) * TILE;
      st.player.y = 11 * TILE;
      st.region = st.regionAt(st.player.x, st.player.y);
      st.player.inv = 0;
      let f = 0;
      // El piloto alterna los hechizos que le hacen daño al jefe
      const spells = (['rayo', 'luz', 'hielo', 'fuego'] as const).filter((k) => !st.boss?.def.immune?.includes(k === 'luz' ? 'luz' : k));
      for (; f < 60 * 180 && st.state === 'play'; f++) {
        st.save.spell = spells[Math.floor(f / 40) % spells.length];
        const b = st.boss;
        const dir = b && !b.dead ? Math.sign(b.x + b.w / 2 - (st.player.x + 5)) : 0;
        st.update({ ...NO_INPUT, left: dir < 0, right: dir > 0, attackP: f % 18 === 0, castP: f % 40 === 0, jump: f % 70 < 15, jumpP: f % 70 === 0 });
        st.events.length = 0;
        st.save.hp = 9999; // inmortal: solo se mide que el jefe se puede vencer
        st.save.mp = 99;
      }
      if (!st.bossDone) fail(`${id}: el piloto no vence al jefe en 3 minutos (le queda ${st.boss?.hp}/${st.boss?.maxHp})`);
      else console.log(`  ${id}: jefe vencido por el piloto en ${(f / 60).toFixed(0)} s`);
    } else if (!quick) {
      console.log(`  ${id}: ${st.state === 'clear' ? `completado por el piloto (salida ${st.exit === 's' ? 'secreta' : 'normal'})` : `sin errores (avanzó hasta x=${Math.round(maxX / TILE)})`}`);
    }
  } catch (e) {
    fail(`${id}: excepción ${(e as Error).stack}`);
  }
}

// ── 6. Mecanismos: puertas, llaves, palancas, muros y salida secreta ──
console.log('Mecanismos');
{
  const base = WORLDS[0].levels[1];
  LEVELS.prueba = { def: { ...base, id: 'prueba', chunks: ['inicio', 'llave_puerta', 'cerradura', 'palanca1', 'muro1', 'secreto_muro', 'meta'] }, world: 0 };
  const st = new Stage('prueba', newSave(), { seed: 3 });
  const at = (name: string) => st.lvl.starts.find((q) => q.name === name)!.at;
  const place = (tx: number, ty: number) => {
    st.player.x = tx * TILE + 4;
    st.player.y = (ty + 1) * TILE - st.player.h;
    st.player.vx = st.player.vy = 0;
    st.region = st.regionAt(st.player.x, st.player.y);
    st.update(NO_INPUT);
  };
  const tick = (inp = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      st.update({ ...NO_INPUT, ...inp });
      st.events.length = 0;
      st.save.hp = 9999;
    }
  };
  // Puerta a la sala de la llave
  place(at('llave_puerta') + 9, 12);
  tick({ upP: true });
  if (st.region === st.lvl.regions[0]) fail('la puerta no lleva a la sala');
  const key = st.grid.flatMap((r, y) => r.map((c, x) => [c, x, y] as const)).find(([c]) => c === 'k');
  if (!key) fail('la sala de la llave no tiene llave');
  else {
    place(key[1], key[2] + 1);
    tick({}, 2);
    if (st.keys !== 1) fail(`no se recoge la llave (llaves: ${st.keys})`);
  }
  // Volver por la puerta y abrir la cerradura
  const roomDoor = [...st.lvl.doors.keys()].map((k) => k.split(',').map(Number)).find(([x]) => x >= st.lvl.regions[0].x1)!;
  place(roomDoor[0], roomDoor[1]);
  tick({}, 30);
  tick({ upP: true });
  if (st.region !== st.lvl.regions[0]) fail('la puerta de la sala no vuelve al nivel');
  place(at('cerradura') + 7, 12);
  tick({ right: true }, 10);
  if (st.tile(at('cerradura') + 8, 12) === 'L') fail('la cerradura no se abre con la llave');
  // Palanca: el muro rojo desaparece
  const wallX = at('palanca1') + 14;
  if (!st.solidAt(wallX, 12)) fail('el muro rojo no empieza macizo');
  place(at('palanca1') + 5, 12);
  st.player.face = 1;
  tick({ attackP: true }, 1);
  tick({}, 14);
  if (!st.switchOn || st.solidAt(wallX, 12)) fail('la palanca no abre el muro rojo');
  // Muro agrietado: tres golpes
  place(at('muro1') + 7, 12);
  st.player.face = 1;
  for (let i = 0; i < 3; i++) {
    tick({ attackP: true }, 1);
    tick({}, 17);
  }
  if (st.tile(at('muro1') + 8, 12) === 'R') fail('el muro agrietado no se rompe con 3 golpes');
  // Salida secreta
  const h = at('secreto_muro') + 20;
  place(h, 12);
  tick({}, 2);
  if (st.state !== 'clear' || st.exit !== 's') fail('la salida secreta no termina el nivel por la salida secreta');
  if (!errors) console.log('  puertas, llave, cerradura, palanca, muro agrietado y salida secreta: bien');
  delete LEVELS.prueba;
}

console.log(errors ? `\n${errors} errores` : '\nTodo bien');
process.exit(errors ? 1 : 0);
