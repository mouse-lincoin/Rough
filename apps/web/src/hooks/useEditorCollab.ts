import { useEffect } from 'react';
import type { Editor } from '@rough/editor';
import type { ApiUser } from '../api/client';
import { getCollabToken, getCollabUrl } from '../api/client';
import { useEditorStore } from '../stores/editorStore';

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useEditorCollab(
  editorRef: React.RefObject<Editor | null>,
  editorReady: boolean,
  cloudDocumentId: string | null,
  user: ApiUser | null,
): void {
  const setCollabStatus = useEditorStore((s) => s.setCollabStatus);

  useEffect(() => {
    if (!editorReady || !cloudDocumentId || !user) {
      setCollabStatus('idle');
      return;
    }

    let cancelled = false;
    let disconnect: (() => void) | undefined;

    const connect = async (attempt = 0): Promise<void> => {
      const editor = editorRef.current;
      if (!editor || cancelled) return;

      setCollabStatus('connecting');

      try {
        const token = await getCollabToken();
        if (cancelled || !editorRef.current) return;

        editorRef.current.connectCollab({
          url: getCollabUrl(),
          documentId: cloudDocumentId,
          token,
          user: { id: user.id, name: user.name },
          onStatus: (status) => {
            if (status === 'connected') setCollabStatus('connected');
            else if (status === 'connecting') setCollabStatus('connecting');
            else setCollabStatus('disconnected');
          },
        });

        disconnect = () => editorRef.current?.disconnectCollab();
      } catch {
        if (cancelled) return;
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]!);
          if (!cancelled) await connect(attempt + 1);
          return;
        }
        setCollabStatus('failed');
      }
    };

    void connect();

    return () => {
      cancelled = true;
      disconnect?.();
      setCollabStatus('idle');
    };
  }, [editorReady, cloudDocumentId, user, editorRef, setCollabStatus]);
}
