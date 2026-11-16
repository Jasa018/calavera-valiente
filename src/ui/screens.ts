// Menús del juego: título, pausa, mapa, tienda, equipo, fin de nivel e historia.
import { ITEMS, type ItemDef } from '../data/items';
import { ELEMENTS, SKILLS } from '../data/skills';
import { MONSTERS } from '../data/monsters';
import { WORLDS } from '../data/worlds';
import { addItem, stats, useItem, xpToNext, type Save } from '../game/progress';
import type { Stage } from '../game/stage';
import type { Sheets } from '../gfx/sheets';
import { audioPrefs, sfx } from './audio';
import { confirm, menu, message, toast } from './dom';

let sheets: Sheets;
const icons: Record<string, string> = {};
export function setSheets(s: Sheets) {
  sheets = s;
}
function itemIcon(it: ItemDef) {
  if (icons[it.id]) return icons[it.id];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  c.getContext('2d')!.drawImage(sheets.dungeon, it.icon[0] * 16, it.icon[1] * 16, 16, 16, 0, 0, 16, 16);
  return (icons[it.id] = c.toDataURL());
}

export const CONTROLS = [
  'Flechas o A/D: moverte · ↑ delante de una puerta: entrar',
  'Z, Espacio o ↑: saltar (mantén para saltar más) · bajo el agua: nadar',
  '↓ + saltar sobre un tablón: bajar',
  'X o J: golpe de fémur (también mueve palancas y agrieta muros)',
  'C o K: lanzar el hechizo elegido · Q / E: cambiar de hechizo',
  'Mayús o L: embestida (nivel 6)',
  'En el aire, ↓ + saltar: pisotón (nivel 9)',
  'V: rearmarse (nivel 13) · B: lluvia de calaveras (nivel 23)',
  '1: poción · 2: éter · Esc o Enter: pausa',
  'Mando: A saltar, X golpe, Y hechizo, B embestida, LB/RB cambiar hechizo.',
];

export async function titleMenu(hasSave: boolean): Promise<'nueva' | 'continuar'> {
  for (;;) {
    const items = [{ label: 'Continuar', disabled: !hasSave }, { label: 'Nueva partida' }, { label: 'Controles' }, { label: 'Créditos' }];
    const r = await menu({ items, start: hasSave ? 0 : 1, noCancel: true, pos: 'bottom' });
    if (r === 0) return 'continuar';
    if (r === 1) {
      if (!hasSave || (await confirm('¿Empezar de nuevo? Se borrará la partida guardada.'))) return 'nueva';
    }
    if (r === 2) await message(CONTROLS, 'Controles');
    if (r === 3)
      await message(
        [
          'Juego, código, Osmo y el Rey Diablo: hechos para JASA-OS.',
          'Casillas, monedas, algunos monstruos e iconos: paquetes «Pixel Platformer» y «Tiny Dungeon» de Kenney (kenney.nl), licencia CC0.',
      'El resto de monstruos, los jefes y el mapa: arte propio.',
          'Música: Juhani Junkala (SubspaceAudio), licencia CC0, en OpenGameArt. Sonidos sintetizados en el navegador.',
        ],
        'Créditos',
      );
  }
}

export const INTRO = [
  'Hace cien años, el Rey Diablo apagó el sol de los reinos humanos y repartió sus tierras entre sus monstruos más temibles.',
  'Praderas, bosques, desiertos, mares, cumbres, volcanes y nubes: cada reino tiene su señor, y todos sirven al Rey Diablo.',
  'Hasta que, en el osario más olvidado del reino, unos huesos empezaron a temblar...',
  'Osmo no recuerda quién fue. Solo sabe dos cosas: que lleva una bufanda roja, y que el Rey Diablo tiene que caer.',
  'Consejo: algunos niveles esconden una salida secreta que abre caminos ocultos en el mapa.',
];

export const ENDING = [
  'El Rey Diablo se deshace en ceniza y, por primera vez en cien años, el sol vuelve a salir.',
  'Los humanos salen de sus refugios y no dan crédito: quien los ha salvado es un esqueleto con bufanda.',
  'Osmo sigue sin recordar quién fue. Pero ahora todos saben quién es.',
  '¡Gracias por jugar a Calavera Valiente!',
];

