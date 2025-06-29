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
  onFinishEdit: (nodeId: string, text: string) => void;
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

  const nodeStyle: React.CSSProperties = {
    position: 'absolute',
    left: node.x - 50,
    top: node.y - 20,
    width: 100,
    height: 40,
    border: isSelected ? '2px solid #2196f3' : '1px solid #cccccc',
    borderRadius: 8,
    backgroundColor: isSelected ? '#e3f2fd' : '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: node.fontSize || 14,
    fontWeight: node.fontWeight || 'normal',
    color: node.color || '#333',
    userSelect: 'none',
    transform: `scale(${scale})`,
    transformOrigin: 'center'
  };

  return (
    <div
      style={nodeStyle}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleRightClick}
    >
      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onFinishEdit(node.id, editText)}
          style={{
            width: '90%',
            height: '80%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            textAlign: 'center',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            color: 'inherit'
          }}
          autoFocus
        />
      ) : (
        <span>{node.text}</span>
      )}
    </div>
  );
};

export default Node;