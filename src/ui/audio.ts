// Sonido 8-bit sintetizado con WebAudio: efectos y música sencilla (sin archivos).
import type { SoundName } from '../game/types';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxOn = true;
let musicOn = true;
try {
  sfxOn = localStorage.getItem('calavera-sfx') !== '0';
  musicOn = localStorage.getItem('calavera-music') !== '0';
} catch {
  /* sin almacenamiento */
}

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const audioPrefs = {
  get sfx() {
    return sfxOn;
  },
  get music() {
    return musicOn;
  },
  toggleSfx() {
    sfxOn = !sfxOn;
    try {
      localStorage.setItem('calavera-sfx', sfxOn ? '1' : '0');
    } catch {
      /* nada */
    }
    return sfxOn;
  },
  toggleMusic() {
    musicOn = !musicOn;
    try {
      localStorage.setItem('calavera-music', musicOn ? '1' : '0');
    } catch {
      /* nada */
    }
    if (!musicOn) stopMusic();
    else if (current) playMusic(current, true);
    return musicOn;
  },
};

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, slide = 0, delay = 0, dest?: AudioNode) {
  const a = ac();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.05, delay = 0) {
  const a = ac();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = vol;
  s.buffer = buf;
  s.connect(g).connect(master);
  s.start(t);
}

export function sfx(n: SoundName) {
  if (!sfxOn) return;
  switch (n) {
    case 'jump': tone(300, 0.12, 'square', 0.05, 400); break;
    case 'coin': tone(988, 0.06, 'square', 0.05); tone(1319, 0.18, 'square', 0.05, 0, 0.06); break;
    case 'gem': [988, 1319, 1568, 1976].forEach((f, i) => tone(f, 0.1, 'square', 0.045, 0, i * 0.05)); break;
    case 'hit': noise(0.06, 0.08); tone(200, 0.06, 'square', 0.04, -100); break;
    case 'hurt': tone(400, 0.25, 'sawtooth', 0.06, -300); break;
    case 'stomp': tone(500, 0.1, 'square', 0.06, -380); noise(0.05, 0.05); break;
    case 'swing': noise(0.05, 0.03); tone(700, 0.05, 'triangle', 0.03, -400); break;
    case 'throw': tone(600, 0.08, 'triangle', 0.05, 300); break;
    case 'dash': noise(0.15, 0.05); tone(200, 0.15, 'sawtooth', 0.03, 300); break;
    case 'pound': noise(0.25, 0.12); tone(90, 0.25, 'square', 0.07, -50); break;
    case 'bump': tone(150, 0.08, 'square', 0.06, -40); break;
    case 'break': noise(0.18, 0.1); tone(300, 0.1, 'square', 0.04, -200); break;
    case 'levelup': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.05, 0, i * 0.09)); break;
    case 'spring': tone(200, 0.3, 'square', 0.05, 900); break;
    case 'heal': [660, 880, 1100].forEach((f, i) => tone(f, 0.12, 'triangle', 0.06, 0, i * 0.06)); break;
    case 'checkpoint': [523, 784, 1047].forEach((f, i) => tone(f, 0.15, 'square', 0.05, 0, i * 0.08)); break;
    case 'clear': [523, 659, 784, 659, 784, 1047, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.05, 0, i * 0.12)); break;
    case 'die': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'square', 0.05, -20, i * 0.18)); break;
    case 'boss': tone(110, 0.6, 'sawtooth', 0.07, -40); tone(116, 0.6, 'sawtooth', 0.05, -40); break;
    case 'select': tone(880, 0.06, 'square', 0.04); break;
    case 'move': tone(660, 0.03, 'square', 0.03); break;
    case 'cancel': tone(440, 0.08, 'square', 0.04, -200); break;
    case 'fire': noise(0.1, 0.04); tone(300, 0.12, 'sawtooth', 0.03, -150); break;
    case 'magic': [400, 600, 800, 1200].forEach((f, i) => tone(f, 0.1, 'triangle', 0.05, 200, i * 0.04)); break;
    case 'buy': tone(1319, 0.06, 'square', 0.05); tone(1760, 0.12, 'square', 0.05, 0, 0.07); break;
    case 'nomp': tone(180, 0.15, 'square', 0.05); break;
    case 'splash': noise(0.3, 0.08); tone(400, 0.2, 'sine', 0.05, -300); break;
    case 'key': [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.1, 'square', 0.05, 0, i * 0.06)); break;
    case 'unlock': tone(300, 0.08, 'square', 0.06, -100); [523, 784].forEach((f, i) => tone(f, 0.15, 'square', 0.05, 0, 0.1 + i * 0.08)); break;
    case 'lever': tone(220, 0.06, 'square', 0.06); tone(330, 0.1, 'square', 0.05, 0, 0.06); noise(0.05, 0.04); break;
    case 'door': tone(160, 0.2, 'triangle', 0.07, -60); noise(0.12, 0.03); break;
    case 'freeze': [1200, 1500, 1800].forEach((f, i) => tone(f, 0.08, 'triangle', 0.04, -200, i * 0.03)); break;
    case 'thunder': noise(0.4, 0.12); tone(80, 0.35, 'sawtooth', 0.06, -30); break;
    case 'swim': tone(500, 0.08, 'sine', 0.04, 200); break;
    case 'crack': noise(0.06, 0.07); tone(140, 0.06, 'square', 0.05, -40); break;
    case 'secret': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, 'triangle', 0.05, 0, i * 0.07)); break;
    case 'earth': noise(0.3, 0.1); tone(70, 0.3, 'square', 0.06, 30); break;
    case 'holy': [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.25, 'sine', 0.04, 0, i * 0.03)); break;
    case 'weak': noise(0.08, 0.1); tone(260, 0.1, 'square', 0.06, 200); break;
  }
}

