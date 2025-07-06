/**
 * MindMapCanvasBase - Shared canvas component for rendering mind maps
 * Provides common rendering logic while allowing mode-specific customization
 */

import React, { useRef, useEffect, useCallback } from 'react';
import type { MindMapData, MindMapNode, Position } from '../types';

export interface MindMapCanvasBaseProps {
  data: MindMapData;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  zoom: number;
  pan: Position;
  
  // Event handlers
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId?: string, text?: string) => void;
  onDragNode?: (nodeId: string, x: number, y: number) => void;
  onChangeParent?: (nodeId: string, newParentId: string) => void;
  onAddChild?: (parentId: string, text?: string, autoEdit?: boolean) => void;
  onAddSibling?: (nodeId: string, text?: string, autoEdit?: boolean) => void;
  onDeleteNode?: (nodeId: string) => void;
  onRightClick?: (e: React.MouseEvent, nodeId: string) => void;
  onToggleCollapse?: (nodeId: string) => void;
  
  // Canvas controls
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  
  // Optional features
  showFileAttachments?: boolean;
  showMapLinks?: boolean;
  showCollapsedIndicators?: boolean;
  
  // File handling (optional)
  onFileUpload?: (nodeId: string, file: File) => void;
  onRemoveFile?: (nodeId: string, fileId: string) => void;
  onShowImageModal?: (file: any) => void;
  onShowFileActionMenu?: (file: any, position: Position) => void;
  onShowNodeMapLinks?: (node: MindMapNode, position: Position) => void;
}

// Connection line component
const Connection: React.FC<{
  from: Position;
  to: Position;
  color?: string;
  hasToggleButton?: boolean;
  isToggleConnection?: boolean;
  onToggleClick?: () => void;
}> = ({ 
  from, 
  to, 
  color = '#333', 
  hasToggleButton = false, 
  isToggleConnection = false,
  onToggleClick 
}) => {
  const pathData = `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${from.y} ${to.x} ${to.y}`;
  
  return (
    <g>
      <path
        d={pathData}
        stroke={color}
        strokeWidth="2"
        fill="none"
        className={isToggleConnection ? 'toggle-connection' : 'connection'}
      />
      {hasToggleButton && (
        <circle
          cx={(from.x + to.x) / 2}
          cy={(from.y + to.y) / 2}
          r="6"
          fill={color}
          className="toggle-button"
          onClick={onToggleClick}
          style={{ cursor: 'pointer' }}
        />
      )}
    </g>
  );
};

