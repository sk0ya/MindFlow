﻿import React, { useRef, useState, useCallback, useEffect } from 'react';

const Node = ({
  node,
  isSelected,
  isEditing,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onDrag,
  onAddChild,
  onDelete,
  onRightClick,
  editText,
  setEditText,
  zoom,
  svgRef
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgX = (e.clientX - svgRect.left) / zoom;
      const svgY = (e.clientY - svgRect.top) / zoom;
      
      setIsDragging(true);
      setDragStart({
        x: svgX - node.x,
        y: svgY - node.y
      });
    }
    
    onSelect(node.id);
  }, [node.x, node.y, node.id, onSelect, zoom, svgRef]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging && svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgX = (e.clientX - svgRect.left) / zoom;
      const svgY = (e.clientY - svgRect.top) / zoom;
      
      const newX = svgX - dragStart.x;
      const newY = svgY - dragStart.y;
      onDrag(node.id, newX, newY);
    }
  }, [isDragging, dragStart, node.id, onDrag, zoom, svgRef]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(node.id);
  }, [node.id, onSelect]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    onStartEdit(node.id);
  }, [node.id, onStartEdit]);

  const handleRightClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onRightClick) {
      onRightClick(e, node.id);
    }
  }, [node.id, onRightClick]);

  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      onFinishEdit(node.id, editText);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onFinishEdit(node.id, node.text);
    }
  }, [node.id, node.text, editText, onFinishEdit]);

  const handleInputBlur = useCallback(() => {
    onFinishEdit(node.id, editText);
  }, [node.id, editText, onFinishEdit]);

  const nodeWidth = Math.max(120, node.text.length * 8);
  const nodeHeight = 40;

  return (
    <g>
      <rect
        x={node.x - nodeWidth / 2}
        y={node.y - nodeHeight / 2}
        width={nodeWidth}
        height={nodeHeight}
        fill="white"
        stroke={isSelected ? "#4285f4" : "#ddd"}
        strokeWidth={isSelected ? "2" : "1"}
        rx="8"
        ry="8"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          filter: isSelected ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.1))'
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleRightClick}
      />

      {isEditing ? (
        <foreignObject 
          x={node.x - nodeWidth / 2 + 10} 
          y={node.y - 10} 
          width={nodeWidth - 20} 
          height="20"
        >
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleInputBlur}
            autoFocus
            style={{
              width: '100%',
              border: '1px solid #ccc',
              background: 'white',
              textAlign: 'center',
              fontSize: node.fontSize || '14px',
              fontWeight: node.fontWeight || 'normal',
              fontStyle: node.fontStyle || 'normal',
              color: 'black',
              outline: 'none',
              borderRadius: '4px',
              padding: '2px 4px'
            }}
          />
        </foreignObject>
      ) : (
        <text
          x={node.x}
          y={node.y + 5}
          textAnchor="middle"
          fill="black"
          fontSize={node.fontSize || '14px'}
          fontWeight={node.fontWeight || 'normal'}
          fontStyle={node.fontStyle || 'normal'}
          style={{ 
            pointerEvents: 'none', 
            userSelect: 'none'
          }}
        >
          {node.text}
        </text>
      )}

      {isSelected && !isEditing && (
        <g>
          <circle
            cx={node.x - 15}
            cy={node.y + nodeHeight / 2 + 12}
            r="8"
            fill="#4285f4"
            stroke="white"
            strokeWidth="2"
            style={{ 
              cursor: 'pointer',
              filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
          />
          <text
            x={node.x - 15}
            y={node.y + nodeHeight / 2 + 12 + 3}
            textAnchor="middle"
            fill="white"
            fontSize="12"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            +
          </text>

          {node.id !== 'root' && (
            <>
              <circle
                cx={node.x + 15}
                cy={node.y + nodeHeight / 2 + 12}
                r="8"
                fill="#ea4335"
                stroke="white"
                strokeWidth="2"
                style={{ 
                  cursor: 'pointer',
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node.id);
                }}
              />
              <text
                x={node.x + 15}
                y={node.y + nodeHeight / 2 + 12 + 3}
                textAnchor="middle"
                fill="white"
                fontSize="12"
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                ×
              </text>
            </>
          )}
        </g>
      )}
    </g>
  );
};

export default Node;
