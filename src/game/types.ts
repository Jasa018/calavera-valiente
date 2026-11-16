// Tipos y constantes compartidos por la lógica (sin DOM ni canvas).

export const TILE = 18;
/** Alto de un nivel horizontal (y de la pantalla) en casillas. */
export const ROWS = 15;
export const VIEW_W = 480;
export const VIEW_H = 270;
export const FPS = 60;

export type SoundName =
  | 'jump' | 'coin' | 'gem' | 'hit' | 'hurt' | 'stomp' | 'swing' | 'throw' | 'dash' | 'pound'
  | 'bump' | 'break' | 'levelup' | 'spring' | 'heal' | 'checkpoint' | 'clear' | 'die' | 'boss'
  | 'select' | 'move' | 'cancel' | 'fire' | 'magic' | 'buy' | 'nomp' | 'splash'
  | 'key' | 'unlock' | 'lever' | 'door' | 'freeze' | 'thunder' | 'swim' | 'crack' | 'secret' | 'earth' | 'holy' | 'weak';

export type GameEvent =
  | { t: 'sound'; s: SoundName }
  | { t: 'float'; x: number; y: number; text: string; color: string }
  | { t: 'levelup'; level: number; skills: string[] }
  | { t: 'boss'; name: string }
  | { t: 'parts'; x: number; y: number; color: string; n: number }
  | { t: 'banner'; text: string; color: string }
  | { t: 'bolt'; x: number; y0: number; y1: number }
  | { t: 'ring'; x: number; y: number; r: number; color: string }
  | { t: 'door' }
  | { t: 'clear' }
  | { t: 'dead' };

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  /** Pulsadas en este fotograma. */
  jumpP: boolean;
  upP: boolean;
  attackP: boolean;
  castP: boolean;
  nextP: boolean;
  prevP: boolean;
  dashP: boolean;
  healP: boolean;
  rainP: boolean;
  item1P: boolean;
  item2P: boolean;
}

export const NO_INPUT: Input = {
  left: false, right: false, up: false, down: false, jump: false,
  jumpP: false, upP: false, attackP: false, castP: false, nextP: false, prevP: false,
  dashP: false, healP: false, rainP: false, item1P: false, item2P: false,
};

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
