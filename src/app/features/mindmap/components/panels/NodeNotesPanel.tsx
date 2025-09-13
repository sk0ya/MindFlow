import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import MarkdownEditor from '../../../../shared/components/MarkdownEditor';
import type { MindMapNode } from '@shared/types';
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '../../../../shared/utils/localStorage';

interface NodeNotesPanelProps {
  selectedNode: MindMapNode | null;
  onUpdateNode: (id: string, updates: Partial<MindMapNode>) => void;
  onClose?: () => void;
}

const NodeNotesPanel: React.FC<NodeNotesPanelProps> = ({
  selectedNode,
  onUpdateNode,
  onClose
}) => {
  const [noteValue, setNoteValue] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [panelWidth, setPanelWidth] = useState(600); // Default width
  const [isResizing, setIsResizing] = useState(false);
  const saveDataRef = useRef({ selectedNode, noteValue, isDirty, onUpdateNode });
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Update ref when values change
  useEffect(() => {
    saveDataRef.current = { selectedNode, noteValue, isDirty, onUpdateNode };
  });

  // Load note when selected node changes
  useEffect(() => {
    if (selectedNode) {
      const note = selectedNode.note || '';
      setNoteValue(note);
      setIsDirty(false);
    } else {
      setNoteValue('');
      setIsDirty(false);
    }
  }, [selectedNode]);

  // Handle note changes
  const handleNoteChange = useCallback((value: string) => {
    setNoteValue(value);
    setIsDirty(true);
  }, []);

  // Save note
  const handleSave = useCallback(() => {
    if (selectedNode && isDirty && noteValue !== (selectedNode.note || '')) {
      onUpdateNode(selectedNode.id, { note: noteValue });
      setIsDirty(false);
    }
  }, [selectedNode?.id, selectedNode?.note, noteValue, isDirty, onUpdateNode]);

  // Auto-save on blur or when component unmounts  
  useEffect(() => {
    return () => {
      const { selectedNode: node, noteValue: value, isDirty: dirty, onUpdateNode: updateFn } = saveDataRef.current;
      if (node && dirty && value !== (node.note || '')) {
        updateFn(node.id, { note: value });
      }
    };
  }, []);

  // Handle resize functionality
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = panelWidth;
    let currentWidth = startWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX; // Reverse direction for left panel
      currentWidth = Math.max(300, Math.min(1200, startWidth + deltaX));
      setPanelWidth(currentWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Save width to localStorage
      setLocalStorage(STORAGE_KEYS.NOTES_PANEL_WIDTH, currentWidth);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  // Load saved width on mount
  useEffect(() => {
    const result = getLocalStorage<number>(STORAGE_KEYS.NOTES_PANEL_WIDTH);
    if (result.success && result.data !== undefined) {
      const width = result.data;
      if (width >= 300 && width <= 1200) {
        setPanelWidth(width);
      }
    }
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        handleSave();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, onClose]);

  if (!selectedNode) {
    return (
      <div 
        ref={panelRef}
        className="node-notes-panel" 
        style={{ width: `${panelWidth}px` }}
      >
        <div 
          ref={resizeHandleRef}
          className={`resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleResizeStart}
        />
        <div className="panel-header">
          <h3 className="panel-title">📝 ノート</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="close-button"
              title="閉じる (Esc)"
            >
<X size={20} />
            </button>
          )}
        </div>
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <div className="empty-message">
            ノードを選択してください
          </div>
          <div className="empty-description">
            選択したノードにマークダウン形式のノートを追加できます
          </div>
        </div>
        <style>{getStyles(panelWidth, isResizing)}</style>
      </div>
    );
  }

  return (
    <div 
      ref={panelRef}
      className="node-notes-panel" 
      style={{ width: `${panelWidth}px` }}
    >
      <div 
        ref={resizeHandleRef}
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizeStart}
      />
      <div className="panel-header">
        <div className="panel-title-section">
          <h3 className="panel-title">📝 ノート</h3>
          <div className="node-info">
            <span className="node-name">{selectedNode.text}</span>
            {isDirty && <span className="dirty-indicator">●</span>}
          </div>
        </div>
        <div className="panel-controls">
          {onClose && (
            <button
              type="button"
              onClick={() => {
                handleSave();
                onClose();
              }}
              className="close-button"
              title="閉じる (Esc)"
            >
<X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="editor-container">
        <MarkdownEditor
          value={noteValue}
          onChange={handleNoteChange}
          onSave={handleSave}
          height="calc(100vh - 140px)"
          className="node-editor"
          autoFocus={false}
        />
      </div>

      {isDirty && (
        <div className="save-status">
          <span className="unsaved-changes">未保存の変更があります</span>
          <button
            type="button"
            onClick={handleSave}
            className="save-button"
          >
            保存
          </button>
        </div>
      )}

      <style>{getStyles(panelWidth, isResizing)}</style>
    </div>
  );
};

function getStyles(_panelWidth: number, isResizing: boolean) {
  return `
    .node-notes-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-primary);
      border-left: 1px solid var(--border-color);
      position: relative;
      user-select: ${isResizing ? 'none' : 'auto'};
    }

    .resize-handle {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: transparent;
      cursor: col-resize;
      z-index: 10;
    }

    .resize-handle:hover {
      background: var(--accent-color);
    }

    .resize-handle.resizing {
      background: var(--accent-color);
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
      flex-shrink: 0;
    }

    .panel-title-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .panel-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .node-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .node-name {
      font-size: 14px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .dirty-indicator {
      color: #ef4444;
      font-size: 18px;
      line-height: 1;
    }

    .panel-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }


    .close-button {
      background: none;
      border: none;
      font-size: 20px;
      line-height: 1;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-button:hover {
      background: var(--hover-color);
      color: var(--text-primary);
    }

    .editor-container {
      flex: 1;
      overflow: hidden;
      padding: 0;
    }

    .node-editor {
      height: 100%;
      border: none;
      border-radius: 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      text-align: center;
      padding: 40px;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.6;
    }

    .empty-message {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    .empty-description {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .save-status {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .unsaved-changes {
      font-size: 14px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .save-button {
      background: var(--accent-color);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .save-button:hover {
      background: var(--accent-color);
      opacity: 0.8;
    }

    @media (max-width: 768px) {
      .node-notes-panel {
        width: 100vw !important;
      }

      .resize-handle {
        display: none;
      }

      .panel-header {
        padding: 12px 16px;
      }

      .panel-title {
        font-size: 14px;
      }

      .node-name {
        font-size: 12px;
      }

      .empty-state {
        padding: 20px;
        height: 200px;
      }

      .empty-icon {
        font-size: 36px;
      }

      .empty-message {
        font-size: 16px;
      }
    }
  `;
}

export default React.memo(NodeNotesPanel);