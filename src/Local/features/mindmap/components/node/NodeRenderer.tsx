import React, { memo } from 'react';
import type { MindMapNode } from '../../../../shared/types';

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
      fill="white"
      stroke={isDragTarget ? "#ff9800" : (isSelected ? "#4285f4" : "#ddd")}
      strokeWidth={isDragTarget ? "3" : (isSelected ? "2" : "1")}
      strokeDasharray={isDragTarget ? "5,5" : "none"}
      rx="8"
      ry="8"
      role="button"
      tabIndex={0}
      aria-label={`Mind map node: ${node.text}`}
      aria-selected={isSelected}
      style={{
        cursor: isDragging ? 'grabbing' : 'pointer',
        filter: isDragTarget 
          ? 'drop-shadow(0 4px 12px rgba(255,152,0,0.5))' 
          : isDragging
          ? 'drop-shadow(0 6px 20px rgba(0,0,0,0.3))'
          : (isSelected ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.1))'),
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