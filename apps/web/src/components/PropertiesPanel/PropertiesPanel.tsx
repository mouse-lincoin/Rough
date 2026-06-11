import { useMemo } from 'react';
import type { Editor } from '@rough/editor';
import type { Element, RGBA, RectangleElement } from '@rough/schema';
import { useEditorStore } from '../../stores/editorStore';

interface PropertiesPanelProps {
  editorRef: React.RefObject<Editor | null>;
}

const PRESET_COLORS: RGBA[] = [
  { r: 26, g: 26, b: 26, a: 1 },
  { r: 255, g: 255, b: 255, a: 1 },
  { r: 105, g: 101, b: 219, a: 1 },
  { r: 239, g: 68, b: 68, a: 1 },
  { r: 34, g: 197, b: 94, a: 1 },
  { r: 59, g: 130, b: 246, a: 1 },
  { r: 234, g: 179, b: 8, a: 1 },
  { r: 168, g: 85, b: 247, a: 1 },
  { r: 156, g: 163, b: 175, a: 1 },
  { r: 248, g: 113, b: 113, a: 1 },
  { r: 74, g: 222, b: 128, a: 1 },
  { r: 96, g: 165, b: 250, a: 1 },
];

function rgbaToHex(c: RGBA): string {
  const r = c.r.toString(16).padStart(2, '0');
  const g = c.g.toString(16).padStart(2, '0');
  const b = c.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function parseNumInput(value: string, fallback: number): number {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    const a = parseFloat(match[1]);
    const op = match[2];
    const b = parseFloat(match[3]);
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (op === '/') return b !== 0 ? a / b : fallback;
  }
  const n = parseFloat(trimmed);
  return Number.isNaN(n) ? fallback : n;
}

function mixedValue<T>(values: T[]): T | 'Mixed' {
  if (values.length === 0) return 'Mixed';
  const first = values[0];
  return values.every((v) => v === first) ? first : 'Mixed';
}

