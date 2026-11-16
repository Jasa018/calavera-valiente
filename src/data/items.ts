// Objetos: consumibles y equipo. Los iconos salen de la hoja `dungeon` (Kenney, CC0).
import type { Element } from './skills';

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
  /** Elemento del golpe de fémur con esta arma. */
  elem?: Element;
  /** Solo se consigue en un cofre secreto. */
  treasure?: boolean;
}

const LIST: ItemDef[] = [
  { id: 'pocion', name: 'Poción de médula', kind: 'consumible', price: 15, desc: 'Cura 50 PV. Tecla 1.', icon: [7, 9], heal: 50 },
  { id: 'pocion_g', name: 'Médula concentrada', kind: 'consumible', price: 70, desc: 'Cura 200 PV. Se usa con la tecla 1 si no quedan pociones normales.', icon: [6, 9], heal: 200 },
  { id: 'eter', name: 'Éter de tumba', kind: 'consumible', price: 30, desc: 'Recupera 20 PM. Tecla 2.', icon: [8, 9], mana: 20 },

  { id: 'femur', name: 'Fémur', kind: 'arma', price: 0, desc: 'Tu propio fémur. Ataque +0.', icon: [7, 8], atk: 0 },
  { id: 'hueso_afilado', name: 'Hueso afilado', kind: 'arma', price: 120, desc: 'Ataque +4.', icon: [8, 8], atk: 4 },
  { id: 'espada_oxidada', name: 'Espada oxidada', kind: 'arma', price: 300, desc: 'Ataque +9.', icon: [9, 8], atk: 9 },
  { id: 'maza_tumba', name: 'Maza de tumba', kind: 'arma', price: 540, desc: 'Ataque +15.', icon: [9, 9], atk: 15 },
  { id: 'hacha_osaria', name: 'Hacha del osario', kind: 'arma', price: 810, desc: 'Ataque +22.', icon: [10, 9], atk: 22 },
  { id: 'lanza_coral', name: 'Lanza de coral', kind: 'arma', price: 1000, desc: 'Ataque +30.', icon: [11, 10], atk: 30 },
  { id: 'espada_runica', name: 'Espada rúnica', kind: 'arma', price: 1300, desc: 'Ataque +39.', icon: [10, 8], atk: 39 },
  { id: 'guadana', name: 'Guadaña de la Parca', kind: 'arma', price: 1650, desc: 'Ataque +49.', icon: [11, 9], atk: 49 },

  { id: 'harapos', name: 'Harapos', kind: 'armadura', price: 0, desc: 'Lo que queda de tu mortaja. Defensa +0.', icon: [5, 8], def: 0 },
  { id: 'tapa_ataud', name: 'Tapa de ataúd', kind: 'armadura', price: 70, desc: 'Un escudo improvisado. Defensa +3.', icon: [6, 8], def: 3 },
  { id: 'cota_huesos', name: 'Cota de huesos', kind: 'armadura', price: 270, desc: 'Defensa +7.', icon: [5, 8], def: 7 },
  { id: 'escudo_lapida', name: 'Escudo de lápida', kind: 'armadura', price: 480, desc: 'Defensa +12.', icon: [6, 8], def: 12 },
  { id: 'placas_hierro', name: 'Placas de hierro', kind: 'armadura', price: 720, desc: 'Defensa +18.', icon: [5, 8], def: 18 },
  { id: 'escamas', name: 'Cota de escamas', kind: 'armadura', price: 900, desc: 'Defensa +25.', icon: [6, 8], def: 25 },
  { id: 'manto_escarcha', name: 'Manto de escarcha', kind: 'armadura', price: 1150, desc: 'Defensa +33.', icon: [5, 8], def: 33 },
  { id: 'manto_liche', name: 'Manto del liche', kind: 'armadura', price: 1450, desc: 'Defensa +42.', icon: [6, 8], def: 42 },

  // Tesoros de los cofres secretos
  { id: 'femur_ardiente', name: 'Fémur ardiente', kind: 'arma', price: 0, treasure: true, desc: 'Ataque +7. Tus golpes son de fuego.', icon: [11, 8], atk: 7, elem: 'fuego' },
  { id: 'escudo_raices', name: 'Escudo de raíces', kind: 'armadura', price: 0, treasure: true, desc: 'Defensa +10.', icon: [6, 8], def: 10 },
  { id: 'daga_escarcha', name: 'Daga de escarcha', kind: 'arma', price: 0, treasure: true, desc: 'Ataque +19. Tus golpes son de hielo.', icon: [7, 10], atk: 19, elem: 'hielo' },
  { id: 'tridente', name: 'Tridente del abismo', kind: 'arma', price: 0, treasure: true, desc: 'Ataque +28. Tus golpes son de rayo.', icon: [11, 10], atk: 28, elem: 'rayo' },
  { id: 'coraza_glaciar', name: 'Coraza glaciar', kind: 'armadura', price: 0, treasure: true, desc: 'Defensa +27.', icon: [5, 8], def: 27 },
  { id: 'martillo_volcan', name: 'Martillo del volcán', kind: 'arma', price: 0, treasure: true, desc: 'Ataque +42. Tus golpes son de tierra.', icon: [9, 9], atk: 42, elem: 'tierra' },
  { id: 'manto_celeste', name: 'Manto celeste', kind: 'armadura', price: 0, treasure: true, desc: 'Defensa +38.', icon: [6, 8], def: 38 },
  { id: 'espada_alba', name: 'Espada del alba', kind: 'arma', price: 0, treasure: true, desc: 'Ataque +54. Tus golpes son de luz.', icon: [10, 8], atk: 54, elem: 'luz' },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(LIST.map((i) => [i.id, i]));
