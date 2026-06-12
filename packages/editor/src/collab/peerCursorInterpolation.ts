import type { Vec2 } from '@rough/schema';
import type { RemotePeer } from './AwarenessSync.js';

interface CursorState {
  current: Vec2;
  target: Vec2;
}

export class PeerCursorInterpolator {
  private positions = new Map<number, CursorState>();

  updatePeers(peers: RemotePeer[]): void {
    for (const peer of peers) {
      const target = peer.state.cursor ?? { x: 0, y: 0 };
      const existing = this.positions.get(peer.clientId);
      if (!existing) {
        this.positions.set(peer.clientId, {
          current: { ...target },
          target: { ...target },
        });
      } else {
        existing.target = { ...target };
      }
    }

    const active = new Set(peers.map((p) => p.clientId));
    for (const clientId of this.positions.keys()) {
      if (!active.has(clientId)) this.positions.delete(clientId);
    }
  }

  tick(alpha = 0.25): void {
    for (const pos of this.positions.values()) {
      pos.current.x += (pos.target.x - pos.current.x) * alpha;
      pos.current.y += (pos.target.y - pos.current.y) * alpha;
    }
  }

  getCursor(clientId: number): Vec2 | null {
    return this.positions.get(clientId)?.current ?? null;
  }

  clear(): void {
    this.positions.clear();
  }
}
