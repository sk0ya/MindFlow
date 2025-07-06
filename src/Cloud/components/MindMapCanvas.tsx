import React, { useRef, useCallback, useEffect } from 'react';
import Node from './Node';
import Connection from './Connection';

// Cloud モード用の型定義
interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  data?: string;
}

interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  children: MindMapNode[];
  fontSize?: number;
  fontWeight?: string;
  collapsed?: boolean;
  color?: string;
  attachments?: FileAttachment[];
}

interface MindMapData {
  id: string;
  title: string;
  rootNode: MindMapNode;
  createdAt?: string;
  updatedAt?: string;
}

interface MindMapCanvasProps {
  data: MindMapData;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId?: string, text?: string) => void;
  onDragNode: (nodeId: string, x: number, y: number) => void;
  onChangeParent?: (nodeId: string, newParentId: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRightClick?: (e: React.MouseEvent, nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onNavigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onFileUpload: (nodeId: string, file: File) => void;
  onRemoveFile: (nodeId: string, fileId: string) => void;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, position: { x: number; y: number }) => void;
  onShowNodeMapLinks: (node: MindMapNode, position: { x: number; y: number }) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
}


interface Connection {
  from: MindMapNode | { x: number; y: number };
  to: MindMapNode | { x: number; y: number };
  hasToggleButton: boolean;
  nodeId?: string;
  isCollapsed?: boolean;
  isToggleConnection?: boolean;
  color?: string;
}

const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  data,
  selectedNodeId,
  editingNodeId,
  editText,
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
  onToggleCollapse,
  onNavigateToDirection,
  onFileUpload: _onFileUpload,
  onRemoveFile: _onRemoveFile,
  onShowImageModal: _onShowImageModal,
  onShowFileActionMenu: _onShowFileActionMenu,
  onShowNodeMapLinks: _onShowNodeMapLinks,
  zoom,
  setZoom,
  pan,
  setPan
}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🎨 MindMapCanvas渡されたデータ:', {
      hasData: !!data,
      dataId: data?.id,
      dataTitle: data?.title,
      hasRootNode: !!data?.rootNode,
      rootNodeDetails: data?.rootNode ? {
        id: data.rootNode.id,
        text: data.rootNode.text,
        x: data.rootNode.x,
        y: data.rootNode.y,
        childrenCount: data.rootNode.children?.length || 0
      } : null
    });
  }
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });

  const flattenVisibleNodes = (node: MindMapNode): MindMapNode[] => {
    const result = [node];
    if (!node?.collapsed && node?.children) {
      node.children.forEach(child => 
        result.push(...flattenVisibleNodes(child))
      );
    }
    return result;
  };
  
  const allNodes = data?.rootNode ? flattenVisibleNodes(data.rootNode) : [];
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 表示可能ノード:', { 
      allNodesCount: allNodes.length, 
      firstNode: allNodes[0] ? {
        id: allNodes[0].id,
        text: allNodes[0].text,
        x: allNodes[0].x,
        y: allNodes[0].y,
        fontSize: allNodes[0].fontSize,
        fontWeight: allNodes[0].fontWeight
      } : null,
      zoom,
      pan,
      svgHeight: 'calc(100vh - 150px)'
    });
  }
  



  
  const connections: Connection[] = [];
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

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    if (svgRef.current) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.3), 5);
      setZoom(newZoom);
    }
  }, [zoom, setZoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      isPanningRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
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

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      // 編集中の場合は編集を確定してから選択をクリア
      if (editingNodeId) {
        onFinishEdit(editingNodeId, editText);
      }
      onSelectNode(null);
    }
  };

  // ノード選択時に編集を確定する処理
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    // 編集中で、異なるノードが選択された場合は編集を確定
    // ただし、Node.jsxのblur処理に委任（editTextの同期問題を避けるため）
    if (editingNodeId && editingNodeId !== nodeId) {
      // editTextを渡さず、Node.jsx側で現在の入力値を使用させる
      if (process.env.NODE_ENV === 'development') {
        console.log('🖱️ Canvas: 別ノード選択時の編集確定をNode.jsxに委任');
      }
      // onFinishEdit(editingNodeId, editText); // この行を削除
    }
    onSelectNode(nodeId);
  }, [editingNodeId, onSelectNode]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // ナビゲーション用の矢印キーのみ処理（他はMindMapAppで処理）
    if (selectedNodeId && !editingNodeId) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onNavigateToDirection('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          onNavigateToDirection('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onNavigateToDirection('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          onNavigateToDirection('right');
          break;
      }
    }
  }, [selectedNodeId, editingNodeId, onNavigateToDirection]);

  useEffect(() => {
    const svgElement = svgRef.current;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    
    // passive: false を指定してpreventDefaultを有効にする
    if (svgElement) {
      svgElement.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      if (svgElement) {
        svgElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleKeyDown, handleWheel]);

  return (
    <div className="mindmap-canvas-container">
      <svg
        ref={svgRef}
        width="100%"
        height="calc(100vh - 150px)"
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
                key={`${('id' in conn.from ? conn.from.id : 'toggle')}-${('id' in conn.to ? conn.to.id : 'toggle')}-${index}`}
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
                editText={editText}
                setEditText={setEditText}
                onSelect={handleNodeSelect}
                onStartEdit={onStartEdit}
                onFinishEdit={onFinishEdit}
                onDrag={onDragNode}
                onRightClick={onRightClick}
                scale={zoom}
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

      <style>{`
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
