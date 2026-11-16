// Calavera Valiente: une la lógica, el dibujo y los menús.
import './style.css';
import { FINAL_LEVEL, LEVELS, WORLDS } from './data/worlds';
import { deleteSave, loadSave, newSave, writeSave, type Save } from './game/progress';
import { Stage } from './game/stage';
import { VIEW_H, VIEW_W } from './game/types';
import { WorldMap } from './game/worldmap';
import { drawMap, drawTitle } from './gfx/maprender';
import { FONT, StageView } from './gfx/render';
import { loadSheets, type Sheets } from './gfx/sheets';
import { playMusic, sfx } from './ui/audio';
import { menuOpen, message, toast } from './ui/dom';
import { clearInput, readInput } from './ui/input';
import { clearScreen, deadMenu, ENDING, INTRO, mapMenu, pauseMenu, setSheets, shopMenu, titleMenu } from './ui/screens';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

let sheets: Sheets;
let mode: 'load' | 'title' | 'map' | 'stage' = 'load';
let save: Save = newSave();
let wm: WorldMap | null = null;
let stage: Stage | null = null;
let view: StageView | null = null;
let busy = false;
let frame = 0;

// ── Escala de la pantalla ──
function resize() {
  const st = document.getElementById('stage')!;
  const k = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
  const s = k >= 1 ? Math.floor(k) : k;
  st.style.width = VIEW_W * s + 'px';
  st.style.height = VIEW_H * s + 'px';
  st.style.setProperty('--s', String(s));
}
addEventListener('resize', resize);
resize();

// ── Flujo ──
async function titleFlow() {
  mode = 'title';
  stage = null;
  playMusic('mapa');
  busy = true;
  const existing = loadSave();
  const choice = await titleMenu(!!existing);
  if (choice === 'nueva' || !existing) {
    deleteSave();
    save = newSave();
    writeSave(save);
    await message(INTRO, undefined, { story: true });
  } else save = existing;
  wm = WorldMap.fromSave(save);
  enterMap();
}

function enterMap() {
  mode = 'map';
  stage = null;
  view = null;
  busy = false;
  playMusic('mapa');
  writeSave(save);
  clearInput();
}

function startStage(levelId: string, opts: ConstructorParameters<typeof Stage>[2] = {}) {
  stage = new Stage(levelId, save, { seed: (Date.now() & 0xffff) + 1, ...opts });
  view = new StageView(ctx, sheets);
  if (opts.fromCheckpoint) view.intro = 0;
  mode = 'stage';
  busy = false;
  playMusic(stage.world.theme);
  clearInput();
  (window as unknown as Record<string, unknown>).__stage = stage;
}

async function mapInteract() {
  if (!wm) return;
  const n = wm.node;
  const w = wm.world;
  busy = true;
  if ((n.kind === 'nivel' || n.kind === 'castillo') && n.level) {
    sfx('select');
    startStage(n.level);
    return;
  }
  if (n.kind === 'tienda') {
    await shopMenu(save, wm.worldIndex, n.label);
    writeSave(save);
  } else if (n.kind === 'volver') {
    const prev = WORLDS[wm.worldIndex - 1];
    const exit = prev.nodes.find((m) => m.kind === 'salida')!;
    wm.goWorld(wm.worldIndex - 1, exit.id);
    sfx('select');
    writeSave(save);
  } else if (n.kind === 'salida') {
    wm.goWorld(wm.worldIndex + 1, WORLDS[wm.worldIndex + 1].nodes[0].id);
    sfx('select');
    writeSave(save);
    toast(`Mundo ${wm.worldIndex + 1}: ${WORLDS[wm.worldIndex].name}`);
  } else if (n.kind === 'inicio') {
    await message(['El osario donde despertaste. Huele a tierra húmeda y a nostalgia.'], w.name);
  }
  clearInput();
  busy = false;
}

