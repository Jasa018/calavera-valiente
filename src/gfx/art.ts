// Arte propio en píxeles: Osmo el esqueleto, el Rey Diablo, proyectiles y adornos.
// Cada carácter es un píxel de la paleta; '.' es transparente.

const PAL: Record<string, string> = {
  k: '#2b1f33', // contorno (parecido al de los sprites de Kenney)
  w: '#f4efe1', // hueso
  g: '#c4b8a6', // hueso en sombra
  e: '#57d9a3', // brillo de los ojos
  r: '#d83c3c', // bufanda
  R: '#8f1f2b',
  y: '#f2c94c', // oro
  Y: '#b8860b',
  o: '#ff9040',
  p: '#6a2c91', // capa
  m: '#3d1a5c',
  s: '#c23030', // piel del Rey Diablo
  S: '#7a1424',
  h: '#e8dcc0', // cuernos
  f: '#ffe066',
  b: '#7ab8ff',
  B: '#3e6ad0',
  c: '#dff4ff',
};

export function pix(rows: string[], pal = PAL): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = rows.length;
  const x = c.getContext('2d')!;
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      const col = pal[ch];
      if (col) {
        x.fillStyle = col;
        x.fillRect(i, j, 1, 1);
      }
    }),
  );
  return c;
}

// ── Osmo (24 × 24, mirando a la derecha) ──
const HEAD = [
  '..kkkkkkkk..',
  '.kwwwwwwwwk.',
  'kwwwwwwwwwwk',
  'kwwwwwwwwwwk',
  'kwwwkkwwkkwk',
  'kwwwkekwkekk',
  'kgwwwwkwwwwk',
  '.kgwwwwwwgk.',
  '..kwkwkwkk..',
  '...kkkkkk...',
];
const TORSO = [
  '...krrrrk...',
  '..kRrrrrRk..',
  '...kwwwwk...',
  '...kkwwkk...',
  '...kwwwwk...',
  '....kwwk....',
  '...kwwwwk...',
];
const ARMS_DOWN = [
  '............',
  '..k......k..',
  '.kwk....kwk.',
  '.kwk....kwk.',
  '.kgk....kgk.',
  '..k......k..',
];
const ARMS_SWING = [
  '............',
  '..k...kkkkk.',
  '.kwk..kwwwwk',
  '.kwk..kkkkk.',
  '.kgk........',
  '..k.........',
];
const ARMS_UP = [
  '.........kk.',
  '..k.....kwk.',
  '.kwk...kwk..',
  '.kwk...kk...',
  '.kgk........',
  '..k.........',
];
const LEGS_STAND = [
  '...kwkkwk...',
  '...kwkkwk...',
  '...kgkkgk...',
  '...kwkkwk...',
  '..kwwkkwwk..',
  '..kkkkkkkk..',
];
const LEGS_WALK = [
  '...kwkkwk...',
  '..kwk..kwk..',
  '..kgk..kgk..',
  '.kwk....kwk.',
  'kwwk....kwwk',
  'kkkk....kkkk',
];
const LEGS_JUMP = [
  '...kwkkwk...',
  '...kwk.kwk..',
  '..kgk...kgk.',
  '..kwk..kwwk.',
  '.kwwk..kkk..',
  '.kkk........',
];
const SCARF_TAIL = [
  'kk..',
  'rRk.',
  'kRrk',
  '.kk.',
];

function stamp(dst: string[][], part: string[], ox: number, oy: number) {
  part.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch !== '.' && dst[oy + j] && ox + i < 24) dst[oy + j][ox + i] = ch;
    }),
  );
}

function hero(legs: string[], arms: string[], bob: number, tail: boolean): string[] {
  const g: string[][] = Array.from({ length: 24 }, () => Array(24).fill('.'));
  const top = 1 + bob;
  stamp(g, legs, 6, 18);
  stamp(g, TORSO, 6, top + 10);
  if (tail) stamp(g, SCARF_TAIL, 3, top + 10);
  stamp(g, arms, 6, top + 11);
  stamp(g, HEAD, 6, top);
  return g.map((r) => r.join(''));
}