// ── Música: secuenciador sencillo (melodía + bajo) ──
// Notas: 'C4', 'D#5', '-' silencio. Cada paso es una corchea.
type Song = { tempo: number; lead: string; bass: string; wave?: OscillatorType };

const SONGS: Record<string, Song> = {
  mapa: {
    tempo: 150,
    lead: 'E5 - G5 - A5 - G5 E5 D5 - E5 - C5 - D5 - - - E5 - G5 - A5 - C6 B5 A5 - G5 - E5 - G5 - - -',
    bass: 'C3 - G3 - C3 - G3 - A2 - E3 - A2 - E3 - F2 - C3 - F2 - C3 - G2 - D3 - G2 - D3 -',
  },
  pradera: {
    tempo: 168,
    lead: 'C5 E5 G5 E5 C6 - G5 - A5 F5 C5 F5 A5 - - - G5 E5 C5 E5 G5 - C6 - B5 G5 D5 G5 B5 - - - C5 E5 G5 E5 C6 - G5 - A5 C6 A5 F5 E5 - D5 - C5 - E5 - D5 - G4 - C5 - - - - - - -',
    bass: 'C3 - C3 G3 C3 - C3 G3 F2 - F2 C3 F2 - F2 C3 G2 - G2 D3 G2 - G2 D3 C3 - G2 - C3 - - -',
  },
  desierto: {
    tempo: 150,
    lead: 'D5 - D#5 - F#5 - G5 - A5 - G5 F#5 D#5 - D5 - A4 - D5 D#5 F#5 - D#5 D5 C5 - A#4 - A4 - - - D5 - D#5 - F#5 - A5 - A#5 - A5 G5 F#5 - D#5 - D5 - C5 - A#4 - C5 - D5 - - - - - - -',
    bass: 'D3 - A2 - D3 - A2 - D3 - A2 - D3 - A2 - C3 - G2 - C3 - G2 - A#2 - F2 - A2 - E2 -',
  },
  nieve: {
    tempo: 132,
    lead: 'A5 - E5 - C6 - B5 - A5 - G5 - E5 - - - F5 - A5 - G5 - F5 - E5 - C5 - D5 - E5 - - - A5 - E5 - C6 - D6 - E6 - D6 C6 B5 - G5 - A5 - B5 - G5 - A5 - - - - - - -',
    bass: 'A2 - E3 - A3 - E3 - F2 - C3 - F3 - C3 - D3 - A3 - D3 - A3 - E2 - B2 - E3 - B2 -',
    wave: 'triangle',
  },
  castillo: {
    tempo: 140,
    lead: 'A4 - C5 - D#5 - D5 - C5 - A4 - G#4 - A4 - - - E5 - D5 - C5 - B4 - G#4 - A4 - - - - - A4 C5 E5 - F5 E5 D#5 - E5 - C5 - B4 - G#4 - E4 - A4 - - - - - - -',
    bass: 'A2 A2 - A2 A2 - A2 - F2 F2 - F2 F2 - F2 - E2 E2 - E2 E2 - E2 - A2 A2 - A2 G#2 - E2 -',
  },
  bosque: {
    tempo: 120,
    lead: 'E5 - B4 - E5 - F#5 G5 - F#5 - E5 - D5 - B4 - - - C5 - E5 - G5 - A5 B5 - A5 - G5 - F#5 - E5 - - - D5 - F#5 - A5 - B5 - A5 G5 F#5 - D5 - E5 - - - - - - -',
    bass: 'E2 - B2 - E3 - B2 - C3 - G2 - C3 - G2 - D3 - A2 - D3 - A2 - E2 - B2 - E3 - B2 -',
    wave: 'triangle',
  },
  mar: {
    tempo: 104,
    lead: 'C5 - - E5 G5 - - E5 A5 - - G5 E5 - - - F5 - - A5 C6 - - A5 G5 - - E5 D5 - - - C5 - - E5 G5 - - C6 B5 - - G5 A5 - - - G5 - - E5 D5 - - C5 E5 - - - - - - -',
    bass: 'C3 - G2 - C3 - G2 - A2 - E2 - A2 - E2 - F2 - C3 - F2 - C3 - G2 - D3 - G2 - D3 -',
    wave: 'sine',
  },
  cueva: {
    tempo: 112,
    lead: 'A4 - - C5 - - E5 - D5 - C5 - B4 - - - G4 - - B4 - - D5 - C5 - B4 - A4 - - - F4 - - A4 - - C5 - B4 - A4 - G#4 - - - A4 - - - - - - - - - - - - - - -',
    bass: 'A2 - - A2 - - A2 - G2 - - G2 - - G2 - F2 - - F2 - - F2 - E2 - - E2 - E2 - -',
    wave: 'triangle',
  },
  cielo: {
    tempo: 156,
    lead: 'G5 - B5 - D6 - B5 - C6 - A5 - F#5 - D5 - G5 - B5 - D6 - E6 - D6 C6 B5 - A5 - G5 - - - E5 - G5 - C6 - B5 - A5 - F#5 - D5 - F#5 - A5 - G5 - - - - - - -',
    bass: 'G2 - D3 - G2 - D3 - C3 - G3 - C3 - G3 - A2 - E3 - A2 - E3 - D3 - A3 - D3 - A3 -',
  },
  carro: {
    tempo: 200,
    lead: 'E5 E5 - E5 G5 - E5 - D5 D5 - D5 F5 - D5 - C5 C5 - C5 E5 - C5 - B4 - D5 - G5 - - - E5 E5 - E5 A5 - G5 - F5 F5 - F5 A5 - F5 - E5 - D5 - C5 - B4 - C5 - - - - - - -',
    bass: 'A2 A3 A2 A3 A2 A3 A2 A3 G2 G3 G2 G3 G2 G3 G2 G3 F2 F3 F2 F3 F2 F3 F2 F3 E2 E3 E2 E3 E2 E3 E2 E3',
  },
  torre: {
    tempo: 144,
    lead: 'D5 - F5 - A5 - D6 - C6 - A5 - F5 - G5 - A5 - - - E5 - G5 - A#5 - D6 - C6 - A#5 - G5 - A5 - - - F5 - A5 - C6 - F6 - E6 - D6 - C#6 - A5 - D6 - - - - - - -',
    bass: 'D3 D3 - D3 A2 - A2 - A#2 A#2 - A#2 F2 - F2 - G2 G2 - G2 D3 - D3 - A2 A2 - A2 C#3 - E3 -',
  },
  jefe: {
    tempo: 176,
    lead: 'E5 E5 D#5 E5 G5 - F#5 E5 D#5 - B4 - C5 D5 D#5 - E5 E5 D#5 E5 A5 - G5 F#5 G5 - E5 - D#5 - B4 - C5 C5 B4 C5 E5 - D5 C5 B4 - G4 - A4 B4 C5 - B4 C5 D5 D#5 E5 - - - B4 - - - - - - -',
    bass: 'E2 E3 E2 E3 E2 E3 E2 E3 C2 C3 C2 C3 C2 C3 C2 C3 A1 A2 A1 A2 A1 A2 A1 A2 B1 B2 B1 B2 B1 B2 B1 B2',
  },
  final: {
    tempo: 184,
    lead: 'A4 - A5 - G5 - F5 E5 F5 - E5 D5 C5 - B4 - A4 - A5 - B5 - C6 B5 A5 - G#5 - E5 - - - F5 - F5 - E5 - D5 - C5 - B4 - C5 - D5 - E5 - G#5 - A5 - - - E5 - A4 - - - - - - -',
    bass: 'A1 A2 A1 A2 A1 A2 A1 A2 F1 F2 F1 F2 F1 F2 F1 F2 D2 D3 D2 D3 D2 D3 D2 D3 E2 E3 E2 E3 E2 E3 E2 E3',
  },
  victoria: {
    tempo: 120,
    lead: 'C5 - E5 - G5 - C6 - - - G5 - C6 - - - - - A5 - F5 - A5 - C6 - - - B5 - G5 - D6 - C6 - - - - - - - - - - -',
    bass: 'C3 - G3 - C3 - G3 - C3 - G3 - C3 - G3 - F2 - C3 - F2 - C3 - G2 - D3 - C3 - G2 - C3 - - - - - - - - - - -',
  },
};

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function freq(n: string) {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return 0;
  return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
}

