import React from 'react';
import Node from './Node';
import type { MindMapData, MindMapNode } from '../types';

interface MindMapCanvasProps {
  data: MindMapData;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  onSelectNode: (nodeId: string) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onTextChange: (text: string) => void;
  onAddChild: (parentId: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

export default function MindMapCanvas({
  data,
  selectedNodeId,
  editingNodeId,
  editText,
  onSelectNode,
  onStartEdit,
  onFinishEdit,
  onTextChange,
  onAddChild,
  onDeleteNode
}: MindMapCanvasProps) {
  const renderConnections = (node: MindMapNode): JSX.Element[] => {
    const connections: JSX.Element[] = [];
    
    node.children.forEach(child => {
      connections.push(
        <line
          key={`connection-${node.id}-${child.id}`}
          x1={node.x}
          y1={node.y}
          x2={child.x}
          y2={child.y}
          stroke="#999"
          strokeWidth="2"
        />
      );
      
      connections.push(...renderConnections(child));
    });
    
    return connections;
  };

  const renderNodes = (node: MindMapNode): JSX.Element[] => {
    const nodes: JSX.Element[] = [];
    
    nodes.push(
      <Node
        key={node.id}
        node={node}
        isSelected={selectedNodeId === node.id}
        isEditing={editingNodeId === node.id}
        editText={editText}
        onSelect={onSelectNode}
        onStartEdit={onStartEdit}
        onFinishEdit={onFinishEdit}
        onTextChange={onTextChange}
        onKeyDown={handleKeyDown}
      />
    );
    
    node.children.forEach(child => {
      nodes.push(...renderNodes(child));
    });
    
    return nodes;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedNodeId) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      onAddChild(selectedNodeId);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNodeId !== data.rootNode.id) {
        e.preventDefault();
        onDeleteNode(selectedNodeId);
      }
    } else if (e.key === ' ' || e.key === 'Enter') {
      if (editingNodeId !== selectedNodeId) {
        e.preventDefault();
        onStartEdit(selectedNodeId);
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGElement>) => {
    if (e.target === e.currentTarget) {
      onSelectNode(data.rootNode.id);
    }
  };

  return (
    <div className="mindmap-canvas" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 800 600"
        onClick={handleCanvasClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{ outline: 'none' }}
      >
        {/* 接続線を描画 */}
        {renderConnections(data.rootNode)}
        
        {/* ノードを描画 */}
        {renderNodes(data.rootNode)}
      </svg>
    </div>
  );
}