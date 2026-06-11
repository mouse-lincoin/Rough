import { useMemo, useState } from 'react';
import { KIT_CATEGORIES, createKitComponent, type KitComponentId } from '@rough/wireframe-kit';
import type { Editor } from '@rough/editor';
import { ROUGH_KIT_MIME } from '../CanvasHost';
import { useEditorStore } from '../../stores/editorStore';

interface ComponentsPanelProps {
  editorRef: React.RefObject<Editor | null>;
}

function insertAtViewportCenter(editor: Editor): { x: number; y: number } | null {
  const container = document.querySelector('.canvas-host');
  const rect = container?.getBoundingClientRect();
  if (!rect) return null;
  return editor.viewport.screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
}

export function ComponentsPanel({ editorRef }: ComponentsPanelProps): JSX.Element {
  const [query, setQuery] = useState('');
  const documentVersion = useEditorStore((s) => s.documentVersion);
  const bumpDocumentVersion = useEditorStore((s) => s.bumpDocumentVersion);

  const docComponents = useMemo(() => {
    void documentVersion;
    return editorRef.current?.getComponents() ?? [];
  }, [documentVersion, editorRef]);

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return KIT_CATEGORIES;
    return KIT_CATEGORIES.map((cat) => ({
      ...cat,
      ids: cat.ids.filter((id) => id.includes(q) || createKitComponent(id).name.toLowerCase().includes(q)),
    })).filter((cat) => cat.ids.length > 0);
  }, [query]);

  const handleInsert = (kitId: KitComponentId): void => {
    const editor = editorRef.current;
    if (!editor) return;
    const def = createKitComponent(kitId);
    const world = insertAtViewportCenter(editor);
    const x = world?.x ?? 120;
    const y = world?.y ?? 120;
    const id = editor.instantiateComponentAt(def, x, y);
    if (id) bumpDocumentVersion();
  };

  const handleEditMaster = (componentId: string): void => {
    editorRef.current?.editMasterComponent(componentId);
    bumpDocumentVersion();
  };

  const handleDeleteComponent = (componentId: string): void => {
    editorRef.current?.removeComponent(componentId);
    bumpDocumentVersion();
  };

  const handleKitDragStart = (kitId: KitComponentId, e: React.DragEvent): void => {
    e.dataTransfer.setData(ROUGH_KIT_MIME, kitId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="panel components-panel">
      <div className="panel-header">
        <span>组件</span>
      </div>
      <div className="components-search">
        <input
          className="prop-input"
          placeholder="搜索组件…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="components-scroll">
        {docComponents.length > 0 && (
          <section className="components-section">
            <div className="prop-section-title">文档组件</div>
            <ul className="components-list">
              {docComponents.map((c) => (
                <li key={c.id} className="components-list-row">
                  <button type="button" className="components-item" onClick={() => handleEditMaster(c.id)}>
                    {c.name}
                  </button>
                  <button
                    type="button"
                    className="layer-action-btn"
                    title="删除主组件"
                    onClick={() => handleDeleteComponent(c.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {filteredCategories.map((cat) => (
          <section key={cat.label} className="components-section">
            <div className="prop-section-title">{cat.label}</div>
            <ul className="components-list">
              {cat.ids.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className="components-item"
                    draggable
                    onDragStart={(e) => handleKitDragStart(id, e)}
                    onClick={() => handleInsert(id)}
                  >
                    {createKitComponent(id).name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