let current: string | null = null;
let timer: number | null = null;
let musicBus: GainNode | null = null;

// ── Música grabada (CC0, ver public/music/CREDITOS.txt); si no carga, suena la sintetizada ──
const TRACKS: Record<string, string> = {
  titulo: 'titulo', mapa: 'mapa',
  pradera: 'aventura1', bosque: 'etapa1', desierto: 'aventura2', mar: 'etapa2', nieve: 'etapa1',
  cueva: 'etapa2', cielo: 'aventura2', castillo: 'aventura3', carro: 'aventura3', torre: 'aventura1',
  jefe: 'jefe', final: 'jefe', victoria: 'final',
};
let track: HTMLAudioElement | null = null;
const broken = new Set<string>();
let waiting: (() => void) | null = null;

function stopTrack() {
  if (track) {
    track.pause();
    track.src = '';
    track = null;
  }
  if (waiting) {
    removeEventListener('keydown', waiting, true);
    removeEventListener('pointerdown', waiting, true);
    waiting = null;
  }
}

/** Intenta sonar el tema grabado. Devuelve false si no hay o falló antes. */
function playTrack(name: string): boolean {
  const file = TRACKS[name];
  if (!file || broken.has(file) || typeof Audio === 'undefined') return false;
  const el = new Audio(import.meta.env.BASE_URL + 'music/' + file + '.mp3');
  el.loop = name !== 'victoria';
  el.volume = 0.45;
  el.addEventListener('error', () => {
    broken.add(file);
    if (track === el && current === name) {
      track = null;
      playMusic(name, true);
    }
  });
  track = el;
  el.play().catch(() => {
    // El navegador no deja sonar nada hasta que se pulsa una tecla: se reintenta entonces
    if (track !== el) return;
    waiting = () => {
      stopWaiting();
      if (track === el) void el.play().catch(() => {});
    };
    const stopWaiting = () => {
      if (!waiting) return;
      removeEventListener('keydown', waiting, true);
      removeEventListener('pointerdown', waiting, true);
      waiting = null;
    };
    addEventListener('keydown', waiting, true);
    addEventListener('pointerdown', waiting, true);
  });
  return true;
}

