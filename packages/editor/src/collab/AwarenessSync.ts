import type { DocumentStore } from '@rough/document';
import type { ID, Vec2 } from '@rough/schema';
import { awarenessColorForClient, type AwarenessUserState } from '@rough/shared';
import type { Viewport } from '../render/viewport.js';

export interface RemotePeer {
  clientId: number;
  state: AwarenessUserState;
}

export class AwarenessSync {
  private lastPublish = 0;
  private throttleMs = 60;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private document: DocumentStore,
    private viewport: Viewport,
    private user: { id: string; name: string },
  ) {}

  start(getPageId: () => ID, onChange: (peers: RemotePeer[]) => void): void {
    const awareness = this.document.getCollabAwareness();
    if (!awareness) return;

    const color = awarenessColorForClient(awareness.clientID);
    awareness.setLocalStateField('user', { ...this.user, color });
    awareness.setLocalStateField('pageId', getPageId());

    const emit = (): void => {
      const states = awareness.getStates();
      const peers: RemotePeer[] = [];
      states.forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        if (!state) return;
        peers.push({ clientId, state: state as AwarenessUserState });
      });
      onChange(peers);
    };

    awareness.on('change', emit);
    this.unsubscribe = () => awareness.off('change', emit);
    emit();
  }

  publishPointer(world: Vec2, selection: Set<ID>, pageId: ID): void {
    const awareness = this.document.getCollabAwareness();
    if (!awareness) return;

    const now = Date.now();
    if (now - this.lastPublish < this.throttleMs) return;
    this.lastPublish = now;

    awareness.setLocalState({
      user: awareness.getLocalState()?.user,
      cursor: world,
      selection: [...selection],
      viewport: { offset: { ...this.viewport.offset }, zoom: this.viewport.zoom },
      pageId,
    });
  }

  publishSelection(selection: Set<ID>, pageId: ID): void {
    const awareness = this.document.getCollabAwareness();
    if (!awareness) return;
    const current = awareness.getLocalState() as AwarenessUserState | null;
    awareness.setLocalState({
      ...current,
      user: current?.user,
      cursor: current?.cursor ?? null,
      selection: [...selection],
      viewport: { offset: { ...this.viewport.offset }, zoom: this.viewport.zoom },
      pageId,
    });
  }

  broadcastCommentEvent(event: 'created' | 'updated'): void {
    const awareness = this.document.getCollabAwareness();
    if (!awareness) return;
    const current = awareness.getLocalState() as AwarenessUserState | null;
    awareness.setLocalState({
      ...current,
      user: current?.user,
      cursor: current?.cursor ?? null,
      selection: current?.selection ?? [],
      viewport: current?.viewport ?? { offset: { ...this.viewport.offset }, zoom: this.viewport.zoom },
      pageId: current?.pageId ?? '',
      commentEvent: { type: event, at: Date.now() },
    });
  }

  onCommentEvent(handler: (event: { type: 'created' | 'updated'; at: number }) => void): () => void {
    const awareness = this.document.getCollabAwareness();
    if (!awareness) return () => {};

    const onChange = (): void => {
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const ev = (state as AwarenessUserState & { commentEvent?: { type: 'created' | 'updated'; at: number } })
          ?.commentEvent;
        if (ev) handler(ev);
      });
    };

    awareness.on('change', onChange);
    return () => awareness.off('change', onChange);
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    const awareness = this.document.getCollabAwareness();
    awareness?.setLocalState(null);
  }
}
