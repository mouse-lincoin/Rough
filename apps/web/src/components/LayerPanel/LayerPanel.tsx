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

type DropZone = 'before' | 'inside' | 'after';

interface DropHint {
  rowId: ID;
  zone: DropZone;
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

function isDescendant(elements: Record<ID, Element>, ancestorId: ID, nodeId: ID): boolean {
  let current = elements[nodeId];
  while (current?.parentId) {
    current = elements[current.parentId];
    if (current?.id === ancestorId) return true;
  }
  return false;
}

function resolveDrop(
  rows: LayerRow[],
  dragId: ID,
  targetRow: LayerRow,
  zone: DropZone,
  elements: Record<ID, Element>,
): { parentId: ID | null; beforeSiblingId: ID | null } | null {
  if (dragId === targetRow.id) return null;
  if (isDescendant(elements, dragId, targetRow.id)) return null;

  const targetIndex = rows.findIndex((r) => r.id === targetRow.id);
  if (targetIndex < 0) return null;

  if (zone === 'inside') {
    if (targetRow.element.type !== 'frame' && targetRow.element.type !== 'group') return null;
    return { parentId: targetRow.id, beforeSiblingId: null };
  }

  const parentId = targetRow.element.parentId;
  if (zone === 'before') {
    const rowAbove = targetIndex > 0 ? rows[targetIndex - 1] : null;
    if (rowAbove && rowAbove.element.parentId === parentId) {
      return { parentId, beforeSiblingId: rowAbove.id };
    }
    return { parentId, beforeSiblingId: null };
  }

  return { parentId, beforeSiblingId: targetRow.id };
}

function zoneFromPointer(offsetY: number, rowHeight: number, canNest: boolean): DropZone {
  const ratio = offsetY / rowHeight;
  if (canNest && ratio > 0.25 && ratio < 0.75) return 'inside';
  if (ratio < 0.5) return 'before';
  return 'after';
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
  const [dragId, setDragId] = useState<ID | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
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
    if (!editorRef.current) return;
    const id = selectedIds[0];
    if (!id) return;
    const idx = rows.findIndex((r) => r.id === id);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: 'auto' });
  }, [selectedIds, rows, editorRef, virtualizer]);

  const handleSelect = (id: ID, e: React.MouseEvent): void => {
    const editor = editorRef.current;
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

  const handleDragStart = (id: ID, e: React.DragEvent): void => {
    const el = editorRef.current?.document.getElement(id);
    if (!el || el.locked) {
      e.preventDefault();
      return;
    }
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (row: LayerRow, e: React.DragEvent): void => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const canNest = row.element.type === 'frame' || row.element.type === 'group';
    const zone = zoneFromPointer(offsetY, rect.height, canNest);
    setDropHint({ rowId: row.id, zone });
  };

  const handleDrop = (row: LayerRow, e: React.DragEvent): void => {
    e.preventDefault();
    const editor = editorRef.current;
    if (!editor || !dragId) return;

    const elements = editor.document.getElements();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const canNest = row.element.type === 'frame' || row.element.type === 'group';
    const zone = zoneFromPointer(offsetY, rect.height, canNest);
    const target = resolveDrop(rows, dragId, row, zone, elements);
    if (target) {
      editor.moveElementInTree(dragId, target.parentId, target.beforeSiblingId);
      bumpDocumentVersion();
    }

    setDragId(null);
    setDropHint(null);
  };

  const handleDragEnd = (): void => {
    setDragId(null);
    setDropHint(null);
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
            const isDragging = dragId === el.id;
            const hint = dropHint?.rowId === row.id ? dropHint.zone : null;
            const canNest = row.element.type === 'frame' || row.element.type === 'group';
            return (
              <div
                key={row.id}
                className={`layer-row ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''} ${isDragging ? 'dragging' : ''} ${hint === 'inside' ? 'drop-inside' : ''}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: vItem.size,
                  transform: `translateY(${vItem.start}px)`,
                  paddingLeft: 8 + row.depth * 16,
                }}
                draggable={!el.locked}
                onDragStart={(e) => handleDragStart(el.id, e)}
                onDragOver={(e) => handleDragOver(row, e)}
                onDrop={(e) => handleDrop(row, e)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => {
                  if (dropHint?.rowId === row.id) setDropHint(null);
                }}
                onClick={(e) => handleSelect(el.id, e)}
                onDoubleClick={() => {
                  setEditingId(el.id);
                  setEditName(el.name);
                }}
              >
                {hint === 'before' && <div className="layer-drop-line layer-drop-line-top" />}
                {hint === 'after' && <div className="layer-drop-line layer-drop-line-bottom" />}
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
                {hint === 'inside' && canNest && (
                  <span className="layer-drop-inside-label">移入</span>
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
