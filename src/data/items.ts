// Objetos: consumibles y equipo. Los iconos salen de la hoja `dungeon` (Kenney, CC0).

export type ItemKind = 'consumible' | 'arma' | 'armadura';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  price: number;
  desc: string;
  icon: [number, number];
  heal?: number;
  mana?: number;
  atk?: number;
  def?: number;
}

const LIST: ItemDef[] = [
  { id: 'pocion', name: 'Poción de médula', kind: 'consumible', price: 15, desc: 'Cura 40 PV. Tecla 1.', icon: [7, 9], heal: 40 },
  { id: 'pocion_g', name: 'Médula concentrada', kind: 'consumible', price: 60, desc: 'Cura 120 PV. Se usa con la tecla 1 si no quedan pociones normales.', icon: [6, 9], heal: 120 },
  { id: 'eter', name: 'Éter de tumba', kind: 'consumible', price: 30, desc: 'Recupera 15 PM. Tecla 2.', icon: [8, 9], mana: 15 },

  { id: 'femur', name: 'Fémur', kind: 'arma', price: 0, desc: 'Tu propio fémur. Ataque +0.', icon: [7, 8], atk: 0 },
  { id: 'hueso_afilado', name: 'Hueso afilado', kind: 'arma', price: 80, desc: 'Ataque +4.', icon: [8, 8], atk: 4 },
  { id: 'espada_oxidada', name: 'Espada oxidada', kind: 'arma', price: 250, desc: 'Ataque +9.', icon: [9, 8], atk: 9 },
  { id: 'hacha_osaria', name: 'Hacha del osario', kind: 'arma', price: 600, desc: 'Ataque +15.', icon: [10, 9], atk: 15 },
  { id: 'guadana', name: 'Guadaña de la Parca', kind: 'arma', price: 1200, desc: 'Ataque +22.', icon: [11, 9], atk: 22 },

  { id: 'harapos', name: 'Harapos', kind: 'armadura', price: 0, desc: 'Lo que queda de tu mortaja. Defensa +0.', icon: [5, 8], def: 0 },
  { id: 'tapa_ataud', name: 'Tapa de ataúd', kind: 'armadura', price: 70, desc: 'Un escudo improvisado. Defensa +3.', icon: [6, 8], def: 3 },
  { id: 'cota_huesos', name: 'Cota de huesos', kind: 'armadura', price: 240, desc: 'Defensa +7.', icon: [5, 8], def: 7 },
  { id: 'placas_hierro', name: 'Placas de hierro', kind: 'armadura', price: 560, desc: 'Defensa +12.', icon: [6, 8], def: 12 },
  { id: 'manto_liche', name: 'Manto del liche', kind: 'armadura', price: 1100, desc: 'Defensa +18.', icon: [5, 8], def: 18 },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(LIST.map((i) => [i.id, i]));
