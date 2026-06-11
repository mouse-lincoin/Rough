import { useEffect } from 'react';

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS: { title: string; items: { keys: string; desc: string }[] }[] = [
  {
    title: '工具',
    items: [
      { keys: 'V', desc: '选择' },
      { keys: 'H', desc: '抓手' },
      { keys: 'F', desc: 'Frame' },
      { keys: 'R', desc: '矩形' },
      { keys: 'O', desc: '椭圆' },
      { keys: 'Y', desc: '多边形' },
      { keys: 'L', desc: '直线' },
      { keys: 'A', desc: '箭头' },
      { keys: 'P', desc: '画笔' },
      { keys: 'T', desc: '文本' },
      { keys: 'C', desc: '评论' },
    ],
  },
  {
    title: '编辑',
    items: [
      { keys: '⌘Z / ⌘⇧Z', desc: '撤销 / 重做' },
      { keys: '⌘C / ⌘X / ⌘V', desc: '复制 / 剪切 / 粘贴' },
      { keys: '⌘D', desc: '副本' },
      { keys: 'Delete', desc: '删除' },
      { keys: '⌘G / ⌘⇧G', desc: '编组 / 解组' },
      { keys: '⌘⌥K', desc: '创建组件' },
      { keys: '⇧A', desc: 'Auto Layout' },
    ],
  },
  {
    title: '视图',
    items: [
      { keys: '⌘0 / ⌘1 / ⌘2', desc: '100% / 适应全部 / 适应选中' },
      { keys: '⌘\\', desc: '切换面板' },
      { keys: '⇧G', desc: '网格吸附' },
      { keys: '⌘+ / ⌘-', desc: '缩放' },
      { keys: '空格拖拽', desc: '平移画布' },
    ],
  },
  {
    title: '其他',
    items: [
      { keys: '⌘E', desc: '导出' },
      { keys: '⌘/', desc: '快捷键帮助' },
      { keys: 'Esc', desc: '取消 / 退出深入选择' },
      { keys: 'Enter', desc: '进入容器选择子级' },
    ],
  },
];

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="export-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="export-dialog shortcuts-help"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="shortcuts-title"
      >
        <header className="export-dialog-header">
          <h2 id="shortcuts-title">快捷键</h2>
          <button type="button" className="export-dialog-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="shortcuts-grid">
          {SECTIONS.map((section) => (
            <section key={section.title} className="shortcuts-section">
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item.keys}>
                    <kbd>{item.keys}</kbd>
                    <span>{item.desc}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