async function finishStage(st: Stage) {
  busy = true;
  const first = !save.cleared.includes(st.def.id);
  if (first) save.cleared.push(st.def.id);
  writeSave(save);
  await clearScreen(st);
  if (st.def.id === FINAL_LEVEL) {
    playMusic('victoria');
    await message(ENDING, undefined, { story: true });
    if (first) await message(['Puedes seguir jugando: vuelve a cualquier nivel para conseguir más monedas y experiencia.'], 'Fin');
  } else if (st.def.boss && first) {
    const wi = LEVELS[st.def.id].world;
    await message([`El camino hacia ${WORLDS[wi + 1].name} está abierto.`], '¡Jefe vencido!');
  }
  enterMap();
}

async function onDead(st: Stage) {
  busy = true;
  writeSave(save);
  const r = await deadMenu(!!st.checkpoint);
  if (r === 'mapa') enterMap();
  else if (r === 'punto' && st.checkpoint) startStage(st.def.id, { fromCheckpoint: { ...st.checkpoint, coins: st.checkCoins } });
  else startStage(st.def.id);
}

async function pause(st: Stage) {
  busy = true;
  const r = await pauseMenu(st);
  if (r === 'salir') {
    writeSave(save);
    enterMap();
  } else {
    busy = false;
    clearInput();
  }
}

// ── Bucle ──
function step() {
  frame++;
  if (busy || menuOpen()) return;
  if (mode === 'map' && wm) {
    const inp = readInput();
    if (!wm.move) {
      if (inp.esc) {
        busy = true;
        void mapMenu(save).then((r) => {
          writeSave(save);
          clearInput();
          if (r === 'titulo') void titleFlow();
          else busy = false;
        });
        return;
      }
      if (inp.enter) {
        void mapInteract();
        return;
      }
      const dir = inp.dirP ?? (inp.left ? 'left' : inp.right ? 'right' : inp.up ? 'up' : inp.down ? 'down' : null);
      if (dir) {
        const r = wm.tryMove(dir);
        if (r === 'ok') sfx('move');
        else if (r === 'locked' && frame % 20 === 0) sfx('bump');
      }
    }
    if (wm.update()) writeSave(save);
  } else if (mode === 'stage' && stage && view) {
    const inp = readInput();
    if (inp.pause && stage.state === 'play') {
      void pause(stage);
      return;
    }
    stage.update(inp);
    for (const e of stage.events) {
      if (e.t === 'sound') sfx(e.s);
      else if (e.t === 'boss') {
        playMusic(stage.def.id === FINAL_LEVEL ? 'final' : 'jefe');
        view.handle(e);
      } else view.handle(e);
    }
    stage.events.length = 0;
    if (stage.state === 'clear' && stage.stateT === 110) void finishStage(stage);
    if (stage.state === 'dead' && stage.stateT === 90) void onDead(stage);
  } else readInput();
}

function render() {
  ctx.imageSmoothingEnabled = false;
  if (mode === 'title' || mode === 'load') {
    if (sheets) drawTitle(ctx, sheets, frame);
    else {
      ctx.fillStyle = '#140c1c';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#fff';
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.fillText('Cargando...', VIEW_W / 2, VIEW_H / 2);
    }
  } else if (mode === 'map' && wm) drawMap(ctx, sheets, wm, frame);
  else if (mode === 'stage' && stage && view) view.draw(stage);
}

let last = performance.now();
let acc = 0;
function loop(now: number) {
  acc += Math.min(100, now - last);
  last = now;
  let n = 0;
  while (acc >= 1000 / 60 && n < 4) {
    step();
    acc -= 1000 / 60;
    n++;
  }
  if (n === 4) acc = 0;
  render();
  requestAnimationFrame(loop);
}

async function boot() {
  requestAnimationFrame(loop);
  try {
    await document.fonts.load(FONT);
  } catch {
    /* sin fuente: se usa la de reserva */
  }
  sheets = await loadSheets();
  setSheets(sheets);
  // Para depurar desde la consola
  const w = window as unknown as Record<string, unknown>;
  w.__save = () => save;
  w.__play = (id: string) => {
    if (!LEVELS[id]) return 'Niveles: ' + Object.keys(LEVELS).join(', ');
    if (!wm) wm = WorldMap.fromSave(save);
    startStage(id);
    return id;
  };
  void titleFlow();
}

void boot();
