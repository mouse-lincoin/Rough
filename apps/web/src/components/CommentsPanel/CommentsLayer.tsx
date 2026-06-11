import { useEffect } from 'react';
import type { Editor } from '@rough/editor';
import { useComments } from './commentsContext';
import { useEditorStore } from '../../stores/editorStore';

interface CommentsLayerProps {
  editorRef: React.MutableRefObject<Editor | null>;
}

export function CommentsLayer({ editorRef }: CommentsLayerProps): null {
  const { comments, activeThreadId } = useComments();
  const documentVersion = useEditorStore((s) => s.documentVersion);
  const currentPageId = useEditorStore((s) => s.currentPageId);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const roots = comments.filter((c) => !c.parentId);
    editor.setCommentPins(
      roots.map((c) => ({
        id: c.id,
        pageId: c.pageId,
        elementId: c.elementId,
        worldX: c.worldX,
        worldY: c.worldY,
        authorName: c.authorName,
        resolved: Boolean(c.resolvedAt),
      })),
    );
  }, [comments, editorRef, documentVersion, currentPageId]);

  useEffect(() => {
    editorRef.current?.setHighlightedCommentId(activeThreadId);
  }, [activeThreadId, editorRef]);

  return null;
}
