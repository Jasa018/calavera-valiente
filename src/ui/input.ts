// Teclado y mando para el juego (los menús usan `dom.ts`).
import type { Input } from '../game/types';

const down = new Set<string>();
const pressed = new Set<string>();

const GAME_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Shift',
  'a', 'd', 'w', 's', 'z', 'x', 'c', 'j', 'k', 'l', 'v', 'b', 'q', 'e', '1', '2',
]);

addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return; // lo ha usado un menú
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!down.has(k)) pressed.add(k);
  down.add(k);
  if (GAME_KEYS.has(k)) e.preventDefault();
});
addEventListener('keyup', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  down.delete(k);
});
addEventListener('blur', () => down.clear());

export function clearInput() {
  down.clear();
  pressed.clear();
  padPrev = [];
  padUpPrev = false;
}

let padPrev: boolean[] = [];
let padUpPrev = false;

function pad() {
  const gp = navigator.getGamepads?.().find((g) => g && g.connected);
  if (!gp) return null;
  const b = gp.buttons.map((x) => x.pressed);
  const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
  const prev = padPrev;
  padPrev = b;
  const p = (i: number) => !!b[i] && !prev[i];
  const up = ay < -0.5 || !!b[12];
  const upP = up && !padUpPrev;
  padUpPrev = up;
  return {
    left: ax < -0.4 || !!b[14],
    right: ax > 0.4 || !!b[15],
    up,
    upP,
    down: ay > 0.5 || !!b[13],
    jump: !!b[0],
    jumpP: p(0),
    attackP: p(2),
    castP: p(3),
    dashP: p(1),
    prevP: p(4),
    nextP: p(5),
    item1P: p(6),
    rainP: p(7),
    healP: p(8),
    start: p(9),
  };
}

/** Lee el estado de este fotograma y vacía las teclas pulsadas. */
export function readInput(): Input & { pause: boolean; esc: boolean; enter: boolean; dirP: 'left' | 'right' | 'up' | 'down' | null } {
  const has = (...k: string[]) => k.some((x) => down.has(x));
  const tap = (...k: string[]) => k.some((x) => pressed.has(x));
  const g = pad();
  const inp = {
    left: has('ArrowLeft', 'a') || !!g?.left,
    right: has('ArrowRight', 'd') || !!g?.right,
    up: has('ArrowUp', 'w') || !!g?.up,
    upP: tap('ArrowUp', 'w') || !!g?.upP,
    down: has('ArrowDown', 's') || !!g?.down,
    jump: has('z', ' ', 'ArrowUp', 'w') || !!g?.jump,
    jumpP: tap('z', ' ', 'ArrowUp', 'w') || !!g?.jumpP,
    attackP: tap('x', 'j') || !!g?.attackP,
    castP: tap('c', 'k') || !!g?.castP,
    nextP: tap('e') || !!g?.nextP,
    prevP: tap('q') || !!g?.prevP,
    dashP: tap('Shift', 'l') || !!g?.dashP,
    healP: tap('v') || !!g?.healP,
    rainP: tap('b') || !!g?.rainP,
    item1P: tap('1') || !!g?.item1P,
    item2P: tap('2'),
    pause: tap('Escape', 'Enter', 'p') || !!g?.start,
    esc: tap('Escape') || !!g?.start,
    enter: tap('Enter', 'z', ' ') || !!g?.jumpP,
    dirP: (tap('ArrowLeft', 'a') ? 'left' : tap('ArrowRight', 'd') ? 'right' : tap('ArrowUp', 'w') ? 'up' : tap('ArrowDown', 's') ? 'down' : null) as 'left' | 'right' | 'up' | 'down' | null,
  };
  pressed.clear();
  return inp;
}
