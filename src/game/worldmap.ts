// Lógica del mapamundi: nodos, caminos que se abren y movimiento. Sin DOM.
import { type MapEdge, type MapNode, WORLDS, type WorldDef } from '../data/worlds';
import type { Save } from './progress';

export function nodeDone(save: Save, n: MapNode) {
  if (n.level) return save.cleared.includes(n.level);
  if (n.kind === 'cofre') return save.opened.includes(n.id);
  return true;
}

/** Un camino está abierto si se superó el nivel que lo abre (por la salida que toca). */
export function edgeOpen(save: Save, e: MapEdge) {
  if (!e.by) return true;
  return e.secret ? save.secrets.includes(e.by) : save.cleared.includes(e.by);
}

/** Un nodo se ve si algún camino abierto llega a él. */
export function nodeVisible(save: Save, w: WorldDef, n: MapNode) {
  if (n.kind === 'inicio' || n.kind === 'volver') return true;
  return w.edges.some((e) => (e.a === n.id || e.b === n.id) && edgeOpen(save, e));
}

/** ¿Se pueden ver los caminos cerrados hacia este nodo? (los secretos no) */
export function edgeHinted(save: Save, w: WorldDef, e: MapEdge) {
  if (e.secret) return false;
  const a = w.nodes.find((n) => n.id === e.a)!;
  return nodeVisible(save, w, a);
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

  /** Vecino en esa dirección y el camino que lleva a él. */
  neighbor(dir: Dir, from = this.node): { node: MapNode; edge: MapEdge } | null {
    const w = this.world;
    for (const e of w.edges) {
      const other = e.a === from.id ? e.b : e.b === from.id ? e.a : null;
      if (!other) continue;
      const m = w.nodes.find((k) => k.id === other)!;
      const dx = m.x - from.x, dy = m.y - from.y;
      if ((dir === 'left' && dx < 0 && dy === 0) || (dir === 'right' && dx > 0 && dy === 0) || (dir === 'up' && dy < 0 && dx === 0) || (dir === 'down' && dy > 0 && dx === 0))
        return { node: m, edge: e };
    }
    return null;
  }

  tryMove(dir: Dir): 'ok' | 'locked' | 'none' {
    if (this.move) return 'none';
    const nb = this.neighbor(dir);
    if (!nb) return 'none';
    if (!edgeOpen(this.save, nb.edge)) return nb.edge.secret ? 'none' : 'locked';
    this.move = { from: this.node, to: nb.node, t: 0 };
    if (nb.node.x !== this.node.x) this.face = nb.node.x > this.node.x ? 1 : -1;
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
    this.move.t += 0.14 / Math.max(1, dist / 2);
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
