import React, { memo } from 'react';
import type { MindMapNode } from '../../../../shared/types';

interface DragState {
  isDragging: boolean;
  draggedNodeId: string | null;
  dropTargetId: string | null;
  dropPosition: 'child' | 'before' | 'after' | null;
  dragOffset: { x: number; y: number };
}

interface CanvasDragGuideProps {
  dragState: DragState;
  allNodes: MindMapNode[];
}

const CanvasDragGuide: React.FC<CanvasDragGuideProps> = ({ 
  dragState, 
  allNodes 
}) => {
  if (!dragState.isDragging) {
    return null;
  }

  const draggedNode = allNodes.find(n => n.id === dragState.draggedNodeId);
  const targetNode = allNodes.find(n => n.id === dragState.dropTargetId);

  if (!draggedNode) {
    return null;
  }

  return (
    <g className="drop-guide">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" 
         refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#ff9800" />
        </marker>
      </defs>
      
      {/* ドラッグ中ノードの強調表示 */}
      <circle
        cx={draggedNode.x}
        cy={draggedNode.y}
        r="50"
        fill="none"
        stroke="#ff9800"
        strokeWidth="2"
        strokeDasharray="6,6"
        opacity="0.6"
      />
      
      {/* ドロップ検出範囲の表示 */}
      <circle
        cx={draggedNode.x}
        cy={draggedNode.y}
        r="120"
        fill="none"
        stroke="#ff9800"
        strokeWidth="1"
        strokeDasharray="2,8"
        opacity="0.3"
      />
      
      {/* ドロップターゲットがある場合の接続線 */}
      {targetNode && (
        <>
          <line
            x1={draggedNode.x}
            y1={draggedNode.y}
            x2={targetNode.x}
            y2={targetNode.y}
            stroke="#ff9800"
            strokeWidth="3"
            strokeDasharray="8,4"
            markerEnd="url(#arrowhead)"
            opacity="0.8"
          />
          <circle
            cx={targetNode.x}
            cy={targetNode.y}
            r="60"
            fill="none"
            stroke="#ff9800"
            strokeWidth="2"
            strokeDasharray="4,4"
            opacity="0.5"
          />
        </>
      )}
    </g>
  );
};

export default memo(CanvasDragGuide);