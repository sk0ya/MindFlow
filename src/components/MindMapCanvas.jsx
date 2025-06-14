import React, { useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
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

  const flattenVisibleNodes = (node) => {
    const result = [node];
    if (!node.collapsed && node.children) {
      node.children.forEach(child => 
        result.push(...flattenVisibleNodes(child))
      );
    }
    return result;
  };
  
  const allNodes = flattenVisibleNodes(data.rootNode);
  
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
              hasToggleButton: false,
              color: child.color || '#666'
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
            isToggleConnection: true,
            color: node.color || '#666'
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
              hasToggleButton: false,
              color: node.color || '#666'
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
          isToggleConnection: true,
          color: node.color || '#666'
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

  const handleWheel = (e) => {
    e.preventDefault();
    
    if (svgRef.current) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.3), 5);
      setZoom(newZoom);
    }
  };

  const handleMouseDown = (e) => {
    if (e.target === svgRef.current) {
      isPanningRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (isPanningRef.current) {
      const deltaX = e.clientX - lastPanPointRef.current.x;
      const deltaY = e.clientY - lastPanPointRef.current.y;
      
      setPan(prev => ({
        x: prev.x + deltaX / zoom,
        y: prev.y + deltaY / zoom
      }));
      
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
  };

  const handleBackgroundClick = (e) => {
    if (e.target === svgRef.current) {
      // 編集中の場合は編集を確定してから選択をクリア
      if (editingNodeId) {
        onFinishEdit(editingNodeId, editText);
      }
      onSelectNode(null);
    }
  };

  // ノード選択時に編集を確定する処理
  const handleNodeSelect = useCallback((nodeId) => {
    // 編集中で、異なるノードが選択された場合は編集を確定
    if (editingNodeId && editingNodeId !== nodeId) {
      onFinishEdit(editingNodeId, editText);
    }
    onSelectNode(nodeId);
  }, [editingNodeId, editText, onFinishEdit, onSelectNode]);

  const handleKeyDown = useCallback((e) => {
    if (selectedNodeId && !editingNodeId) {
      // 特殊キーの処理
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
          e.preventDefault();
          if (selectedNodeId !== 'root') {
            onDeleteNode(selectedNodeId);
            // 削除後の選択はuseMindMapで自動的に処理される
          }
          break;
        case ' ':
          e.preventDefault();
          onStartEdit(selectedNodeId);
          break;
        case 'Escape':
          onSelectNode(null);
          break;
        case 'Process':
          // IME変換中は何もしない
          break;
        default:
          // 通常の文字入力の場合は編集モードに入る
          // 単一文字、かつ修飾キーが押されていない場合
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            // 空文字で編集モードに入る（文字入力はinput要素に任せる）
            onStartEdit(selectedNodeId, true);
          }
          break;
      }
    }
  }, [selectedNodeId, editingNodeId, onAddChild, onAddSibling, onDeleteNode, onStartEdit, onSelectNode]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

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
                color={conn.color}
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
                onSelect={handleNodeSelect}
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

MindMapCanvas.propTypes = {
  data: PropTypes.shape({
    rootNode: PropTypes.object.isRequired
  }).isRequired,
  selectedNodeId: PropTypes.string,
  editingNodeId: PropTypes.string,
  editText: PropTypes.string.isRequired,
  setEditText: PropTypes.func.isRequired,
  onSelectNode: PropTypes.func.isRequired,
  onStartEdit: PropTypes.func.isRequired,
  onFinishEdit: PropTypes.func.isRequired,
  onDragNode: PropTypes.func.isRequired,
  onAddChild: PropTypes.func.isRequired,
  onAddSibling: PropTypes.func.isRequired,
  onDeleteNode: PropTypes.func.isRequired,
  onRightClick: PropTypes.func,
  onToggleCollapse: PropTypes.func.isRequired,
  zoom: PropTypes.number.isRequired,
  setZoom: PropTypes.func.isRequired,
  pan: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  setPan: PropTypes.func.isRequired
};

export default MindMapCanvas;
