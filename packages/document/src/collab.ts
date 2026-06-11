import { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { COLLAB_ORIGIN } from './constants.js';

export interface CollabOptions {
  url: string;
  documentId: string;
  token: string;
  readOnly?: boolean;
  onStatus?: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

export class CollabSession {
  private provider: HocuspocusProvider | null = null;

  connect(ydoc: Y.Doc, options: CollabOptions): void {
    this.disconnect();
    this.provider = new HocuspocusProvider({
      url: options.url,
      name: options.documentId,
      document: ydoc,
      token: options.token,
      onConnect: () => options.onStatus?.('connected'),
      onDisconnect: () => options.onStatus?.('disconnected'),
      onStatus: ({ status }) => {
        if (status === 'connecting') options.onStatus?.('connecting');
      },
    });

    if (options.readOnly) {
      this.provider.setConfiguration({ token: options.token });
    }
  }

  getAwareness(): HocuspocusProvider['awareness'] | null {
    return this.provider?.awareness ?? null;
  }

  disconnect(): void {
    this.provider?.destroy();
    this.provider = null;
  }

  isConnected(): boolean {
    return this.provider?.isConnected ?? false;
  }

  waitForSynced(timeoutMs = 10_000): Promise<boolean> {
    const provider = this.provider;
    if (!provider) return Promise.resolve(false);
    if (provider.synced) return Promise.resolve(true);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        provider.off('synced', onSynced);
        resolve(provider.synced);
      }, timeoutMs);

      const onSynced = (): void => {
        clearTimeout(timer);
        provider.off('synced', onSynced);
        resolve(true);
      };

      provider.on('synced', onSynced);
    });
  }
}

export function isCollabOrigin(origin: unknown): boolean {
  return origin === COLLAB_ORIGIN;
}
