import React from 'react';
import type { MindMapNode } from '../types';

interface NodeProps {
  node: MindMapNode;
  isSelected: boolean;
  isEditing: boolean;
  editText: string;
  onSelect: (nodeId: string) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onTextChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export default function Node({
  node,
  isSelected,
  isEditing,
  editText,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onTextChange,
  onKeyDown
}: NodeProps) {
  const handleClick = () => {
    onSelect(node.id);
  };

  const handleDoubleClick = () => {
    onStartEdit(node.id);
  };

  const handleInputBlur = () => {
    onFinishEdit(node.id, editText);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onFinishEdit(node.id, editText);
    } else if (e.key === 'Escape') {
      onFinishEdit(node.id, node.text); // 元のテキストに戻す
    }
    onKeyDown(e);
  };

  return (
    <g transform={`translate(${node.x}, ${node.y})`}>
      {/* ノードの背景 */}
      <rect
        x={-50}
        y={-20}
        width={100}
        height={40}
        rx={8}
        fill={isSelected ? '#e3f2fd' : '#ffffff'}
        stroke={isSelected ? '#2196f3' : '#cccccc'}
        strokeWidth={isSelected ? 2 : 1}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: 'pointer' }}
      />
      
      {/* ノードのテキスト */}
      {isEditing ? (
        <foreignObject x={-45} y={-15} width={90} height={30}>
          <input
            type="text"
            value={editText}
            onChange={(e) => onTextChange(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              textAlign: 'center',
              fontSize: `${node.fontSize || 14}px`,
              fontWeight: node.fontWeight || 'normal',
              color: node.color || '#333'
            }}
            autoFocus
          />
        </foreignObject>
      ) : (
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fontSize={node.fontSize || 14}
          fontWeight={node.fontWeight || 'normal'}
          fill={node.color || '#333'}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          {node.text}
        </text>
      )}
    </g>
  );
}