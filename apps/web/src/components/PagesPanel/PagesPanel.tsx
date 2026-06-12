import { useEffect, useState } from 'react';
import type { Editor } from '@rough/editor';
import type { ID } from '@rough/schema';
import { useEditorStore } from '../../stores/editorStore';

interface PagesPanelProps {
  editorRef: React.RefObject<Editor | null>;
}

export function PagesPanel({ editorRef }: PagesPanelProps): JSX.Element {
  const documentVersion = useEditorStore((s) => s.documentVersion);
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const setCurrentPageId = useEditorStore((s) => s.setCurrentPageId);
  const bumpDocumentVersion = useEditorStore((s) => s.bumpDocumentVersion);
  const [editingId, setEditingId] = useState<ID | null>(null);
  const [editName, setEditName] = useState('');
  const [dragPageId, setDragPageId] = useState<ID | null>(null);
  const [dropBeforeId, setDropBeforeId] = useState<ID | null>(null);

  const editor = editorRef.current;
  const pages = editor?.getPages() ?? [];

  useEffect(() => {
    if (editor && !currentPageId) {
      setCurrentPageId(editor.getCurrentPageId());
    }
  }, [editor, currentPageId, setCurrentPageId, documentVersion]);

  const handleSwitch = (pageId: ID): void => {
    editorRef.current?.switchPage(pageId);
    setCurrentPageId(pageId);
  };

  const handleAdd = (): void => {
    const id = editorRef.current?.addPage();
    if (id) {
      editorRef.current?.switchPage(id);
      setCurrentPageId(id);
      bumpDocumentVersion();
    }
  };

  const handleDelete = (pageId: ID): void => {
    if (pages.length <= 1) return;
    editorRef.current?.removePage(pageId);
    bumpDocumentVersion();
    const nextId = editorRef.current?.getCurrentPageId();
    if (nextId) setCurrentPageId(nextId);
  };

  const startRename = (pageId: ID, name: string): void => {
    setEditingId(pageId);
    setEditName(name);
  };

  const commitRename = (pageId: ID): void => {
    editorRef.current?.renamePage(pageId, editName);
    setEditingId(null);
    bumpDocumentVersion();
  };

  const handleDragStart = (pageId: ID, e: React.DragEvent): void => {
    setDragPageId(pageId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pageId);
  };

  const handleDragOver = (pageId: ID, e: React.DragEvent): void => {
    if (!dragPageId || dragPageId === pageId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    setDropBeforeId(before ? pageId : null);
  };

  const handleDrop = (pageId: ID, e: React.DragEvent): void => {
    e.preventDefault();
    const editorInstance = editorRef.current;
    if (!editorInstance || !dragPageId || dragPageId === pageId) return;

    const ids = pages.map((p) => p.id);
    const fromIdx = ids.indexOf(dragPageId);
    if (fromIdx < 0) return;

    ids.splice(fromIdx, 1);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    let insertIdx = ids.indexOf(pageId);
    if (!before) insertIdx += 1;
    ids.splice(insertIdx, 0, dragPageId);

    editorInstance.reorderPages(ids);
    bumpDocumentVersion();
    setDragPageId(null);
    setDropBeforeId(null);
  };

  const handleDragEnd = (): void => {
    setDragPageId(null);
    setDropBeforeId(null);
  };

  return (
    <div className="panel pages-panel">
      <div className="panel-header">
        <span>页面</span>
        <button type="button" className="panel-icon-btn" title="新建页面" onClick={handleAdd}>
          +
        </button>
      </div>
      <ul className="pages-list">
        {pages.map((page) => (
          <li
            key={page.id}
            className={`pages-item ${page.id === currentPageId ? 'active' : ''} ${dragPageId === page.id ? 'dragging' : ''}`}
            onClick={() => handleSwitch(page.id)}
            onDoubleClick={() => startRename(page.id, page.name)}
            draggable
            onDragStart={(e) => handleDragStart(page.id, e)}
            onDragOver={(e) => handleDragOver(page.id, e)}
            onDrop={(e) => handleDrop(page.id, e)}
            onDragEnd={handleDragEnd}
          >
            {dropBeforeId === page.id && <div className="layer-drop-line layer-drop-line-top" />}
            {editingId === page.id ? (
              <input
                className="layer-rename-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => commitRename(page.id)}
                onKeyDown={(e) => e.key === 'Enter' && commitRename(page.id)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="pages-item-name">{page.name}</span>
            )}
            {pages.length > 1 && (
              <button
                type="button"
                className="layer-action-btn"
                title="删除页面"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(page.id);
                }}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
