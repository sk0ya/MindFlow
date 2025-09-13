import React, { memo } from 'react';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import type { MindMapNode } from '@shared/types';

interface NodeRendererProps {
  node: MindMapNode;
  nodeLeftX: number;
  isSelected: boolean;
  isDragTarget?: boolean;
  isDragging: boolean;
  isLayoutTransitioning: boolean;
  nodeWidth: number;
  nodeHeight: number;
  imageHeight: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const NodeRenderer: React.FC<NodeRendererProps> = ({
  node,
  nodeLeftX,
  isSelected,
  isDragTarget,
  isDragging,
  isLayoutTransitioning,
  nodeWidth,
  nodeHeight,
  imageHeight: _imageHeight,
  onMouseDown,
  onClick,
  onDoubleClick,
  onContextMenu
}) => {
  const { settings } = useMindMapStore();
  
  // propsで渡されたnodeWidth/nodeHeightを使用（nodeUtils.tsで計算済み）
  const actualNodeWidth = nodeWidth;
  const actualNodeHeight = nodeHeight;
  
  // この部分は使用されない（NodeSelectionBorderで選択枠線を描画する）

  return (
    <>
      {/* 通常のノード背景 */}
      <rect
        x={nodeLeftX}
        y={node.y - actualNodeHeight / 2}
        width={actualNodeWidth}
        height={actualNodeHeight}
        fill={settings.theme === 'dark' ? 'rgba(45, 45, 48, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
        stroke="transparent"
        strokeWidth="0"
        rx="12"
        ry="12"
        role="button"
        tabIndex={0}
        aria-label={`Mind map node: ${node.text}`}
        aria-selected={isSelected}
        style={{
          cursor: isDragging ? 'grabbing' : 'pointer',
          filter: isDragTarget 
            ? 'drop-shadow(0 8px 25px rgba(245, 158, 11, 0.4))' 
            : isDragging
            ? 'drop-shadow(0 12px 30px rgba(0,0,0,0.2))'
            : (isSelected ? 'drop-shadow(0 4px 20px rgba(59, 130, 246, 0.25))' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))'),
          opacity: isDragging ? 0.8 : 1,
          transform: isDragging ? 'scale(1.05)' : 'scale(1)',
          transition: (isDragging || isLayoutTransitioning) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
        }}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      />
    </>
  );
};

// 選択枠線のみを描画する新しいコンポーネント
export const NodeSelectionBorder: React.FC<{
  node: MindMapNode;
  nodeLeftX: number;
  isSelected: boolean;
  isDragTarget?: boolean;
  isDragging: boolean;
  isLayoutTransitioning: boolean;
  nodeWidth: number;
  nodeHeight: number;
}> = ({
  node,
  nodeLeftX,
  isSelected,
  isDragTarget,
  isDragging,
  isLayoutTransitioning,
  nodeWidth,
  nodeHeight
}) => {
  if (!isSelected && !isDragTarget) return null;
  
  // calculateNodeSizeで計算済みのサイズをそのまま使用
  const selectionWidth = nodeWidth;
  const selectionHeight = nodeHeight;
  const selectionX = nodeLeftX;
  const selectionY = node.y - selectionHeight / 2;

  return (
    <rect
      x={selectionX}
      y={selectionY}
      width={selectionWidth}
      height={selectionHeight}
      fill="transparent"
      stroke={isDragTarget ? "#f59e0b" : "#60a5fa"}
      strokeWidth={isDragTarget ? "3" : "2.5"}
      strokeDasharray={isDragTarget ? "5,5" : "none"}
      rx="12"
      ry="12"
      style={{
        pointerEvents: 'none',
        transition: (isDragging || isLayoutTransitioning) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
      }}
    />
  );
};

export default memo(NodeRenderer);