const PILE = [
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '..........kkkkkkkk......',
  '.........kwwwwwwwwk.....',
  '........kwwwkkwwkkwk....',
  '........kwwwkkwwkkwk....',
  '..kk....kgwwwwkwwwwk.kk.',
  '.kwwk..kkkgwwwwwwgkkwwk.',
  'kwkkwkkwwwkkwkwkwkkwkkwk',
  'kwk.kwwwwgwwkkkkkwwwk.kk',
  '.k..kkkkkkkkkkkkkkkkk...',
  '........................',
];

// ── Rey Diablo (32 × 32) ──
const REY = [
  '....kk......................kk..',
  '...khk......................khk.',
  '...khhk..kk..kk..kk..kk...khhk..',
  '....khhkkykkkykkkykkkykk.khhk...',
  '.....khhkyyyyyyyyyyyyyykkhhk....',
  '......kkkYYYYYYYYYYYYYYkkkk.....',
  '........ksssssssssssssssk.......',
  '.......ksssssssssssssssssk......',
  '.......kskkkssssssssskkksk......',
  '.......kssffkssssssskffssk......',
  '.......ksskkkssssssskkkssk......',
  '.......kSssssssskkssssssSk......',
  '........kSsskwkwkwkwkssSk.......',
  '........kSsskkkkkkkkkssSk.......',
  '.........kSssssssssssSSk........',
  '.....kkkkkkSSSSSSSSSSSkkkkkk....',
  '...kkmmmmpkkkkkyykkkkkpmmmmkkk..',
  '..kmmmmmppprrkkyykkrrpppmmmmmk..',
  '.kmmmmmpppkrrrrkkrrrrkpppmmmmmk.',
  '.kmmmmppprrkrrrrrrrrkrrpppmmmmk.',
  'kmmmmmppkrrkrrrrrrrrkrrkppmmmmmk',
  'kmmmmpppkrrkRRRRRRRRkrrkpppmmmmk',
  'kmmmmpppkkkkYyyyyyyYkkkkpppmmmmk',
  'kmmmmppppkkRRRRRRRRRRkkppppmmmmk',
  'kmmmmpppppkRRRRRRRRRRkpppppmmmmk',
  'kmmmmpppppkRRRRkkRRRRkpppppmmmmk',
  'kmmmmmppppkRRRk..kRRRkppppmmmmmk',
  '.kmmmmmpppkRRRk..kRRRkpppmmmmmk.',
  '..kmmmmmppkkkkk..kkkkkppmmmmmk..',
  '...kkmmmmmkSSSk..kSSSkmmmmmkk...',
  '.....kkkkkkkkkk..kkkkkkkkkk.....',
  '................................',
];
// Segundo fotograma: los ojos brillan más
const REY2 = REY.map((r, j) => (j === 9 ? r.replace(/ff/g, 'yy') : r));

