import React from 'react';
import { ShortcutTooltip } from '../KeyboardShortcutHelper';

interface ActionButtonsProps {
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  onShowShortcutHelper: () => void;
  onAutoLayout?: () => void;
  onToggleNotesPanel?: () => void;
  showNotesPanel?: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomReset,
  onShowShortcutHelper,
  onAutoLayout,
  onToggleNotesPanel,
  showNotesPanel = false
}) => {

  return (
    <div className="toolbar-actions">

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

      {/* ノート・ヘルプ・設定 */}
      <div className="action-group help-actions">
        {onToggleNotesPanel && (
          <ShortcutTooltip shortcut="Ctrl+Shift+N" description="ノートパネル">
            <button 
              className={`toolbar-btn notes ${showNotesPanel ? 'active' : ''}`}
              onClick={onToggleNotesPanel}
              title="ノートパネル (Ctrl+Shift+N)"
            >
              📝
            </button>
          </ShortcutTooltip>
        )}
        
        <ShortcutTooltip shortcut="?" description="キーボードショートカット">
          <button 
            className="toolbar-btn shortcuts"
            onClick={onShowShortcutHelper}
            title="キーボードショートカット (?)"
          >
            ⌨️
          </button>
        </ShortcutTooltip>
        
      </div>
    </div>
  );
};

export default ActionButtons;