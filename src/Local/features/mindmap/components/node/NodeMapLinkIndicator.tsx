import React, { useCallback, memo } from 'react';
import type { MindMapNode } from '@shared/types';

interface NodeMapLinkIndicatorProps {
  node: MindMapNode;
  nodeWidth: number;
  nodeHeight: number;
  onShowNodeMapLinks: (node: MindMapNode, position: { x: number; y: number }) => void;
}

const NodeMapLinkIndicator: React.FC<NodeMapLinkIndicatorProps> = ({
  node,
  nodeWidth,
  nodeHeight,
  onShowNodeMapLinks
}) => {
  const handleShowMapLinks = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowNodeMapLinks) {
      onShowNodeMapLinks(node, {
        x: e.clientX,
        y: e.clientY
      });
    }
  }, [onShowNodeMapLinks, node]);

  if (!node.mapLinks || node.mapLinks.length === 0) {
    return null;
  }

  return (
    <g>
      <circle
        cx={node.x + nodeWidth / 2 - 8}
        cy={node.y - nodeHeight / 2 + 8}
        r="6"
        fill="#9c27b0"
        stroke="white"
        strokeWidth="1"
        style={{ cursor: 'pointer' }}
        onClick={handleShowMapLinks}
      />
      <text
        x={node.x + nodeWidth / 2 - 8}
        y={node.y - nodeHeight / 2 + 8 + 2}
        textAnchor="middle"
        fill="white"
        fontSize="8"
        fontWeight="bold"
        style={{ pointerEvents: 'none' }}
      >
        {node.mapLinks.length}
      </text>
    </g>
  );
};

export default memo(NodeMapLinkIndicator);