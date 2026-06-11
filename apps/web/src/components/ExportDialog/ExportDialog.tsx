import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import type { Editor } from '@rough/editor';
import type { AiPromptFramework } from '@rough/export';
import { downloadBlob, suggestPngFilename } from '@rough/export';

export type ExportFormat = 'png' | 'svg' | 'json' | 'markdown' | 'ai-prompt';

interface ExportDialogProps {
  open: boolean;
  editorRef: MutableRefObject<Editor | null>;
  docName: string;
  onClose: () => void;
}

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'png', label: 'PNG 图片' },
  { id: 'svg', label: 'SVG 矢量' },
  { id: 'json', label: 'JSON 文档' },
  { id: 'markdown', label: 'Markdown 结构' },
  { id: 'ai-prompt', label: 'AI Prompt' },
];

export function ExportDialog({ open, editorRef, docName, onClose }: ExportDialogProps): JSX.Element | null {
  const editor = editorRef.current;
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [pngScale, setPngScale] = useState<1 | 2 | 4>(2);
  const [framework, setFramework] = useState<AiPromptFramework>('react-tailwind');
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const exportContext = useMemo(() => editor?.getExportContext(), [editor]);

  const refreshPreview = useCallback(() => {
    if (!editor) {
      setPreview('');
      return;
    }
    try {
      if (format === 'json') {
        setPreview(editor.getJsonExport());
      } else if (format === 'markdown') {
        setPreview(editor.getMarkdownExport());
      } else if (format === 'ai-prompt') {
        setPreview(editor.getAiPromptExport(framework));
      } else if (format === 'svg') {
        void editor.exportSvg().then(setPreview).catch(() => setPreview(''));
      } else {
        setPreview('');
      }
    } catch {
      setPreview('');
    }
  }, [editor, format, framework]);

  useEffect(() => {
    if (open) refreshPreview();
  }, [open, refreshPreview]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const targetCount = exportContext?.exportTargetIds.length ?? 0;
  const scopeHint =
    targetCount === 0
      ? '当前页无可导出的 Frame'
      : exportContext?.selectionIds.length
        ? `已选 ${targetCount} 个导出对象`
        : `当前页 ${targetCount} 个顶层 Frame`;

  const handleCopy = async (): Promise<void> => {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    setStatus('已复制到剪贴板');
    setTimeout(() => setStatus(''), 2000);
  };

  const handleDownload = async (): Promise<void> => {
    if (!editor) return;
    setBusy(true);
    setStatus('');
    try {
      if (format === 'png') {
        const blob = await editor.exportPng(pngScale);
        const multiple = (exportContext?.exportTargetIds.length ?? 0) > 1;
        downloadBlob(blob, suggestPngFilename(docName || 'rough-export', multiple));
        setStatus('下载已开始');
      } else if (format === 'svg') {
        const svg = await editor.exportSvg();
        downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${docName || 'rough-export'}.svg`);
        setStatus('下载已开始');
      } else if (format === 'json') {
        const json = editor.getJsonExport();
        downloadBlob(new Blob([json], { type: 'application/json' }), `${docName || 'rough-export'}.json`);
        setStatus('下载已开始');
      } else if (format === 'markdown' || format === 'ai-prompt') {
        await handleCopy();
      }
    } catch {
      setStatus('导出失败');
    } finally {
      setBusy(false);
    }
  };

  const handleImportJson = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          editor.importJson(reader.result as string);
          setStatus('JSON 已导入');
          onClose();
        } catch {
          setStatus('JSON 格式无效');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="export-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="export-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
      >
        <header className="export-dialog-header">
          <h2 id="export-dialog-title">导出</h2>
          <button type="button" className="export-dialog-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <p className="export-dialog-hint">{scopeHint}</p>

        <div className="export-dialog-formats">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`export-format-btn${format === f.id ? ' active' : ''}`}
              onClick={() => setFormat(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {format === 'png' && (
          <label className="export-option">
            分辨率
            <select
              value={pngScale}
              onChange={(e) => setPngScale(Number(e.target.value) as 1 | 2 | 4)}
            >
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </label>
        )}

        {format === 'ai-prompt' && (
          <label className="export-option">
            框架
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value as AiPromptFramework)}
            >
              <option value="react-tailwind">React + Tailwind</option>
              <option value="vue">Vue</option>
              <option value="html">纯 HTML</option>
            </select>
          </label>
        )}

        {(format === 'markdown' || format === 'ai-prompt' || format === 'json' || format === 'svg') && (
          <textarea
            className="export-preview"
            readOnly
            value={preview}
            placeholder={format === 'svg' ? '加载 SVG…' : '预览内容'}
            rows={12}
          />
        )}

        <footer className="export-dialog-actions">
          {format === 'json' && (
            <button type="button" className="btn-secondary" onClick={handleImportJson}>
              导入 JSON
            </button>
          )}
          {(format === 'markdown' || format === 'ai-prompt') && (
            <button type="button" className="btn-secondary" onClick={() => void handleCopy()} disabled={!preview}>
              复制
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleDownload()}
            disabled={busy || targetCount === 0}
          >
            {format === 'markdown' || format === 'ai-prompt' ? '复制' : '下载'}
          </button>
        </footer>

        {status && <p className="export-status">{status}</p>}
      </div>
    </div>
  );
}
