import type { ToolName } from '@rough/editor';
import { useEditorStore } from '../../stores/editorStore';

const TOOLS: { name: ToolName; label: string; shortcut: string }[] = [
  { name: 'select', label: '选择', shortcut: 'V' },
  { name: 'hand', label: '抓手', shortcut: 'H' },
  { name: 'rectangle', label: '矩形', shortcut: 'R' },
  { name: 'ellipse', label: '椭圆', shortcut: 'O' },
  { name: 'line', label: '直线', shortcut: 'L' },
  { name: 'pen', label: '画笔', shortcut: 'P' },
];

export function Toolbar(): JSX.Element {
  const activeTool = useEditorStore((s) => s.activeTool);
  const cleanMode = useEditorStore((s) => s.cleanMode);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setCleanMode = useEditorStore((s) => s.setCleanMode);
  const editorRef = useEditorStore((s) => s.editorRef);

  const handleToolClick = (tool: ToolName): void => {
    editorRef.current?.setTool(tool);
    setActiveTool(tool);
  };

  const handleCleanToggle = (): void => {
    const next = !cleanMode;
    editorRef.current?.setCleanMode(next);
    setCleanMode(next);
  };

  return (
    <div className="toolbar">
      {TOOLS.map((tool) => (
        <button
          key={tool.name}
          type="button"
          className={`toolbar-btn ${activeTool === tool.name ? 'active' : ''}`}
          title={`${tool.label} (${tool.shortcut})`}
          onClick={() => handleToolClick(tool.name)}
        >
          {tool.label}
        </button>
      ))}
      <div className="toolbar-divider" />
      <button
        type="button"
        className={`toolbar-btn ${cleanMode ? 'active' : ''}`}
        title="整洁模式"
        onClick={handleCleanToggle}
      >
        整洁
      </button>
    </div>
  );
}
