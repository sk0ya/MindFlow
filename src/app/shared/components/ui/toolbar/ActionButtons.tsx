import React from 'react';
import { RotateCcw, RotateCw, Search, Ruler, Target, FileText, Map } from 'lucide-react';
import { ShortcutTooltip } from '../KeyboardShortcutHelper';

interface ActionButtonsProps {
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  onAutoLayout?: () => void;
  onToggleNotesPanel?: () => void;
  showNotesPanel?: boolean;
  onToggleViewMode?: () => void;
  viewMode?: 'mindmap' | 'outline';
  onCenterRootNode?: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomReset,
  onAutoLayout,
  onToggleNotesPanel,
  showNotesPanel = false,
  onToggleViewMode,
  viewMode = 'mindmap',
  onCenterRootNode
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
          >
            <RotateCcw size={16} />
          </button>
        </ShortcutTooltip>
        
        <ShortcutTooltip shortcut="Ctrl+Y" description="やり直し">
          <button 
            className={`toolbar-btn redo ${!canRedo ? 'disabled' : ''}`}
            onClick={onRedo}
            disabled={!canRedo}
          >
            <RotateCw size={16} />
          </button>
        </ShortcutTooltip>
      </div>

      {/* ビュー操作 */}
      <div className="action-group view-actions">
        <ShortcutTooltip description={`ズームリセット (現在: ${Math.round(zoom * 100)}%)`}>
          <button 
            className="toolbar-btn zoom-reset"
            onClick={onZoomReset}
          >
            <Search size={16} /> {Math.round(zoom * 100)}%
          </button>
        </ShortcutTooltip>
        
        {onAutoLayout && (
          <ShortcutTooltip shortcut="Ctrl+L" description="自動整列">
            <button 
              className="toolbar-btn auto-layout"
              onClick={onAutoLayout}
            >
              <Ruler size={16} />
            </button>
          </ShortcutTooltip>
        )}
        
        {onCenterRootNode && (
          <ShortcutTooltip description="ルートノードを中央に表示">
            <button 
              className="toolbar-btn center-root"
              onClick={onCenterRootNode}
            >
              <Target size={16} />
            </button>
          </ShortcutTooltip>
        )}
      </div>

      {/* ノート・ヘルプ・設定 */}
      <div className="action-group help-actions">
        {onToggleNotesPanel && viewMode === 'mindmap' && (
          <ShortcutTooltip shortcut="Ctrl+Shift+N" description="ノートパネル">
            <button 
              className={`toolbar-btn notes ${showNotesPanel ? 'active' : ''}`}
              onClick={onToggleNotesPanel}
            >
              <FileText size={16} />
            </button>
          </ShortcutTooltip>
        )}
        
        {onToggleViewMode && (
          <ShortcutTooltip shortcut="Ctrl+Shift+V" description={viewMode === 'mindmap' ? 'アウトライン表示に切替' : 'マインドマップ表示に切替'}>
            <button 
              className={`toolbar-btn view-mode ${viewMode === 'outline' ? 'active' : ''}`}
              onClick={onToggleViewMode}
            >
              {viewMode === 'mindmap' ? <FileText size={16} /> : <Map size={16} />}
            </button>
          </ShortcutTooltip>
        )}
        
      </div>
    </div>
  );
};

export default ActionButtons;