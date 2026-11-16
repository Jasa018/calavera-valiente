// Lógica del mapamundi: nodos, caminos y qué se puede pisar. Sin DOM.
import { type MapNode, WORLDS, type WorldDef } from '../data/worlds';
import type { Save } from './progress';

export function nodeDone(save: Save, n: MapNode) {
  if (n.kind === 'nivel' || n.kind === 'castillo') return save.cleared.includes(n.level!);
  return true;
}

/** Se puede atravesar: niveles superados, tiendas, inicios y salidas abiertas. */
export function passable(save: Save, w: WorldDef, n: MapNode) {
  if (n.kind === 'nivel' || n.kind === 'castillo') return nodeDone(save, n);
  if (n.need) {
    const req = w.nodes.find((m) => m.id === n.need);
    return !!req && nodeDone(save, req);
  }
  return true;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export class WorldMap {
  move: { from: MapNode; to: MapNode; t: number } | null = null;
  face: 1 | -1 = 1;
  constructor(
    public save: Save,
    public worldIndex: number,
    public node: MapNode,
  ) {}

  get world() {
    return WORLDS[this.worldIndex];
  }

  static fromSave(save: Save) {
    const w = WORLDS[save.world] ?? WORLDS[0];
    const n = w.nodes.find((m) => m.id === save.node) ?? w.nodes[0];
    return new WorldMap(save, WORLDS.indexOf(w), n);
  }

  neighbor(dir: Dir): MapNode | null {
    const w = this.world;
    const n = this.node;
    for (const [a, b] of w.edges) {
      const other = a === n.id ? b : b === n.id ? a : null;
      if (!other) continue;
      const m = w.nodes.find((k) => k.id === other)!;
      const dx = m.x - n.x, dy = m.y - n.y;
      if ((dir === 'left' && dx < 0 && dy === 0) || (dir === 'right' && dx > 0 && dy === 0) || (dir === 'up' && dy < 0 && dx === 0) || (dir === 'down' && dy > 0 && dx === 0)) return m;
    }
    return null;
  }

  tryMove(dir: Dir): 'ok' | 'locked' | 'none' {
    if (this.move) return 'none';
    const to = this.neighbor(dir);
    if (!to) return 'none';
    if (!passable(this.save, this.world, this.node) && !passable(this.save, this.world, to)) return 'locked';
    if (to.need && !passable(this.save, this.world, to)) return 'locked';
    this.move = { from: this.node, to, t: 0 };
    if (to.x !== this.node.x) this.face = to.x > this.node.x ? 1 : -1;
    return 'ok';
  }

  /** Posición en casillas del mapa (con la animación de caminar). */
  pos() {
    if (!this.move) return { x: this.node.x, y: this.node.y };
    const { from, to, t } = this.move;
    const k = Math.min(1, t);
    return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
  }

  update() {
    if (!this.move) return false;
    const { from, to } = this.move;
    const dist = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    this.move.t += 0.12 / Math.max(1, dist / 2);
    if (this.move.t >= 1) {
      this.node = to;
      this.move = null;
      this.save.node = to.id;
      this.save.world = this.worldIndex;
      return true;
    }
    return false;
  }

  goWorld(index: number, nodeId: string) {
    this.worldIndex = index;
    this.node = WORLDS[index].nodes.find((n) => n.id === nodeId) ?? WORLDS[index].nodes[0];
    this.save.world = index;
    this.save.node = this.node.id;
  }
}
