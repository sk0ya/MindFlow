import React from 'react';

interface NodeProps {
  node: {
    id: string;
    text: string;
    x: number;
    y: number;
    children: any[];
    fontSize?: number;
    fontWeight?: string;
    collapsed?: boolean;
    color?: string;
  };
  isSelected: boolean;
  isEditing: boolean;
  editText: string;
  setEditText: (text: string) => void;
  onSelect: (nodeId: string) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId?: string, text?: string) => void;
  onDrag: (nodeId: string, x: number, y: number) => void;
  onRightClick?: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick?: (nodeId: string) => void;
  scale?: number;
}

const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  isEditing,
  editText,
  setEditText,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onDrag,
  onRightClick,
  onDoubleClick,
  scale = 1
}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔴 Node レンダリング:', {
      id: node.id,
      text: node.text,
      x: node.x,
      y: node.y,
      left: node.x - 50,
      top: node.y - 20,
      scale,
      isSelected,
      isEditing
    });
  }
  const handleClick = () => {
    onSelect(node.id);
  };

  const handleDoubleClick = () => {
    if (onDoubleClick) {
      onDoubleClick(node.id);
    } else {
      onStartEdit(node.id);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onRightClick) {
      onRightClick(e, node.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onFinishEdit(node.id, editText);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onFinishEdit(node.id, node.text); // 元のテキストに戻す
    }
  };

  const width = 120;
  const height = 40;
  const x = node.x - width/2;
  const y = node.y - height/2;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* ノードの背景 */}
      <rect
        width={width}
        height={height}
        rx={8}
        ry={8}
        fill={isSelected ? '#e3f2fd' : '#ffffff'}
        stroke={isSelected ? '#2196f3' : '#cccccc'}
        strokeWidth={isSelected ? 2 : 1}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleRightClick}
      />
      
      {/* ノードのテキスト */}
      {isEditing ? (
        <foreignObject x={5} y={5} width={width - 10} height={height - 10}>
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => onFinishEdit(node.id, editText)}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              textAlign: 'center',
              fontSize: node.fontSize || 14,
              fontWeight: node.fontWeight || 'normal',
              color: node.color || '#333',
              padding: '8px 4px'
            }}
            autoFocus
          />
        </foreignObject>
      ) : (
        <text
          x={width/2}
          y={height/2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={node.fontSize || 14}
          fontWeight={node.fontWeight || 'normal'}
          fill={node.color || '#333'}
          style={{ 
            cursor: 'pointer',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        >
          {node.text}
        </text>
      )}
    </g>
  );
};

export default Node;