export async function pauseMenu(st: Stage): Promise<'seguir' | 'salir'> {
  for (;;) {
    const s = st.save;
    const items = [
      { label: 'Seguir' },
      { label: 'Objetos' },
      { label: 'Habilidades' },
      { label: 'Bestiario' },
      { label: 'Controles' },
      { label: `Música: ${audioPrefs.music ? 'sí' : 'no'}` },
      { label: `Efectos: ${audioPrefs.sfx ? 'sí' : 'no'}` },
      { label: 'Salir del nivel' },
    ];
    const r = await menu({ title: 'Pausa', items });
    if (r <= 0) return 'seguir';
    if (r === 1) await itemsMenu(s, true);
    if (r === 2) await skillsMenu(s);
    if (r === 3) await bestiaryMenu([...st.lvl.spawns.map((x) => x.id).filter((id) => MONSTERS[id]), ...(st.def.boss ? [st.def.boss] : [])]);
    if (r === 4) await message(CONTROLS, 'Controles');
    if (r === 5) audioPrefs.toggleMusic();
    if (r === 6) audioPrefs.toggleSfx();
    if (r === 7 && (await confirm('¿Salir del nivel? Perderás las monedas que hayas cogido en él.'))) return 'salir';
  }
}

async function itemsMenu(s: Save, canUse: boolean) {
  for (;;) {
    const ids = Object.keys(s.inv).filter((id) => ITEMS[id]?.kind === 'consumible' && s.inv[id] > 0);
    if (!ids.length) {
      await message(['No llevas objetos.'], 'Objetos');
      return;
    }
    const st = stats(s);
    const r = await menu({
      title: 'Objetos',
      text: canUse ? `PV ${s.hp}/${st.maxHp} · PM ${s.mp}/${st.maxMp}` : 'Se usan dentro de los niveles.',
      items: ids.map((id) => ({ label: ITEMS[id].name, right: `x${s.inv[id]}`, desc: ITEMS[id].desc, icon: itemIcon(ITEMS[id]) })),
    });
    if (r < 0) return;
    if (!canUse) continue;
    const res = useItem(s, ids[r]);
    if (res) {
      sfx('heal');
      toast(res);
    } else toast('Ahora no hace falta');
  }
}

async function skillsMenu(s: Save) {
  await menu({
    title: 'Habilidades',
    wide: true,
    text: 'Los hechizos (C) se eligen con Q y E. Un monstruo débil a un elemento recibe el doble de daño.',
    items: SKILLS.map((k) => ({
      label: s.level >= k.level ? k.name + (k.spell && s.spell === k.id ? ' ◀' : '') : `??? (nivel ${k.level})`,
      right: s.level >= k.level ? (k.mp ? `${k.mp} PM` : '') : '',
      desc: s.level >= k.level ? `${k.elem && k.spell ? `[${ELEMENTS[k.elem].name}] ` : ''}${k.desc} [${k.keys}]` : `Se aprende al llegar al nivel ${k.level}.`,
      disabled: s.level < k.level,
    })),
  });
}

/** Bestiario: debilidades de los monstruos. */
export async function bestiaryMenu(ids: string[]) {
  const list = [...new Set(ids)].map((id) => MONSTERS[id]).filter(Boolean);
  const el = (xs?: string[]) => (xs?.length ? xs.map((x) => ELEMENTS[x as keyof typeof ELEMENTS].name).join(', ') : '—');
  await menu({
    title: 'Bestiario',
    wide: true,
    items: list.map((m) => ({
      label: m.name,
      right: m.size === 'G' ? 'Grande' : m.size === 'M' ? 'Mediano' : m.size === 'J' ? 'Jefe' : 'Pequeño',
      desc: `Débil: ${el(m.weak)} · Resiste: ${el(m.resist)} · Inmune: ${el(m.immune)}`,
    })),
  });
}

function statusText(s: Save) {
  const st = stats(s);
  return [
    `Nivel ${s.level} · XP ${s.xp}/${xpToNext(s.level)}`,
    `PV ${st.maxHp} · PM ${st.maxMp}`,
    `Ataque ${st.atk} (${st.baseAtk} + ${ITEMS[s.weapon].name})`,
    `Defensa ${st.def} (${st.baseDef} + ${ITEMS[s.armor].name})`,
    `Monedas ${s.coins} · Monstruos vencidos ${s.kills} · Caídas ${s.deaths}`,
    `Niveles superados: ${s.cleared.length} · Salidas secretas: ${s.secrets.length}`,
  ];
}