export function playMusic(name: string, force = false) {
  if (current === name && !force && (timer !== null || track)) return;
  current = name;
  stopTimer();
  stopTrack();
  if (!musicOn) return;
  if (playTrack(name)) return;
  const a = ac();
  if (!a || !master) return;
  const song = SONGS[name] ?? SONGS.mapa;
  musicBus = a.createGain();
  musicBus.gain.value = 1;
  musicBus.connect(master);
  const lead = song.lead.split(/\s+/);
  const bass = song.bass.split(/\s+/);
  const step = 60 / song.tempo / 2;
  let i = 0;
  let next = a.currentTime + 0.05;
  const bus = musicBus;
  const schedule = () => {
    if (!ctx) return;
    while (next < ctx.currentTime + 0.25) {
      const l = lead[i % lead.length];
      const b = bass[i % bass.length];
      const delay = next - ctx.currentTime;
      if (l && l !== '-') tone(freq(l), step * 1.6, song.wave ?? 'square', 0.022, 0, delay, bus);
      if (b && b !== '-') tone(freq(b), step * 0.9, 'triangle', 0.05, 0, delay, bus);
      next += step;
      i++;
      if (name === 'victoria' && i >= lead.length) {
        stopTimer();
        return;
      }
    }
  };
  schedule();
  timer = window.setInterval(schedule, 60);
}

function stopTimer() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  if (musicBus) {
    const b = musicBus;
    try {
      b.gain.setValueAtTime(0, ctx!.currentTime);
    } catch {
      /* nada */
    }
    setTimeout(() => b.disconnect(), 500);
    musicBus = null;
  }
}

export function stopMusic() {
  stopTimer();
  stopTrack();
}
