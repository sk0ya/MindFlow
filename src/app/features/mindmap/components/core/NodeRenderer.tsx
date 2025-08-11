import React, { memo } from 'react';
import type { MindMapNode } from '@shared/types';

interface NodeRendererProps {
  node: MindMapNode;
  isSelected: boolean;
  isDragTarget?: boolean;
  isDragging: boolean;
  isLayoutTransitioning: boolean;
  nodeWidth: number;
  nodeHeight: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const NodeRenderer: React.FC<NodeRendererProps> = ({
  node,
  isSelected,
  isDragTarget,
  isDragging,
  isLayoutTransitioning,
  nodeWidth,
  nodeHeight,
  onMouseDown,
  onClick,
  onDoubleClick,
  onContextMenu
}) => {
  return (
    <rect
      x={node.x - nodeWidth / 2}
      y={node.y - nodeHeight / 2}
      width={nodeWidth}
      height={nodeHeight}
      fill="rgba(255, 255, 255, 0.9)"
      stroke={isDragTarget ? "#f59e0b" : (isSelected ? "#3b82f6" : "rgba(148, 163, 184, 0.4)")}
      strokeWidth={isDragTarget ? "3" : (isSelected ? "2.5" : "1.5")}
      strokeDasharray={isDragTarget ? "5,5" : "none"}
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
        transition: (isDragging || isLayoutTransitioning) ? 'none' : 'filter 0.2s ease, opacity 0.2s ease, transform 0.2s ease'
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    />
  );
};

export default memo(NodeRenderer);