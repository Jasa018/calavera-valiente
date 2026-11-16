// Tipos y constantes compartidos por la lógica (sin DOM ni canvas).

export const TILE = 18;
export const ROWS = 15;
export const VIEW_W = 480;
export const VIEW_H = 270;
export const FPS = 60;

export type SoundName =
  | 'jump' | 'coin' | 'gem' | 'hit' | 'hurt' | 'stomp' | 'swing' | 'throw' | 'dash' | 'pound'
  | 'bump' | 'break' | 'levelup' | 'spring' | 'heal' | 'checkpoint' | 'clear' | 'die' | 'boss'
  | 'select' | 'move' | 'cancel' | 'fire' | 'magic' | 'buy' | 'nomp' | 'splash';

export type GameEvent =
  | { t: 'sound'; s: SoundName }
  | { t: 'float'; x: number; y: number; text: string; color: string }
  | { t: 'levelup'; level: number; skills: string[] }
  | { t: 'shake'; n: number }
  | { t: 'boss'; name: string }
  | { t: 'parts'; x: number; y: number; color: string; n: number }
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
  attackP: boolean;
  throwP: boolean;
  dashP: boolean;
  healP: boolean;
  rainP: boolean;
  item1P: boolean;
  item2P: boolean;
}

export const NO_INPUT: Input = {
  left: false, right: false, up: false, down: false, jump: false,
  jumpP: false, attackP: false, throwP: false, dashP: false, healP: false, rainP: false, item1P: false, item2P: false,
};
