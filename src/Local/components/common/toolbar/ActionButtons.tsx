import React, { useRef, useCallback } from 'react';
import { ShortcutTooltip } from '../KeyboardShortcutHelper';

interface ActionButtonsProps {
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  onShowShortcutHelper: () => void;
  onShowLocalStoragePanel?: () => void;
  onAutoLayout?: () => void;
  isLocalMode?: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onExport,
  onImport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomReset,
  onShowShortcutHelper,
  onShowLocalStoragePanel,
  onAutoLayout,
  isLocalMode = true
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onImport(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onImport]);

  return (
    <div className="toolbar-actions">
      {/* ファイル操作 */}
      <div className="action-group file-actions">
        <ShortcutTooltip shortcut="Ctrl+S" description="エクスポート">
          <button 
            className="toolbar-btn export"
            onClick={onExport}
            title="エクスポート (Ctrl+S)"
          >
            💾
          </button>
        </ShortcutTooltip>
        
        <button 
          className="toolbar-btn import"
          onClick={handleImportClick}
          title="インポート"
        >
          📁
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* 編集操作 */}
      <div className="action-group edit-actions">
        <ShortcutTooltip shortcut="Ctrl+Z" description="元に戻す">
          <button 
            className={`toolbar-btn undo ${!canUndo ? 'disabled' : ''}`}
            onClick={onUndo}
            disabled={!canUndo}
            title="元に戻す (Ctrl+Z)"
          >
            ↶
          </button>
        </ShortcutTooltip>
        
        <ShortcutTooltip shortcut="Ctrl+Y" description="やり直し">
          <button 
            className={`toolbar-btn redo ${!canRedo ? 'disabled' : ''}`}
            onClick={onRedo}
            disabled={!canRedo}
            title="やり直し (Ctrl+Y)"
          >
            ↷
          </button>
        </ShortcutTooltip>
      </div>

      {/* ビュー操作 */}
      <div className="action-group view-actions">
        <button 
          className="toolbar-btn zoom-reset"
          onClick={onZoomReset}
          title={`ズームリセット (現在: ${Math.round(zoom * 100)}%)`}
        >
          🔍 {Math.round(zoom * 100)}%
        </button>
        
        {onAutoLayout && (
          <button 
            className="toolbar-btn auto-layout"
            onClick={onAutoLayout}
            title="自動整列"
          >
            📐
          </button>
        )}
      </div>

      {/* ヘルプ・設定 */}
      <div className="action-group help-actions">
        <ShortcutTooltip shortcut="?" description="キーボードショートカット">
          <button 
            className="toolbar-btn shortcuts"
            onClick={onShowShortcutHelper}
            title="キーボードショートカット (?)"
          >
            ⌨️
          </button>
        </ShortcutTooltip>
        
        {isLocalMode && onShowLocalStoragePanel && (
          <button 
            className="toolbar-btn storage"
            onClick={onShowLocalStoragePanel}
            title="ローカルストレージ管理"
          >
            💽
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionButtons;