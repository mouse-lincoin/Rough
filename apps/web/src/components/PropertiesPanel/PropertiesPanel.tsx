import { useMemo } from 'react';
import type { Editor } from '@rough/editor';
import type {
  Effect,
  Element,
  FillStyle,
  FrameElement,
  RGBA,
  RectangleElement,
  SemanticTag,
  Stroke,
} from '@rough/schema';
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

  const SEMANTIC_TAGS: SemanticTag[] = [
    'navbar', 'sidebar', 'button', 'input', 'card', 'table', 'heading', 'paragraph',
    'label', 'search', 'tabs', 'modal', 'toast', 'annotation', 'page',
  ];

  const elements = useMemo(() => {
    const editor = editorRef.current;
    if (!editor) return [];
    return selectedIds
      .map((id) => {
        const pageEl = editor.document.getElement(id);
        if (pageEl) return pageEl;
        return editor.sceneGraph.getNode(id)?.element;
      })
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

  const fill0 = elements[0].fills[0];
  const fillType = fill0?.type ?? 'solid';
  const fillColor = fill0?.type === 'solid' ? fill0.color : null;
  const stroke0 = elements[0].strokes[0];
  const strokeWidth = stroke0?.width ?? 2;
  const strokeColor = stroke0?.color ?? { r: 26, g: 26, b: 26, a: 1 };
  const strokeStyle = stroke0?.style ?? 'solid';
  const hasShadow = elements.every((el) => el.effects.some((e) => e.type === 'drop-shadow'));
  const hasBlur = elements.every((el) => el.effects.some((e) => e.type === 'layer-blur'));
  const shadowEffect = elements[0].effects.find((e) => e.type === 'drop-shadow');
  const isRect = elements.every((e) => e.type === 'rectangle');
  const corner0 = isRect ? (elements[0] as RectangleElement).cornerRadius : 0;
  const parentEl = elements[0]?.parentId
    ? editorRef.current?.document.getElement(elements[0].parentId)
    : null;
  const inAutoLayoutParent =
    parentEl?.type === 'frame' && !!parentEl.autoLayout && elements.every((e) => e.parentId === elements[0].parentId);
  const sizingX = elements[0].layoutChild?.sizingX ?? 'fixed';
  const sizingY = elements[0].layoutChild?.sizingY ?? 'fixed';
  const cornerExpanded = isRect && Array.isArray(corner0) && corner0.length === 4;

  const isText = elements.every((e) => e.type === 'text');
  const isFrame = elements.every((e) => e.type === 'frame');
  const isInstance = elements.length === 1 && elements[0].type === 'instance';
  const instanceEl = isInstance ? elements[0] : null;
  const masterName =
    instanceEl?.type === 'instance'
      ? editorRef.current?.document.getComponent(instanceEl.componentId)?.name
      : null;

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
          <label className="prop-checkbox">
            <input
              type="checkbox"
              checked={cornerExpanded}
              onChange={(e) => {
                const el = elements[0] as RectangleElement;
                const r = Array.isArray(el.cornerRadius) ? el.cornerRadius[0] : el.cornerRadius;
                updateAll({
                  cornerRadius: e.target.checked ? [r, r, r, r] : r,
                } as Partial<Element>);
              }}
            />
            独立四角
          </label>
          {cornerExpanded ? (
            <div className="prop-grid">
              {(['TL', 'TR', 'BR', 'BL'] as const).map((label, i) => {
                const corners = Array.isArray(corner0) ? corner0 : [0, 0, 0, 0];
                return (
                  <PropField
                    key={label}
                    label={label}
                    value={corners[i] ?? 0}
                    onChange={(v) => {
                      const cur = [...corners] as [number, number, number, number];
                      cur[i] = parseNumInput(v, 0);
                      updateAll({ cornerRadius: cur } as Partial<Element>);
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <PropField
              label="R"
              value={Array.isArray(corner0) ? corner0[0] : corner0}
              onChange={(v) => {
                const r = parseNumInput(v, 0);
                updateAll({ cornerRadius: r } as Partial<Element>);
              }}
            />
          )}
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
          <label className="prop-checkbox">
            <input
              type="checkbox"
              checked={elements[0].type === 'frame' && !!elements[0].autoLayout}
              onChange={(e) => {
                const frame = elements[0] as FrameElement;
                updateAll({
                  autoLayout: e.target.checked
                    ? frame.autoLayout ?? {
                        direction: 'horizontal',
                        gap: 8,
                        padding: { top: 8, right: 8, bottom: 8, left: 8 },
                        alignItems: 'start',
                        justifyContent: 'start',
                      }
                    : null,
                } as Partial<Element>);
              }}
            />
            Auto Layout
          </label>
          {elements[0].type === 'frame' && elements[0].autoLayout && (
            <div className="prop-grid">
              <PropField
                label="间距"
                value={elements[0].autoLayout.gap}
                onChange={(v) => {
                  const gap = parseNumInput(v, 8);
                  updateAll({
                    autoLayout: { ...elements[0].autoLayout!, gap },
                  } as Partial<Element>);
                }}
              />
              <label className="prop-label">
                方向
                <select
                  className="prop-input"
                  value={elements[0].autoLayout.direction}
                  onChange={(e) => {
                    updateAll({
                      autoLayout: {
                        ...elements[0].autoLayout!,
                        direction: e.target.value as 'horizontal' | 'vertical',
                      },
                    } as Partial<Element>);
                  }}
                >
                  <option value="horizontal">水平</option>
                  <option value="vertical">垂直</option>
                </select>
              </label>
              <label className="prop-label">
                主轴对齐
                <select
                  className="prop-input"
                  value={elements[0].autoLayout.justifyContent}
                  onChange={(e) => {
                    updateAll({
                      autoLayout: {
                        ...elements[0].autoLayout!,
                        justifyContent: e.target.value as
                          | 'start'
                          | 'center'
                          | 'end'
                          | 'space-between',
                      },
                    } as Partial<Element>);
                  }}
                >
                  <option value="start">起始</option>
                  <option value="center">居中</option>
                  <option value="end">末尾</option>
                  <option value="space-between">两端对齐</option>
                </select>
              </label>
              <label className="prop-label">
                交叉轴对齐
                <select
                  className="prop-input"
                  value={elements[0].autoLayout.alignItems}
                  onChange={(e) => {
                    updateAll({
                      autoLayout: {
                        ...elements[0].autoLayout!,
                        alignItems: e.target.value as 'start' | 'center' | 'end',
                      },
                    } as Partial<Element>);
                  }}
                >
                  <option value="start">起始</option>
                  <option value="center">居中</option>
                  <option value="end">末尾</option>
                </select>
              </label>
            </div>
          )}
        </section>
      )}

      {inAutoLayoutParent && (
        <section className="prop-section">
          <div className="prop-section-title">布局子项</div>
          <div className="prop-grid">
            <label className="prop-label">
              宽度
              <select
                className="prop-input"
                value={sizingX}
                onChange={(e) => {
                  const sizing = e.target.value as 'fixed' | 'hug' | 'fill';
                  updateAll({
                    layoutChild: {
                      sizingX: sizing,
                      sizingY: elements[0].layoutChild?.sizingY ?? 'fixed',
                    },
                  } as Partial<Element>);
                }}
              >
                <option value="fixed">固定</option>
                <option value="hug">适应</option>
                <option value="fill">填充</option>
              </select>
            </label>
            <label className="prop-label">
              高度
              <select
                className="prop-input"
                value={sizingY}
                onChange={(e) => {
                  const sizing = e.target.value as 'fixed' | 'hug' | 'fill';
                  updateAll({
                    layoutChild: {
                      sizingX: elements[0].layoutChild?.sizingX ?? 'fixed',
                      sizingY: sizing,
                    },
                  } as Partial<Element>);
                }}
              >
                <option value="fixed">固定</option>
                <option value="hug">适应</option>
                <option value="fill">填充</option>
              </select>
            </label>
          </div>
        </section>
      )}

      {isInstance && instanceEl?.type === 'instance' && (
        <section className="prop-section">
          <div className="prop-section-title">实例</div>
          <p className="panel-subtitle">主组件: {masterName ?? '未知'}</p>
          <div className="distribute-row">
            <button
              type="button"
              className="align-btn"
              onClick={() => {
                editorRef.current?.editMasterComponent(instanceEl.componentId);
                bumpDocumentVersion();
              }}
            >
              编辑主组件
            </button>
            <button
              type="button"
              className="align-btn"
              onClick={() => {
                editorRef.current?.detachInstance();
                bumpDocumentVersion();
              }}
            >
              Detach
            </button>
          </div>
        </section>
      )}

      <section className="prop-section">
        <div className="prop-section-title">语义</div>
        <select
          className="prop-input"
          value={elements[0].semantic ?? ''}
          onChange={(e) => {
            const semantic = (e.target.value || null) as SemanticTag | null;
            updateAll({ semantic });
          }}
        >
          <option value="">无</option>
          {SEMANTIC_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </section>

      <section className="prop-section">
        <div className="prop-section-title">填充</div>
        <select
          className="prop-input"
          value={fillType}
          onChange={(e) => {
            const type = e.target.value as FillStyle['type'];
            const updated = elements.map((el) => {
              if (type === 'solid') {
                return { ...el, fills: [{ type: 'solid' as const, color: fillColor ?? PRESET_COLORS[0] }] };
              }
              if (type === 'hachure') {
                return {
                  ...el,
                  fills: [{ type: 'hachure' as const, color: fillColor ?? PRESET_COLORS[0], gap: 4, angle: 45 }],
                };
              }
              if (el.type !== 'image') return el;
              return {
                ...el,
                fills: [{ type: 'image' as const, assetId: el.assetId, mode: 'fill' as const }],
              };
            });
            editorRef.current?.updateElements(updated);
            bumpDocumentVersion();
          }}
        >
          <option value="solid">纯色</option>
          <option value="hachure">排线</option>
          <option value="image">图片</option>
        </select>
        {fillType !== 'image' && (
          <>
            <div className="color-swatches">
              {PRESET_COLORS.map((c) => (
                <button
                  key={rgbaToHex(c)}
                  type="button"
                  className="color-swatch"
                  style={{ background: rgbaToHex(c) }}
                  onClick={() => {
                    const updated = elements.map((el) => {
                      if (fillType === 'hachure') {
                        const prev = el.fills[0];
                        return {
                          ...el,
                          fills: [
                            {
                              type: 'hachure' as const,
                              color: c,
                              gap: prev?.type === 'hachure' ? prev.gap : 4,
                              angle: prev?.type === 'hachure' ? prev.angle : 45,
                            },
                          ],
                        };
                      }
                      return { ...el, fills: [{ type: 'solid' as const, color: c }] };
                    });
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
                  const updated = elements.map((el) => {
                    if (fillType === 'hachure') {
                      const prev = el.fills[0];
                      return {
                        ...el,
                        fills: [
                          {
                            type: 'hachure' as const,
                            color: c,
                            gap: prev?.type === 'hachure' ? prev.gap : 4,
                            angle: prev?.type === 'hachure' ? prev.angle : 45,
                          },
                        ],
                      };
                    }
                    return { ...el, fills: [{ type: 'solid' as const, color: c }] };
                  });
                  editorRef.current?.updateElements(updated);
                  bumpDocumentVersion();
                }}
              />
            )}
          </>
        )}
      </section>

      <section className="prop-section">
        <div className="prop-section-title">描边</div>
        <div className="color-swatches">
          {PRESET_COLORS.slice(0, 6).map((c) => (
            <button
              key={`stroke-${rgbaToHex(c)}`}
              type="button"
              className="color-swatch"
              style={{ background: rgbaToHex(c) }}
              onClick={() => {
                const updated = elements.map((el) => ({
                  ...el,
                  strokes: [{ color: c, width: strokeWidth, style: strokeStyle }],
                }));
                editorRef.current?.updateElements(updated);
                bumpDocumentVersion();
              }}
            />
          ))}
        </div>
        <select
          className="prop-input"
          value={strokeStyle}
          onChange={(e) => {
            const style = e.target.value as Stroke['style'];
            const updated = elements.map((el) => ({
              ...el,
              strokes: [{ color: strokeColor, width: strokeWidth, style }],
            }));
            editorRef.current?.updateElements(updated);
            bumpDocumentVersion();
          }}
        >
          <option value="solid">实线</option>
          <option value="dashed">虚线</option>
          <option value="dotted">点线</option>
        </select>
        <PropField
          label="宽度"
          value={strokeWidth}
          onChange={(v) => {
            const width = parseNumInput(v, 2);
            const updated = elements.map((el) => ({
              ...el,
              strokes: [{ color: strokeColor, width, style: strokeStyle }],
            }));
            editorRef.current?.updateElements(updated);
            bumpDocumentVersion();
          }}
        />
      </section>

      <section className="prop-section">
        <div className="prop-section-title">效果</div>
        <label className="prop-checkbox">
          <input
            type="checkbox"
            checked={hasShadow}
            onChange={(e) => {
              const updated = elements.map((el) => {
                const rest = el.effects.filter((fx) => fx.type !== 'drop-shadow');
                if (!e.target.checked) return { ...el, effects: rest };
                const shadow: Effect = {
                  type: 'drop-shadow',
                  offset: { x: 2, y: 4 },
                  blur: 8,
                  color: { r: 0, g: 0, b: 0, a: 0.25 },
                };
                return { ...el, effects: [...rest, shadow] };
              });
              editorRef.current?.updateElements(updated);
              bumpDocumentVersion();
            }}
          />
          投影
        </label>
        {hasShadow && shadowEffect?.type === 'drop-shadow' && (
          <div className="prop-grid">
            <PropField
              label="模糊"
              value={shadowEffect.blur}
              onChange={(v) => {
                const blur = parseNumInput(v, 8);
                const updated = elements.map((el) => ({
                  ...el,
                  effects: el.effects.map((fx) =>
                    fx.type === 'drop-shadow' ? { ...fx, blur } : fx,
                  ),
                }));
                editorRef.current?.updateElements(updated);
                bumpDocumentVersion();
              }}
            />
          </div>
        )}
        <label className="prop-checkbox">
          <input
            type="checkbox"
            checked={hasBlur}
            onChange={(e) => {
              const updated = elements.map((el) => {
                const rest = el.effects.filter((fx) => fx.type !== 'layer-blur');
                if (!e.target.checked) return { ...el, effects: rest };
                return {
                  ...el,
                  effects: [...rest, { type: 'layer-blur' as const, radius: 4 }],
                };
              });
              editorRef.current?.updateElements(updated);
              bumpDocumentVersion();
            }}
          />
          图层模糊
        </label>
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
          <label className="prop-field prop-field-full">
            <span className="prop-label">内容</span>
            <input
              className="prop-input"
              value={elements[0].text}
              onChange={(e) => {
                const updated = elements.map((el) => {
                  if (el.type !== 'text') return el;
                  return { ...el, text: e.target.value };
                });
                editorRef.current?.updateElements(updated);
                bumpDocumentVersion();
              }}
            />
          </label>
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
  const num = value === 'Mixed' ? 0 : value;

  const onLabelPointerDown = (e: React.PointerEvent): void => {
    if (value === 'Mixed') return;
    e.preventDefault();
    const startX = e.clientX;
    const startVal = num;
    const onMove = (ev: PointerEvent): void => {
      const delta = ev.clientX - startX;
      onChange(String(Math.round(startVal + delta)));
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <label className="prop-field">
      <span
        className="prop-label prop-label-draggable"
        onPointerDown={onLabelPointerDown}
        title="拖拽改值"
      >
        {label}
      </span>
      <input
        className="prop-input"
        value={value === 'Mixed' ? 'Mixed' : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
