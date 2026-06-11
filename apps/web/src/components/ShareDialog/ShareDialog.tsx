import { useState } from 'react';
import { createShareLink } from '../../api/client';

interface ShareDialogProps {
  open: boolean;
  documentId: string;
  onClose: () => void;
}

export function ShareDialog({ open, documentId, onClose }: ShareDialogProps): JSX.Element | null {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleCreate = async (): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const { token } = await createShareLink(documentId, mode);
      const url = `${window.location.origin}/share/${token}`;
      setLink(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
  };

  return (
    <div className="export-dialog-backdrop" onClick={onClose} role="presentation">
      <div className="export-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="export-dialog-header">
          <h2>分享文档</h2>
          <button type="button" className="export-dialog-close" onClick={onClose}>×</button>
        </header>
        <label className="export-option">
          权限
          <select value={mode} onChange={(e) => setMode(e.target.value as 'view' | 'edit')}>
            <option value="view">只读</option>
            <option value="edit">可编辑</option>
          </select>
        </label>
        <footer className="export-dialog-actions">
          <button type="button" className="btn-secondary" onClick={() => void handleCreate()} disabled={busy}>
            生成链接
          </button>
          <button type="button" className="btn-primary" onClick={() => void handleCopy()} disabled={!link}>
            复制链接
          </button>
        </footer>
        {link && <input className="export-preview" readOnly value={link} />}
        {error && <p className="export-status">{error}</p>}
      </div>
    </div>
  );
}
