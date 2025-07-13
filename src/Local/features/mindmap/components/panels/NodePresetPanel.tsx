import React from 'react';
import type { MindMapNode } from '@shared/types';

interface NodeCustomizations {
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  borderStyle: string;
  borderWidth: string;
}

interface NodePresetPanelProps {
  selectedNode: MindMapNode;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onCustomizationsChange: (customizations: NodeCustomizations) => void;
}

const NodePresetPanel: React.FC<NodePresetPanelProps> = React.memo(({
  selectedNode,
  onUpdateNode,
  onCustomizationsChange
}) => {
  const applyPreset = (preset: Partial<MindMapNode>, customizations: NodeCustomizations) => {
    onCustomizationsChange(customizations);
    onUpdateNode(selectedNode.id, preset);
  };

  return (
    <div className="section">
      <label>プリセット</label>
      <div className="preset-buttons">
        <button
          onClick={() => applyPreset(
            {
              fontSize: 14,
              fontWeight: 'bold',
              fontStyle: 'normal',
              borderStyle: 'solid',
              borderWidth: 2
            },
            {
              fontSize: '14px',
              fontWeight: 'bold',
              fontStyle: 'normal',
              borderStyle: 'solid',
              borderWidth: '2px'
            }
          )}
          className="preset-btn"
        >
          🎨 デフォルト
        </button>
        <button
          onClick={() => applyPreset(
            {
              fontSize: 16,
              fontWeight: 'bold',
              fontStyle: 'normal',
              borderStyle: 'solid',
              borderWidth: 3
            },
            {
              fontSize: '16px',
              fontWeight: 'bold',
              fontStyle: 'normal',
              borderStyle: 'solid',
              borderWidth: '3px'
            }
          )}
          className="preset-btn"
        >
          🔴 重要
        </button>
        <button
          onClick={() => applyPreset(
            {
              fontSize: 14,
              fontWeight: 'normal',
              fontStyle: 'italic',
              borderStyle: 'dashed',
              borderWidth: 2
            },
            {
              fontSize: '14px',
              fontWeight: 'normal',
              fontStyle: 'italic',
              borderStyle: 'dashed',
              borderWidth: '2px'
            }
          )}
          className="preset-btn"
        >
          💭 アイデア
        </button>
      </div>
    </div>
  );
});

NodePresetPanel.displayName = 'NodePresetPanel';

export default NodePresetPanel;