export function PropertiesPanel({ editorRef }: PropertiesPanelProps): JSX.Element {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const documentVersion = useEditorStore((s) => s.documentVersion);
  const bumpDocumentVersion = useEditorStore((s) => s.bumpDocumentVersion);

  const elements = useMemo(() => {
    const editor = editorRef.current;
    if (!editor) return [];
    return selectedIds
      .map((id) => editor.document.getElement(id))
      .filter((e): e is Element => e !== undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, documentVersion, editorRef]);

  if (elements.length === 0) {
    return (
      <div className="panel properties-panel">
        <div className="panel-header">
          <span>属性</span>
        </div>
        <div className="panel-empty">未选中元素</div>
      </div>
    );
  }

  const updateAll = (patch: Partial<Element>): void => {
    const editor = editorRef.current;
    if (!editor) return;
    const updated = elements.map((el) => ({ ...el, ...patch } as Element));
    editor.updateElements(updated);
    bumpDocumentVersion();
  };

  const updateNum = (key: keyof Element, value: string): void => {
    const num = parseNumInput(value, 0);
    updateAll({ [key]: num } as Partial<Element>);
  };

  const x = mixedValue(elements.map((e) => Math.round(e.x)));
  const y = mixedValue(elements.map((e) => Math.round(e.y)));
  const w = mixedValue(elements.map((e) => Math.round(e.width)));
  const h = mixedValue(elements.map((e) => Math.round(e.height)));
  const rot = mixedValue(elements.map((e) => Math.round((e.rotation * 180) / Math.PI)));
  const opacity = mixedValue(elements.map((e) => e.opacity));
  const roughness = mixedValue(elements.map((e) => e.roughness));

  const fillColor =
    elements[0].fills[0]?.type === 'solid' ? elements[0].fills[0].color : null;
  const strokeWidth = elements[0].strokes[0]?.width ?? 2;

  const isText = elements.every((e) => e.type === 'text');
  const isRect = elements.every((e) => e.type === 'rectangle');
  const isFrame = elements.every((e) => e.type === 'frame');

  return (
    <div className="panel properties-panel">
      <div className="panel-header">
        <span>属性</span>
        <span className="panel-subtitle">{elements.length > 1 ? `${elements.length} 项` : ''}</span>
      </div>

      {elements.length >= 2 && (
        <section className="prop-section">
          <div className="prop-section-title">对齐</div>
          <div className="align-grid">
            {(
              [
                ['left', '左'],
                ['center-h', '中'],
                ['right', '右'],
                ['top', '顶'],
                ['center-v', '中'],
                ['bottom', '底'],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                type="button"
                className="align-btn"
                onClick={() => {
                  editorRef.current?.align(type);
                  bumpDocumentVersion();
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {elements.length >= 3 && (
            <div className="distribute-row">
              <button
                type="button"
                className="align-btn"
                onClick={() => {
                  editorRef.current?.distribute('horizontal');
                  bumpDocumentVersion();
                }}
              >
                横等距
              </button>
              <button
                type="button"
                className="align-btn"
                onClick={() => {
                  editorRef.current?.distribute('vertical');
                  bumpDocumentVersion();
                }}
              >
                纵等距
              </button>
            </div>
          )}
        </section>
      )}

      <section className="prop-section">
        <div className="prop-section-title">位置尺寸</div>
        <div className="prop-grid">
          <PropField label="X" value={x} onChange={(v) => updateNum('x', v)} />
          <PropField label="Y" value={y} onChange={(v) => updateNum('y', v)} />
          <PropField label="W" value={w} onChange={(v) => updateNum('width', v)} />
          <PropField label="H" value={h} onChange={(v) => updateNum('height', v)} />
          <PropField
            label="旋转"
            value={rot}
            onChange={(v) => {
              const deg = parseNumInput(v, 0);
              updateAll({ rotation: (deg * Math.PI) / 180 });
            }}
          />
        </div>
      </section>

      {isRect && (
        <section className="prop-section">
          <div className="prop-section-title">圆角</div>
          <PropField
            label="R"
            value={(elements[0] as RectangleElement).cornerRadius as number}
            onChange={(v) => {
              const r = parseNumInput(v, 0);
              updateAll({ cornerRadius: r } as Partial<Element>);
            }}
          />
        </section>
      )}

      {isFrame && (
        <section className="prop-section">
          <div className="prop-section-title">Frame</div>
          <label className="prop-checkbox">
            <input
              type="checkbox"
              checked={elements[0].type === 'frame' && elements[0].clipsContent}
              onChange={(e) => {
                updateAll({ clipsContent: e.target.checked } as Partial<Element>);
              }}
            />
            裁剪内容
          </label>
        </section>
      )}

      <section className="prop-section">
        <div className="prop-section-title">填充</div>
        <div className="color-swatches">
          {PRESET_COLORS.map((c) => (
            <button
              key={rgbaToHex(c)}
              type="button"
              className="color-swatch"
              style={{ background: rgbaToHex(c) }}
              onClick={() => {
                const updated = elements.map((el) => ({
                  ...el,
                  fills: [{ type: 'solid' as const, color: c }],
                }));
                editorRef.current?.updateElements(updated);
                bumpDocumentVersion();
              }}
            />
          ))}
        </div>
        {fillColor && (
          <input
            className="prop-input"
            value={rgbaToHex(fillColor)}
            onChange={(e) => {
              const hex = e.target.value.replace('#', '');
              if (hex.length !== 6) return;
              const c: RGBA = {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16),
                a: 1,
              };
              const updated = elements.map((el) => ({
                ...el,
                fills: [{ type: 'solid' as const, color: c }],
              }));
              editorRef.current?.updateElements(updated);
              bumpDocumentVersion();
            }}
          />
        )}
      </section>

      <section className="prop-section">
        <div className="prop-section-title">描边</div>
        <PropField
          label="宽度"
          value={strokeWidth}
          onChange={(v) => {
            const width = parseNumInput(v, 2);
            const updated = elements.map((el) => ({
              ...el,
              strokes: el.strokes.length > 0
                ? [{ ...el.strokes[0], width }]
                : [{ color: { r: 26, g: 26, b: 26, a: 1 }, width, style: 'solid' as const }],
            }));
            editorRef.current?.updateElements(updated);
            bumpDocumentVersion();
          }}
        />
      </section>

      <section className="prop-section">
        <div className="prop-section-title">外观</div>
        <PropField
          label="不透明度"
          value={opacity}
          onChange={(v) => updateNum('opacity', v)}
        />
        <div className="roughness-row">
          {[0, 1, 2].map((r) => (
            <button
              key={r}
              type="button"
              className={`roughness-btn ${roughness === r ? 'active' : ''}`}
              onClick={() => updateAll({ roughness: r })}
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            className="roughness-btn"
            title="重掷骰子"
            onClick={() =>
              updateAll({ roughSeed: Math.floor(Math.random() * 2 ** 31) })
            }
          >
            🎲
          </button>
        </div>
      </section>

      {isText && elements[0].type === 'text' && (
        <section className="prop-section">
          <div className="prop-section-title">文本</div>
          <PropField
            label="字号"
            value={elements[0].textStyle.fontSize}
            onChange={(v) => {
              const fontSize = parseNumInput(v, 16);
              const updated = elements.map((el) => {
                if (el.type !== 'text') return el;
                return {
                  ...el,
                  textStyle: { ...el.textStyle, fontSize },
                };
              });
              editorRef.current?.updateElements(updated);
              bumpDocumentVersion();
            }}
          />
          <div className="text-align-row">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                type="button"
                className={`align-btn ${elements[0].type === 'text' && elements[0].textStyle.textAlign === align ? 'active' : ''}`}
                onClick={() => {
                  const updated = elements.map((el) => {
                    if (el.type !== 'text') return el;
                    return { ...el, textStyle: { ...el.textStyle, textAlign: align } };
                  });
                  editorRef.current?.updateElements(updated);
                  bumpDocumentVersion();
                }}
              >
                {align === 'left' ? '左' : align === 'center' ? '中' : '右'}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PropField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | 'Mixed';
  onChange: (v: string) => void;
}): JSX.Element {
  return (
    <label className="prop-field">
      <span className="prop-label">{label}</span>
      <input
        className="prop-input"
        value={value === 'Mixed' ? 'Mixed' : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
