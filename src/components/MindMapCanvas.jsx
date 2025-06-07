import React, { useRef, useCallback, useEffect } from 'react';
import Node from './Node';
import Connection from './Connection';

const MindMapCanvas = ({
  data,
  selectedNodeId,
  editingNodeId,
  editText,
  setEditText,
  onSelectNode,
  onStartEdit,
  onFinishEdit,
  onDragNode,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onRightClick,
  onToggleCollapse,
  zoom,
  setZoom,
  pan,
  setPan
}) => {
  const svgRef = useRef(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });

  const flattenNodesFiltered = (node, result = []) => {
    result.push(node);
    if (!node.collapsed && node.children) {
      node.children.forEach(child => flattenNodesFiltered(child, result));
    }
    return result;
  };
  
  const allNodes = flattenNodesFiltered(data.rootNode);
  
  const connections = [];
  allNodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      const isRootNode = node.id === 'root';
      
      if (!node.collapsed) {
        if (isRootNode) {
          // ルートノードの場合は直接接続
          node.children.forEach(child => {
            connections.push({ 
              from: node, 
              to: child, 
              hasToggleButton: false
            });
          });
        } else {
          // 非ルートノードの場合はトグルボタン経由
          // ルートノードの位置を基準に左右を判定
          const rootNode = data.rootNode;
          const isOnRight = node.x > rootNode.x;
          const toggleOffset = isOnRight ? 80 : -80;
          const toggleX = node.x + toggleOffset;
          const toggleY = node.y;
          
          // 親からトグルボタンへの接続線
          connections.push({
            from: node,
            to: { x: toggleX, y: toggleY },
            hasToggleButton: false,
            isToggleConnection: true
          });
          
          // トグルボタン自体
          connections.push({
            from: { x: toggleX, y: toggleY },
            to: { x: toggleX, y: toggleY },
            hasToggleButton: true,
            nodeId: node.id,
            isCollapsed: false
          });
          
          // トグルボタンから各子要素への線
          node.children.forEach(child => {
            connections.push({
              from: { x: toggleX, y: toggleY },
              to: child,
              hasToggleButton: false
            });
          });
        }
      } else {
        // 折りたたまれている場合
        const rootNode = data.rootNode;
        const isOnRight = node.x > rootNode.x;
        const toggleOffset = isOnRight ? 80 : -80;
        const toggleX = node.x + toggleOffset;
        const toggleY = node.y;
        
        // 親からトグルボタンへの接続線
        connections.push({
          from: node,
          to: { x: toggleX, y: toggleY },
          hasToggleButton: false,
          isToggleConnection: true
        });
        
        // トグルボタン自体
        connections.push({ 
          from: { x: toggleX, y: toggleY },
          to: { x: toggleX, y: toggleY }, 
          hasToggleButton: true,
          nodeId: node.id,
          isCollapsed: true
        });
      }
    }
  });

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    if (svgRef.current) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.3), 5);
      setZoom(newZoom);
    }
  }, [zoom, setZoom]);

  const handleMouseDown = useCallback((e) => {
    if (e.target === svgRef.current) {
      isPanningRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isPanningRef.current) {
      const deltaX = e.clientX - lastPanPointRef.current.x;
      const deltaY = e.clientY - lastPanPointRef.current.y;
      
      setPan(prev => ({
        x: prev.x + deltaX / zoom,
        y: prev.y + deltaY / zoom
      }));
      
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [zoom, setPan]);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleBackgroundClick = useCallback((e) => {
    if (e.target === svgRef.current) {
      onSelectNode(null);
    }
  }, [onSelectNode]);

  const handleKeyDown = useCallback((e) => {
    if (selectedNodeId && !editingNodeId) {
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          onAddChild(selectedNodeId);
          break;
        case 'Enter':
          e.preventDefault();
          onAddSibling(selectedNodeId);
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedNodeId !== 'root') {
            onDeleteNode(selectedNodeId);
          }
          break;
        case ' ':
          e.preventDefault();
          onStartEdit(selectedNodeId);
          break;
        case 'Escape':
          onSelectNode(null);
          break;
      }
    }
  }, [selectedNodeId, editingNodeId, onAddChild, onAddSibling, onDeleteNode, onStartEdit, onSelectNode]);

  useEffect(() => {
    const handleGlobalMouseMove = (e) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();
    const handleGlobalKeyDown = (e) => handleKeyDown(e);

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleMouseMove, handleMouseUp, handleKeyDown]);

  return (
    <div className="mindmap-canvas-container">
      <svg
        ref={svgRef}
        width="100%"
        height="calc(100vh - 150px)"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onClick={handleBackgroundClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onSelectNode(null);
        }}
        style={{
          background: 'white',
          cursor: isPanningRef.current ? 'grabbing' : 'grab',
          border: '2px solid #e1e5e9',
          borderRadius: '12px',
          userSelect: 'none'
        }}
      >
        <g transform={`scale(${zoom}) translate(${pan.x}, ${pan.y})`}>
          <g className="connection-lines">
            {connections.filter(conn => !conn.hasToggleButton).map((conn, index) => (
              <Connection
                key={`${conn.from.id || 'toggle'}-${conn.to.id || 'toggle'}-${index}`}
                from={conn.from}
                to={conn.to}
                hasToggleButton={false}
                isToggleConnection={conn.isToggleConnection}
              />
            ))}
          </g>

          <g className="nodes">
            {allNodes.map(node => (
              <Node
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isEditing={editingNodeId === node.id}
                onSelect={onSelectNode}
                onStartEdit={onStartEdit}
                onFinishEdit={onFinishEdit}
                onDrag={onDragNode}
                onAddChild={onAddChild}
                onDelete={onDeleteNode}
                onRightClick={onRightClick}
                editText={editText}
                setEditText={setEditText}
                zoom={zoom}
                svgRef={svgRef}
              />
            ))}
          </g>

          <g className="toggle-buttons">
            {connections.filter(conn => conn.hasToggleButton).map((conn, index) => (
              <Connection
                key={`toggle-${conn.nodeId}-${index}`}
                from={conn.from}
                to={conn.to}
                hasToggleButton={true}
                onToggleCollapse={onToggleCollapse}
                nodeId={conn.nodeId}
                isCollapsed={conn.isCollapsed}
              />
            ))}
          </g>
        </g>
      </svg>

      <div className="help-text">
        <p>
          <strong>操作方法:</strong> 
          クリック=選択 | ダブルクリック=編集 | Tab=子追加 | Enter=兄弟追加 | Delete=削除 | 
          Space=編集 | マウスホイール=ズーム | ドラッグ=パン/移動 | 
          接続線のボタン=開閉
        </p>
      </div>

      <style jsx>{`
        .mindmap-canvas-container {
          position: relative;
        }

        svg {
          display: block;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .help-text {
          margin-top: 4px;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 8px;
          border-left: 4px solid #4285f4;
          backdrop-filter: blur(10px);
        }

        .help-text p {
          margin: 0;
          font-size: 10px;
          color: #555;
          line-height: 1.5;
        }

        .help-text strong {
          color: #333;
        }

        .connections path {
          stroke: black;
        }

        @media (max-width: 768px) {
          .help-text {
            font-size: 12px;
          }
          
          .help-text p {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
};

export default MindMapCanvas;