async function equipMenu(s: Save) {
  for (;;) {
    const r = await menu({
      title: 'Equipo',
      items: [
        { label: 'Arma', right: ITEMS[s.weapon].name, desc: ITEMS[s.weapon].desc, icon: itemIcon(ITEMS[s.weapon]) },
        { label: 'Armadura', right: ITEMS[s.armor].name, desc: ITEMS[s.armor].desc, icon: itemIcon(ITEMS[s.armor]) },
      ],
    });
    if (r < 0) return;
    const kind = r === 0 ? 'arma' : 'armadura';
    const owned = s.owned.filter((id) => ITEMS[id]?.kind === kind);
    const cur = r === 0 ? s.weapon : s.armor;
    const k = await menu({
      title: kind === 'arma' ? 'Elige arma' : 'Elige armadura',
      items: owned.map((id) => ({ label: ITEMS[id].name, right: id === cur ? '◀' : '', desc: ITEMS[id].desc, icon: itemIcon(ITEMS[id]) })),
      start: owned.indexOf(cur),
    });
    if (k < 0) continue;
    if (r === 0) s.weapon = owned[k];
    else s.armor = owned[k];
  }
}

export async function mapMenu(s: Save): Promise<'titulo' | null> {
  for (;;) {
    const r = await menu({
      title: 'Menú',
      items: [{ label: 'Estado' }, { label: 'Habilidades' }, { label: 'Equipo' }, { label: 'Objetos' }, { label: 'Bestiario' }, { label: 'Controles' }, { label: `Música: ${audioPrefs.music ? 'sí' : 'no'}` }, { label: `Efectos: ${audioPrefs.sfx ? 'sí' : 'no'}` }, { label: 'Volver al título' }],
    });
    if (r < 0) return null;
    if (r === 0) await message(statusText(s), 'Osmo');
    if (r === 1) await skillsMenu(s);
    if (r === 2) await equipMenu(s);
    if (r === 3) await itemsMenu(s, false);
    if (r === 4) await bestiaryMenu(WORLDS[s.world].levels.flatMap((l) => [...Object.values(l.roster), ...(l.boss ? [l.boss] : [])]));
    if (r === 5) await message(CONTROLS, 'Controles');
    if (r === 6) audioPrefs.toggleMusic();
    if (r === 7) audioPrefs.toggleSfx();
    if (r === 8) return 'titulo';
  }
}

export async function shopMenu(s: Save, worldIndex: number, label: string) {
  const w = WORLDS[worldIndex];
  const stock = ['pocion', 'pocion_g', 'eter', ...w.shop];
  let cur = 0;
  await message([label + ': «Hasta los muertos necesitan provisiones. Echa un vistazo.»']);
  for (;;) {
    const r = await menu({
      title: `${label} · ${s.coins} monedas`,
      wide: true,
      start: cur,
      items: stock.map((id) => {
        const it = ITEMS[id];
        const owned = it.kind !== 'consumible' && s.owned.includes(id);
        const have = it.kind === 'consumible' ? ` (tienes ${s.inv[id] ?? 0})` : '';
        return { label: it.name + have, right: owned ? 'Tuyo' : `${it.price}`, desc: it.desc, icon: itemIcon(it), disabled: owned };
      }),
    });
    if (r < 0) return;
    cur = r;
    const it = ITEMS[stock[r]];
    if (s.coins < it.price) {
      sfx('cancel');
      toast('No te llega el dinero');
      continue;
    }
    s.coins -= it.price;
    sfx('buy');
    if (it.kind === 'consumible') {
      addItem(s, it.id);
      toast(`Compraste ${it.name}`);
    } else {
      s.owned.push(it.id);
      if (it.kind === 'arma') s.weapon = it.id;
      else s.armor = it.id;
      toast(`${it.name} equipado`);
    }
  }
}

export async function clearScreen(st: Stage) {
  const lines = [
    ...(st.exit === 's' ? ['¡Salida secreta! Se ha abierto un camino oculto en el mapa.'] : []),
    `Monedas: ${st.coinsGot}`,
    `Monstruos vencidos: ${st.kills}`,
    `Experiencia: ${st.xpGot}`,
    `Nivel de Osmo: ${st.save.level}`,
  ];
  await message(lines, `¡${st.def.slot === 'B' ? 'Sala de monedas' : st.def.slot === 'S' ? 'Nivel secreto' : st.def.id} superado!`);
}

export async function deadMenu(hasCheckpoint: boolean): Promise<'punto' | 'inicio' | 'mapa'> {
  const items = [{ label: 'Desde el punto de control', disabled: !hasCheckpoint }, { label: 'Desde el principio' }, { label: 'Volver al mapa' }];
  const r = await menu({
    title: 'Te has desmoronado...',
    text: 'Conservas la experiencia, pero pierdes las monedas cogidas desde el último punto de control.',
    items,
    start: hasCheckpoint ? 0 : 1,
    noCancel: true,
  });
  return r === 0 ? 'punto' : r === 1 ? 'inicio' : 'mapa';
}
