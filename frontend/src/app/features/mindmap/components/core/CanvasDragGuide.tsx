import React, { memo } from 'react';
import type { MindMapNode } from '@shared/types';

interface DragState {
  isDragging: boolean;
  draggedNodeId: string | null;
  dropTargetId: string | null;
  dropPosition: 'child' | 'before' | 'after' | null;
  dropAction: 'move-parent' | 'reorder-sibling' | null;
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

  // 操作タイプによる色とスタイルの決定
  const getActionStyle = () => {
    if (dragState.dropAction === 'reorder-sibling') {
      return {
        color: '#2196f3', // 青色：兄弟順序変更
        label: dragState.dropPosition === 'before' ? '前に移動' : '後に移動'
      };
    } else if (dragState.dropAction === 'move-parent') {
      return {
        color: '#4caf50', // 緑色：親変更
        label: '子要素として移動'
      };
    } else {
      return {
        color: '#ff9800', // オレンジ色：デフォルト
        label: ''
      };
    }
  };

  const actionStyle = getActionStyle();

  return (
    <g className="drop-guide">
      <defs>
        <marker id="arrowhead-parent" markerWidth="10" markerHeight="7" 
         refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#4caf50" />
        </marker>
        <marker id="arrowhead-sibling" markerWidth="10" markerHeight="7" 
         refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#2196f3" />
        </marker>
      </defs>
      
      {/* ドラッグ中ノードの強調表示 */}
      <circle
        cx={draggedNode.x}
        cy={draggedNode.y}
        r="50"
        fill="none"
        stroke={actionStyle.color}
        strokeWidth="2"
        strokeDasharray="6,6"
        opacity="0.6"
      />
      
      {/* ドロップ検出範囲の表示 */}
      <circle
        cx={draggedNode.x}
        cy={draggedNode.y}
        r="100"
        fill="none"
        stroke={actionStyle.color}
        strokeWidth="1"
        strokeDasharray="2,8"
        opacity="0.3"
      />
      
      {/* ドロップターゲットがある場合の表示 */}
      {targetNode && dragState.dropAction && (
        <>
          {/* 接続線 */}
          <line
            x1={draggedNode.x}
            y1={draggedNode.y}
            x2={targetNode.x}
            y2={targetNode.y}
            stroke={actionStyle.color}
            strokeWidth="3"
            strokeDasharray={dragState.dropAction === 'reorder-sibling' ? "4,4" : "8,4"}
            markerEnd={`url(#arrowhead-${dragState.dropAction === 'reorder-sibling' ? 'sibling' : 'parent'})`}
            opacity="0.8"
          />
          
          {/* ターゲットノードの強調 */}
          {dragState.dropAction === 'reorder-sibling' ? (
            // 兄弟順序変更の場合：挿入位置を示すライン
            <line
              x1={targetNode.x - 30}
              y1={targetNode.y + (dragState.dropPosition === 'before' ? -20 : 20)}
              x2={targetNode.x + 30}
              y2={targetNode.y + (dragState.dropPosition === 'before' ? -20 : 20)}
              stroke="#2196f3"
              strokeWidth="4"
              opacity="0.8"
            />
          ) : (
            // 親変更の場合：円で囲む
            <circle
              cx={targetNode.x}
              cy={targetNode.y}
              r="60"
              fill="none"
              stroke="#4caf50"
              strokeWidth="3"
              strokeDasharray="4,4"
              opacity="0.6"
            />
          )}
          
          {/* 操作タイプのラベル */}
          {actionStyle.label && (
            <text
              x={(draggedNode.x + targetNode.x) / 2}
              y={(draggedNode.y + targetNode.y) / 2 - 10}
              textAnchor="middle"
              fill={actionStyle.color}
              fontSize="12"
              fontWeight="bold"
              opacity="0.9"
            >
              {actionStyle.label}
            </text>
          )}
        </>
      )}
    </g>
  );
};

export default memo(CanvasDragGuide);