const BONE = [
  '.kk.....',
  'kwwk....',
  'kwwwk...',
  '.kkwwk..',
  '..kwwkk.',
  '...kwwwk',
  '....kwwk',
  '.....kk.',
];
const FIRE = [
  '..kkkk..',
  '.koooook',
  'kooyyook',
  'koyffyok',
  'koyffyok',
  'kooyyook',
  '.kooook.',
  '..kkkk..',
];
const FIRE2 = [
  '..kkkk..',
  '.kooook.',
  'koyyyook',
  'koyffyok',
  'kooffyok',
  'kooyyook',
  'koooook.',
  '..kkkk..',
];
const SKULL = [
  '..kkkkkk..',
  '.kwwwwwwk.',
  'kwwwwwwwwk',
  'kwkkwwkkwk',
  'kwkrwwkrwk',
  'kwwwkkwwwk',
  '.kwwwwwwk.',
  '..kwkwkwk.',
  '..kkkkkkk.',
];
const BUBBLE = [
  '..kkkkkk..',
  '.kbbbbbbk.',
  'kbccbbbbBk',
  'kbcbbbbbBk',
  'kbbbbbbbBk',
  'kbbbbbbbBk',
  'kbbbbbbBBk',
  '.kbbbbBBk.',
  '..kkkkkk..',
];
const ICE = [
  'kkkkkkkk',
  'kcccbbbk',
  'kccbbbBk',
  '.kcbbBk.',
  '.kcbbBk.',
  '..kbBk..',
  '..kbBk..',
  '...kk...',
];
const WAVE = [
  '.....kk.....',
  '...kkffkk...',
  '..kfyyyyfk..',
  '.kyoooooyk..',
  'kyoooooooyk.',
  'koooooooook.',
];
const CASTLE = [
  'k.k.k......k.k.k..',
  'kgkgk......kgkgk..',
  'kgggk.k.k..kgggk..',
  'kgggkkgkgkkkgggk..',
  'kgkgkgggggggkgkgk.',
  'kgggkgggggggkgggk.',
  'kgggkgkkkkkgkgggk.',
  'kgggkgkRRRkgkgggk.',
  'kggggkRRRRRkggggk.',
  'kggggkRRRRRkggggk.',
  'kggggkRRRRRkggggk.',
  'kkkkkkkkkkkkkkkkk.',
];
const SKULL_MAP = [
  '..kkkkkkkk..',
  '.kwwwwwwwwk.',
  'kwwwwwwwwwwk',
  'kwwkkwwkkwwk',
  'kwwkekwkekwk',
  'kgwwwwkwwwgk',
  '.kgwwwwwwgk.',
  '..kwkwkwkk..',
  '...krrrrk...',
  '..kRrrrrRk..',
  '..kwk..kwk..',
  '..kkk..kkk..',
];

export interface HeroFrames {
  idle: HTMLCanvasElement[];
  walk: HTMLCanvasElement[];
  jump: HTMLCanvasElement;
  fall: HTMLCanvasElement;
  swing: HTMLCanvasElement;
  air: HTMLCanvasElement;
  up: HTMLCanvasElement;
  pile: HTMLCanvasElement;
}

export interface Art {
  hero: HeroFrames;
  rey1: HTMLCanvasElement;
  rey2: HTMLCanvasElement;
  bone: HTMLCanvasElement;
  fire: HTMLCanvasElement[];
  skull: HTMLCanvasElement;
  bubble: HTMLCanvasElement;
  ice: HTMLCanvasElement;
  wave: HTMLCanvasElement;
  castle: HTMLCanvasElement;
  skullMap: HTMLCanvasElement;
}

let cache: Art | null = null;
export function art(): Art {
  if (cache) return cache;
  cache = {
    hero: {
      idle: [pix(hero(LEGS_STAND, ARMS_DOWN, 0, false)), pix(hero(LEGS_STAND, ARMS_DOWN, 1, false))],
      walk: [pix(hero(LEGS_WALK, ARMS_DOWN, 0, true)), pix(hero(LEGS_STAND, ARMS_DOWN, 1, true))],
      jump: pix(hero(LEGS_JUMP, ARMS_UP, 0, true)),
      fall: pix(hero(LEGS_JUMP, ARMS_DOWN, 0, true)),
      swing: pix(hero(LEGS_STAND, ARMS_SWING, 0, false)),
      air: pix(hero(LEGS_JUMP, ARMS_SWING, 0, true)),
      up: pix(hero(LEGS_STAND, ARMS_UP, 0, false)),
      pile: pix(PILE),
    },
    rey1: pix(REY),
    rey2: pix(REY2),
    bone: pix(BONE),
    fire: [pix(FIRE), pix(FIRE2)],
    skull: pix(SKULL),
    bubble: pix(BUBBLE),
    ice: pix(ICE),
    wave: pix(WAVE),
    castle: pix(CASTLE),
    skullMap: pix(SKULL_MAP),
  };
  return cache;
}
