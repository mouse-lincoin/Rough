import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Editor } from '@rough/editor';
import type { Element, ID } from '@rough/schema';
import { useEditorStore } from '../../stores/editorStore';

interface LayerRow {
  id: ID;
  element: Element;
  depth: number;
  collapsed: boolean;
  hasChildren: boolean;
}

interface LayerPanelProps {
  editorRef: React.RefObject<Editor | null>;
}

const TYPE_ICONS: Record<string, string> = {
  frame: '▢',
  group: '⊞',
  rectangle: '▭',
  ellipse: '○',
  polygon: '⬡',
  line: '╱',
  arrow: '→',
  path: '✎',
  text: 'T',
  image: '🖼',
};

function buildFlatRows(
  elements: Record<ID, Element>,
  parentId: ID | null,
  depth: number,
  collapsed: Set<ID>,
): LayerRow[] {
  const children = Object.values(elements)
    .filter((e) => e.parentId === parentId)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey) || b.id.localeCompare(a.id));

  const rows: LayerRow[] = [];
  for (const el of children) {
    const childCount = Object.values(elements).filter((c) => c.parentId === el.id).length;
    const hasChildren =
      childCount > 0 && (el.type === 'frame' || el.type === 'group' || el.type === 'instance');
    const isCollapsed = collapsed.has(el.id);
    rows.push({ id: el.id, element: el, depth, collapsed: isCollapsed, hasChildren });
    if (hasChildren && !isCollapsed) {
      rows.push(...buildFlatRows(elements, el.id, depth + 1, collapsed));
    }
  }
  return rows;
}

export function LayerPanel({ editorRef }: LayerPanelProps): JSX.Element {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const documentVersion = useEditorStore((s) => s.documentVersion);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const bumpDocumentVersion = useEditorStore((s) => s.bumpDocumentVersion);
  const [collapsed, setCollapsed] = useState<Set<ID>>(new Set());
  const [editingId, setEditingId] = useState<ID | null>(null);
  const [editName, setEditName] = useState('');
  const [lastSelectedId, setLastSelectedId] = useState<ID | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const elements = editorRef.current?.document.getElements() ?? {};
    return buildFlatRows(elements, null, 0, collapsed);
  }, [editorRef, collapsed, documentVersion]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  useEffect(() => {
    if (!editor) return;
    const id = selectedIds[0];
    if (!id) return;
    const idx = rows.findIndex((r) => r.id === id);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: 'auto' });
  }, [selectedIds, rows, editor, virtualizer]);

  const handleSelect = (id: ID, e: React.MouseEvent): void => {
    if (!editor) return;
    if (e.metaKey || e.ctrlKey) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id];
      editor.setSelection(next);
      setSelectedIds(next);
    } else if (e.shiftKey && lastSelectedId) {
      const startIdx = rows.findIndex((r) => r.id === lastSelectedId);
      const endIdx = rows.findIndex((r) => r.id === id);
      if (startIdx >= 0 && endIdx >= 0) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const range = rows.slice(from, to + 1).map((r) => r.id);
        editor.setSelection(range);
        setSelectedIds(range);
      }
    } else {
      editor.setSelection([id]);
      setSelectedIds([id]);
      setLastSelectedId(id);
    }
  };

  const toggleCollapse = (id: ID): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLocked = (el: Element): void => {
    editorRef.current?.updateElementProperty(el.id, { locked: !el.locked });
    bumpDocumentVersion();
  };

  const toggleVisible = (el: Element): void => {
    editorRef.current?.updateElementProperty(el.id, { visible: !el.visible });
    bumpDocumentVersion();
  };

  const commitRename = (id: ID): void => {
    editorRef.current?.updateElementProperty(id, { name: editName });
    setEditingId(null);
    bumpDocumentVersion();
  };

  return (
    <div className="panel layer-panel">
      <div className="panel-header">
        <span>图层</span>
      </div>
      <div ref={parentRef} className="layer-list-scroll">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = rows[vItem.index];
            const el = row.element;
            const isSelected = selectedIds.includes(el.id);
            return (
              <div
                key={row.id}
                className={`layer-row ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: vItem.size,
                  transform: `translateY(${vItem.start}px)`,
                  paddingLeft: 8 + row.depth * 16,
                }}
                onClick={(e) => handleSelect(el.id, e)}
                onDoubleClick={() => {
                  setEditingId(el.id);
                  setEditName(el.name);
                }}
              >
                {row.hasChildren ? (
                  <button
                    type="button"
                    className="layer-collapse-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(el.id);
                    }}
                  >
                    {row.collapsed ? '▸' : '▾'}
                  </button>
                ) : (
                  <span className="layer-collapse-spacer" />
                )}
                <span className="layer-type-icon">{TYPE_ICONS[el.type] ?? '?'}</span>
                {editingId === el.id ? (
                  <input
                    className="layer-rename-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => commitRename(el.id)}
                    onKeyDown={(e) => e.key === 'Enter' && commitRename(el.id)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span className="layer-name">{el.name || el.type}</span>
                )}
                <div className="layer-actions">
                  <button
                    type="button"
                    className="layer-action-btn"
                    title={el.visible ? '隐藏' : '显示'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisible(el);
                    }}
                  >
                    {el.visible ? '👁' : '○'}
                  </button>
                  <button
                    type="button"
                    className="layer-action-btn"
                    title={el.locked ? '解锁' : '锁定'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLocked(el);
                    }}
                  >
                    {el.locked ? '🔒' : '🔓'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
