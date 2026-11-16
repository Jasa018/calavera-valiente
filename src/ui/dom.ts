// Ventanas DOM sobre el lienzo. Pila de manejadores de teclado: solo recibe teclas el de arriba.
import { sfx } from './audio';

type KeyHandler = (e: KeyboardEvent) => void;
const stack: KeyHandler[] = [];

export function pushKeys(h: KeyHandler) {
  stack.push(h);
}
export function popKeys(h: KeyHandler) {
  const i = stack.lastIndexOf(h);
  if (i >= 0) stack.splice(i, 1);
}
export function menuOpen() {
  return stack.length > 0;
}

// En captura: corre antes que la lectura de teclas del juego, que ignora lo ya usado por un menú.
addEventListener(
  'keydown',
  (e) => {
    const h = stack[stack.length - 1];
    if (h) {
      e.preventDefault();
      h(e);
    }
  },
  true,
);

const overlay = () => document.getElementById('overlay')!;

export const isOk = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z';
export const isBack = (e: KeyboardEvent) => e.key === 'Escape' || e.key === 'x' || e.key === 'X' || e.key === 'Backspace';
export const isUp = (e: KeyboardEvent) => e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W';
export const isDown = (e: KeyboardEvent) => e.key === 'ArrowDown' || e.key === 's' || e.key === 'S';

export interface MenuItem {
  label: string;
  right?: string;
  desc?: string;
  disabled?: boolean;
  icon?: string;
}

export interface MenuOpts {
  title?: string;
  items: MenuItem[];
  start?: number;
  /** Texto bajo el título. */
  text?: string;
  wide?: boolean;
  /** Sin opción de cancelar (Esc no cierra). */
  noCancel?: boolean;
  onMove?: (i: number) => void;
  /** Posición en la pantalla. */
  pos?: 'center' | 'bottom';
}

function el(tag: string, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Lista con cursor. Devuelve el índice elegido, o -1 si se cancela. */
export function menu(o: MenuOpts): Promise<number> {
  return new Promise((done) => {
    const box = el('div', 'win' + (o.wide ? ' wide' : '') + (o.pos === 'bottom' ? ' bottom' : ''));
    if (o.title) box.append(el('div', 'title', o.title));
    if (o.text) box.append(el('div', 'text', o.text));
    const list = el('div', 'list');
    const desc = el('div', 'desc');
    const rows = o.items.map((it, i) => {
      const r = el('div', 'item' + (it.disabled ? ' off' : ''));
      if (it.icon) {
        const im = document.createElement('img');
        im.src = it.icon;
        im.alt = '';
        r.append(im);
      }
      r.append(el('span', 'lbl', it.label));
      if (it.right) r.append(el('span', 'right', it.right));
      r.addEventListener('mouseenter', () => set(i));
      r.addEventListener('click', () => choose(i));
      list.append(r);
      return r;
    });
    box.append(list);
    if (o.items.some((it) => it.desc)) box.append(desc);
    const wrap = el('div', 'shade');
    wrap.append(box);
    overlay().append(wrap);
    let cur = Math.max(0, Math.min(o.items.length - 1, o.start ?? 0));
    function set(i: number) {
      cur = i;
      rows.forEach((r, j) => r.classList.toggle('cur', j === cur));
      desc.textContent = o.items[cur]?.desc ?? '';
      rows[cur]?.scrollIntoView({ block: 'nearest' });
      o.onMove?.(cur);
    }
    function close(v: number) {
      popKeys(keys);
      wrap.remove();
      done(v);
    }
    function choose(i: number) {
      if (o.items[i]?.disabled) {
        sfx('cancel');
        return;
      }
      sfx('select');
      close(i);
    }
    const keys: KeyHandler = (e) => {
      if (isUp(e)) {
        set((cur - 1 + rows.length) % rows.length);
        sfx('move');
      } else if (isDown(e)) {
        set((cur + 1) % rows.length);
        sfx('move');
      } else if (isOk(e)) choose(cur);
      else if (isBack(e) && !o.noCancel) {
        sfx('cancel');
        close(-1);
      }
    };
    pushKeys(keys);
    set(cur);
  });
}

/** Texto a pantalla completa o en ventana; se cierra con cualquier tecla de aceptar. */
export function message(lines: string[], title?: string, opts: { story?: boolean } = {}): Promise<void> {
  return new Promise((done) => {
    const box = el('div', 'win' + (opts.story ? ' story' : ''));
    if (title) box.append(el('div', 'title', title));
    for (const l of lines) box.append(el('p', 'text', l));
    box.append(el('div', 'hint', '▶ Enter'));
    const wrap = el('div', 'shade' + (opts.story ? ' dark' : ''));
    wrap.append(box);
    overlay().append(wrap);
    const close = () => {
      popKeys(keys);
      wrap.remove();
      sfx('select');
      done();
    };
    const keys: KeyHandler = (e) => {
      if (isOk(e) || isBack(e)) close();
    };
    wrap.addEventListener('click', close);
    pushKeys(keys);
  });
}

export async function confirm(text: string, yes = 'Sí', no = 'No'): Promise<boolean> {
  const r = await menu({ text, items: [{ label: yes }, { label: no }], start: 1 });
  return r === 0;
}

/** Aviso breve que se borra solo. */
export function toast(text: string) {
  const t = el('div', 'toast', text);
  overlay().append(t);
  setTimeout(() => t.remove(), 1800);
}
