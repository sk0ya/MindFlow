import React, { useMemo } from 'react';
import type { MindMapData, MindMapNode } from '@shared/types';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import './OutlineView.css';

interface OutlineViewProps {
  data: MindMapData;
  onNodeSelect?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  hasSidebar?: boolean;
}

interface OutlineItem {
  id: string;
  text: string;
  note?: string;
  level: number;
  isSelected: boolean;
}

const OutlineView: React.FC<OutlineViewProps> = ({ data, onNodeSelect, selectedNodeId, hasSidebar = false }) => {
  const { settings } = useMindMapStore();
  const outlineItems = useMemo(() => {
    const items: OutlineItem[] = [];
    
    const processNode = (node: MindMapNode, level: number = 0) => {
      // ルートノード以外を追加
      if (level > 0) {
        items.push({
          id: node.id,
          text: node.text,
          note: node.note,
          level,
          isSelected: node.id === selectedNodeId
        });
      }
      
      // 子ノードを再帰的に処理
      if (node.children) {
        node.children.forEach(child => {
          processNode(child, level + 1);
        });
      }
    };
    
    if (data?.rootNode) {
      processNode(data.rootNode);
    }
    
    return items;
  }, [data, selectedNodeId]);

  const handleNodeClick = (nodeId: string) => {
    if (onNodeSelect) {
      onNodeSelect(nodeId);
    }
  };

  if (!data?.rootNode) {
    return (
      <div className="outline-view-empty">
        <p>データがありません</p>
      </div>
    );
  }

  return (
    <div className={`outline-view ${hasSidebar ? 'with-sidebar' : ''} ${settings.theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="outline-content">
        {/* ルートノード */}
        <div className="outline-item root-item">
          <h1 className="outline-heading root-heading">
            {data.rootNode.text}
          </h1>
          {data.rootNode.note && (
            <div className="outline-note">
              {data.rootNode.note.split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          )}
        </div>

        {/* 子ノード */}
        {outlineItems.map((item) => (
          <div
            key={item.id}
            className={`outline-item level-${item.level} ${item.isSelected ? 'selected' : ''}`}
            onClick={() => handleNodeClick(item.id)}
          >
            <div className={`outline-heading level-${item.level}`}>
              {'#'.repeat(Math.min(item.level, 6))} {item.text}
            </div>
            {item.note && (
              <div className="outline-note">
                {item.note.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OutlineView;