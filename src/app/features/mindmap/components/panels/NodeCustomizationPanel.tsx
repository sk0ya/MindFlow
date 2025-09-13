import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { MindMapNode } from '@shared/types';
import NodeFontPanel from './NodeFontPanel';
import NodePresetPanel from './NodePresetPanel';
import NodeCustomizationStyles from './NodeCustomizationStyles';

interface NodeCustomizationPanelProps {
  selectedNode: MindMapNode | null;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

interface NodeCustomizations {
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
}

const NodeCustomizationPanel: React.FC<NodeCustomizationPanelProps> = ({
  selectedNode,
  onUpdateNode,
  onClose,
  position
}) => {
  const [customizations, setCustomizations] = useState<NodeCustomizations>({
    fontSize: '14px',
    fontWeight: 'bold',
    fontStyle: 'normal'
  });

  // 選択されたノードの現在の設定を反映
  useEffect(() => {
    if (selectedNode) {
      setCustomizations({
        fontSize: selectedNode.fontSize ? `${selectedNode.fontSize}px` : '14px',
        fontWeight: selectedNode.fontWeight || 'bold',
        fontStyle: selectedNode.fontStyle || 'normal'
      });
    }
  }, [selectedNode]);

  const handleChange = useCallback((property: keyof NodeCustomizations, value: string) => {
    const newCustomizations = { ...customizations, [property]: value };
    setCustomizations(newCustomizations);
    
    // リアルタイムで変更を適用
    if (selectedNode) {
      const updateData: Partial<MindMapNode> = {};
      
      // 数値型のプロパティは適切に変換
      if (property === 'fontSize') {
        updateData.fontSize = parseInt(value, 10);
      } else {
        updateData[property] = value;
      }
      
      onUpdateNode(selectedNode.id, updateData);
    }
  }, [customizations, selectedNode, onUpdateNode]);

  const handleCustomizationsChange = useCallback((newCustomizations: NodeCustomizations) => {
    setCustomizations(newCustomizations);
  }, []);

  if (!selectedNode) return null;

  return (
    <div 
      className="customization-panel"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000
      }}
    >
      <div className="panel-header">
        <h3>ノードのカスタマイズ</h3>
        <button onClick={onClose} className="close-btn"><X size={18} /></button>
      </div>

      <div className="panel-content">
        <NodeFontPanel 
          customizations={customizations}
          onCustomizationChange={handleChange}
        />
        
        
        <NodePresetPanel 
          selectedNode={selectedNode}
          onUpdateNode={onUpdateNode}
          onCustomizationsChange={handleCustomizationsChange}
        />
      </div>

      <NodeCustomizationStyles />
    </div>
  );
};

export default NodeCustomizationPanel;
