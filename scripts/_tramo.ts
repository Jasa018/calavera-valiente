// Imprime la cuadrícula montada de un tramo dentro de un nivel. Uso: npx tsx scripts/_tramo.ts 1-3 secreto_alto
import { LEVELS } from '../src/data/worlds';
import { buildLevel } from '../src/game/level';
const id = process.argv[2], name = process.argv[3];
const lv = buildLevel(LEVELS[id].def);
const s = lv.starts.find((q) => q.name === name)!;
const nxt = lv.starts[lv.starts.indexOf(s) + 1];
for (let y = 0; y < lv.h; y++) console.log(String(y).padStart(2), lv.grid[y].slice(s.at - 2, (nxt?.at ?? s.at + 26) + 2).join(''));
