import { useEffect } from 'react';
import type { Editor } from '@rough/editor';
import type { ApiUser } from '../api/client';
import { getCollabToken, getCollabUrl } from '../api/client';

export function useEditorCollab(
  editorRef: React.RefObject<Editor | null>,
  editorReady: boolean,
  cloudDocumentId: string | null,
  user: ApiUser | null,
): void {
  useEffect(() => {
    if (!editorReady || !cloudDocumentId || !user) return;

    let cancelled = false;
    let disconnect: (() => void) | undefined;

    const connect = async (): Promise<void> => {
      const editor = editorRef.current;
      if (!editor || cancelled) return;

      try {
        const token = await getCollabToken();
        if (cancelled || !editorRef.current) return;

        editorRef.current.connectCollab({
          url: getCollabUrl(),
          documentId: cloudDocumentId,
          token,
          user: { id: user.id, name: user.name },
        });

        disconnect = () => editorRef.current?.disconnectCollab();
      } catch {
        // Cloud unavailable — stay in local-only mode
      }
    };

    void connect();

    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [editorReady, cloudDocumentId, user, editorRef]);
}
