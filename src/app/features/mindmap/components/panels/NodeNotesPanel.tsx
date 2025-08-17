import React, { useState, useCallback, useEffect, useRef } from 'react';
import MarkdownEditor from '../../../../shared/components/MarkdownEditor';
import type { MindMapNode } from '@shared/types';

interface NodeNotesPanelProps {
  selectedNode: MindMapNode | null;
  onUpdateNode: (id: string, updates: Partial<MindMapNode>) => void;
  onClose?: () => void;
}

export const NodeNotesPanel: React.FC<NodeNotesPanelProps> = ({
  selectedNode,
  onUpdateNode,
  onClose
}) => {
  const [noteValue, setNoteValue] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [vimMode, setVimMode] = useState(false);
  const saveDataRef = useRef({ selectedNode, noteValue, isDirty, onUpdateNode });

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
      <div className="node-notes-panel">
        <div className="panel-header">
          <h3 className="panel-title">📝 ノート</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="close-button"
              title="閉じる (Esc)"
            >
              ×
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
        <style>{getStyles()}</style>
      </div>
    );
  }

  return (
    <div className="node-notes-panel">
      <div className="panel-header">
        <div className="panel-title-section">
          <h3 className="panel-title">📝 ノート</h3>
          <div className="node-info">
            <span className="node-name">{selectedNode.text}</span>
            {isDirty && <span className="dirty-indicator">●</span>}
          </div>
        </div>
        <div className="panel-controls">
          <label className="vim-mode-toggle">
            <input
              type="checkbox"
              checked={vimMode}
              onChange={(e) => setVimMode(e.target.checked)}
            />
            <span>Vim</span>
          </label>
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
              ×
            </button>
          )}
        </div>
      </div>

      <div className="editor-container">
        <MarkdownEditor
          value={noteValue}
          onChange={handleNoteChange}
          onSave={handleSave}
          vimMode={vimMode}
          height="calc(100vh - 140px)"
          className="node-editor"
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

      <style>{getStyles()}</style>
    </div>
  );
};

function getStyles() {
  return `
    .node-notes-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #ffffff;
      border-left: 1px solid #e5e7eb;
      min-width: 400px;
      max-width: 800px;
      width: 50vw;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
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
      color: #1f2937;
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
      color: #6b7280;
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

    .vim-mode-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #6b7280;
      cursor: pointer;
      user-select: none;
    }

    .vim-mode-toggle input[type="checkbox"] {
      margin: 0;
    }

    .close-button {
      background: none;
      border: none;
      font-size: 20px;
      line-height: 1;
      color: #6b7280;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-button:hover {
      background: #e5e7eb;
      color: #374151;
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
      color: #1f2937;
      margin-bottom: 8px;
    }

    .empty-description {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
    }

    .save-status {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: #fef3c7;
      border-top: 1px solid #f59e0b;
      flex-shrink: 0;
    }

    .unsaved-changes {
      font-size: 14px;
      color: #92400e;
      font-weight: 500;
    }

    .save-button {
      background: #f59e0b;
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
      background: #d97706;
    }

    @media (max-width: 768px) {
      .node-notes-panel {
        width: 100vw;
        min-width: unset;
        max-width: unset;
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

export default NodeNotesPanel;