// Node component
const Node: React.FC<{
  node: MindMapNode;
  isSelected: boolean;
  isEditing: boolean;
  editText: string;
  setEditText: (text: string) => void;
  onSelect: (nodeId: string) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId?: string, text?: string) => void;
  onDrag?: (nodeId: string, x: number, y: number) => void;
  onRightClick?: (e: React.MouseEvent, nodeId: string) => void;
  showFileAttachments?: boolean;
  showMapLinks?: boolean;
  onFileUpload?: (nodeId: string, file: File) => void;
  onRemoveFile?: (nodeId: string, fileId: string) => void;
  onShowImageModal?: (file: any) => void;
  onShowFileActionMenu?: (file: any, position: Position) => void;
  onShowNodeMapLinks?: (node: MindMapNode, position: Position) => void;
}> = ({
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
  showFileAttachments = false,
  showMapLinks = false,
  onFileUpload: _onFileUpload,
  onRemoveFile: _onRemoveFile,
  onShowImageModal: _onShowImageModal,
  onShowFileActionMenu: _onShowFileActionMenu,
  onShowNodeMapLinks
}) => {
  const nodeRef = useRef<SVGGElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState<Position>({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - node.x, y: e.clientY - node.y });
    onSelect(node.id);
  }, [isEditing, node.x, node.y, node.id, onSelect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !onDrag) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    onDrag(node.id, newX, newY);
  }, [isDragging, dragStart, node.id, onDrag]);

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
    return () => {};
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleDoubleClick = useCallback(() => {
    if (!isEditing) {
      onStartEdit(node.id);
    }
  }, [isEditing, node.id, onStartEdit]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onFinishEdit(node.id, editText);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onFinishEdit(node.id, node.text);
    }
  }, [node.id, node.text, editText, onFinishEdit]);

  const nodeStyle = {
    fontSize: node.fontSize || 14,
    fontWeight: node.fontWeight || 'normal',
    color: node.color || '#000000',
    backgroundColor: node.backgroundColor || 'transparent'
  };

  const hasAttachments = showFileAttachments && node.attachments && node.attachments.length > 0;
  const hasMapLinks = showMapLinks && node.mapLinks && node.mapLinks.length > 0;

  return (
    <g
      ref={nodeRef}
      transform={`translate(${node.x}, ${node.y})`}
      className={`node ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => onRightClick?.(e, node.id)}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Node background */}
      <rect
        x="-60"
        y="-15"
        width="120"
        height="30"
        rx="15"
        fill={nodeStyle.backgroundColor}
        stroke={isSelected ? '#3498db' : '#ddd'}
        strokeWidth={isSelected ? '2' : '1'}
        className="node-background"
      />
      
      {/* Node text */}
      {isEditing ? (
        <foreignObject x="-55" y="-10" width="110" height="20">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={() => onFinishEdit(node.id, editText)}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              textAlign: 'center',
              fontSize: nodeStyle.fontSize + 'px',
              fontWeight: nodeStyle.fontWeight,
              color: nodeStyle.color
            }}
            autoFocus
          />
        </foreignObject>
      ) : (
        <text
          x="0"
          y="5"
          textAnchor="middle"
          style={nodeStyle}
          className="node-text"
        >
          {node.text || 'Empty Node'}
        </text>
      )}
      
      {/* File attachments indicator */}
      {hasAttachments && (
        <g>
          <circle
            cx="45"
            cy="-10"
            r="5"
            fill="#e74c3c"
            className="attachment-indicator"
          />
          <title>{`${node.attachments!.length} attachment(s)`}</title>
        </g>
      )}
      
      {/* Map links indicator */}
      {hasMapLinks && (
        <g>
          <circle
            cx="45"
            cy="10"
            r="5"
            fill="#3498db"
            className="maplink-indicator"
            onClick={(e) => {
              e.stopPropagation();
              onShowNodeMapLinks?.(node, { x: node.x + 45, y: node.y + 10 });
            }}
          />
          <title>{`${node.mapLinks!.length} link(s)`}</title>
        </g>
      )}
      
      {/* Collapsed indicator */}
      {node.collapsed && node.children && node.children.length > 0 && (
        <text
          x="50"
          y="5"
          fontSize="12"
          fill="#666"
          className="collapsed-indicator"
        >
          [{node.children.length}]
        </text>
      )}
    </g>
  );
};

// Main canvas component
export const MindMapCanvasBase: React.FC<MindMapCanvasBaseProps> = ({
  data,
  selectedNodeId,
  editingNodeId,
  editText,
  zoom,
  pan,
  setEditText,
  onSelectNode,
  onStartEdit,
  onFinishEdit,
  onDragNode,
  onChangeParent: _onChangeParent,
  onAddChild: _onAddChild,
  onAddSibling: _onAddSibling,
  onDeleteNode: _onDeleteNode,
  onRightClick,
  onToggleCollapse: _onToggleCollapse,
  setZoom,
  setPan,
  showFileAttachments = false,
  showMapLinks = false,
  showCollapsedIndicators: _showCollapsedIndicators = true,
  onFileUpload,
  onRemoveFile,
  onShowImageModal,
  onShowFileActionMenu,
  onShowNodeMapLinks
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Flatten nodes for rendering
  const flattenNodes = useCallback((node: MindMapNode): MindMapNode[] => {
    if (node.collapsed) {
      return [node];
    }
    return [node, ...node.children.flatMap(flattenNodes)];
  }, []);

  // Generate connections
  const generateConnections = useCallback((node: MindMapNode): Array<{
    from: Position;
    to: Position;
    color?: string;
  }> => {
    if (node.collapsed || !node.children) return [];
    
    const connections = node.children.map(child => ({
      from: { x: node.x, y: node.y },
      to: { x: child.x, y: child.y },
      color: child.color || '#333'
    }));
    
    return [
      ...connections,
      ...node.children.flatMap(generateConnections)
    ];
  }, []);

  const nodes = flattenNodes(data.rootNode);
  const connections = generateConnections(data.rootNode);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.1, Math.min(3.0, zoom + delta));
    setZoom(newZoom);
  }, [zoom, setZoom]);

  // Pan handlers
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState<Position>({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      onSelectNode(null); // Deselect nodes when clicking on canvas
    }
  }, [pan, onSelectNode]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    
    const newPan = {
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    };
    setPan(newPan);
  }, [isPanning, panStart, setPan]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (isPanning) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return () => {};
  }, [isPanning, handleMouseMove, handleMouseUp]);

  return (
    <div className="mindmap-canvas-container">
      <svg
        ref={svgRef}
        className="mindmap-canvas"
        width="100%"
        height="100%"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Render connections first */}
          {connections.map((connection, index) => (
            <Connection
              key={`connection-${index}`}
              from={connection.from}
              to={connection.to}
              color={connection.color}
            />
          ))}
          
          {/* Render nodes */}
          {nodes.map(node => (
            <Node
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isEditing={editingNodeId === node.id}
              editText={editText}
              setEditText={setEditText}
              onSelect={onSelectNode}
              onStartEdit={onStartEdit}
              onFinishEdit={onFinishEdit}
              onDrag={onDragNode}
              onRightClick={onRightClick}
              showFileAttachments={showFileAttachments}
              showMapLinks={showMapLinks}
              onFileUpload={onFileUpload}
              onRemoveFile={onRemoveFile}
              onShowImageModal={onShowImageModal}
              onShowFileActionMenu={onShowFileActionMenu}
              onShowNodeMapLinks={onShowNodeMapLinks}
            />
          ))}
        </g>
      </svg>
      
      {/* Zoom controls */}
      <div className="canvas-controls">
        <button onClick={() => setZoom(Math.min(3.0, zoom + 0.1))}>+</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}>-</button>
        <button onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }}>Reset</button>
      </div>
    </div>
  );
};

export default MindMapCanvasBase;