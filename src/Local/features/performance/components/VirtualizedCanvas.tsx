import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import Node from '../../mindmap/components/Node';
import Connection from '../../../shared/components/ui/Connection';
import type { MindMapData, MindMapNode, FileAttachment } from '../../../../shared/types';

interface VirtualizedCanvasProps {
  data: MindMapData;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onChangeParent?: (nodeId: string, newParentId: string) => void;
  onChangeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRightClick?: (e: React.MouseEvent, nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onNavigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onFileUpload: (nodeId: string, files: FileList) => void;
  onRemoveFile: (nodeId: string, fileId: string) => void;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onShowNodeMapLinks: (node: MindMapNode, position: { x: number; y: number }) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
}

interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
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

const VIEWPORT_PADDING = 200; // ビューポート外の余白
const NODE_SIZE = 120; // ノードのおおよそのサイズ

const VirtualizedCanvas: React.FC<VirtualizedCanvasProps> = ({
  data,
  selectedNodeId,
  editingNodeId,
  editText,
  setEditText,
  onSelectNode,
  onStartEdit,
  onFinishEdit,
  onChangeParent: _onChangeParent,
  onChangeSiblingOrder: _onChangeSiblingOrder,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onRightClick,
  onToggleCollapse,
  onNavigateToDirection: _onNavigateToDirection,
  onFileUpload,
  onRemoveFile,
  onShowImageModal,
  onShowFileActionMenu,
  onShowNodeMapLinks,
  zoom,
  setZoom,
  pan,
  setPan: _setPan
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds>({
    left: 0,
    top: 0,
    right: 0,
    bottom: 0
  });

  // ビューポートの境界を計算
  const calculateViewportBounds = useCallback((): ViewportBounds => {
    if (!svgRef.current) {
      return { left: 0, top: 0, right: 0, bottom: 0 };
    }

    const rect = svgRef.current.getBoundingClientRect();
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;

    // SVG座標系での表示範囲を計算
    const left = -pan.x - (viewportWidth / 2) / zoom - VIEWPORT_PADDING;
    const top = -pan.y - (viewportHeight / 2) / zoom - VIEWPORT_PADDING;
    const right = -pan.x + (viewportWidth / 2) / zoom + VIEWPORT_PADDING;
    const bottom = -pan.y + (viewportHeight / 2) / zoom + VIEWPORT_PADDING;

    return { left, top, right, bottom };
  }, [pan, zoom]);

  // ビューポート境界の更新
  useEffect(() => {
    const bounds = calculateViewportBounds();
    setViewportBounds(bounds);
  }, [calculateViewportBounds]);

  // 全ノードのフラット化（表示可能なもののみ）
  const flattenVisibleNodes = useCallback((node: MindMapNode): MindMapNode[] => {
    const result = [node];
    if (!node?.collapsed && node?.children) {
      node.children.forEach((child: MindMapNode) => 
        result.push(...flattenVisibleNodes(child))
      );
    }
    return result;
  }, []);

  // 可視ノードのフィルタリング
  const visibleNodes = useMemo(() => {
    const allNodes = flattenVisibleNodes(data.rootNode);
    
    // 選択中または編集中のノードは必ず表示
    const forcedVisible = new Set<string>();
    if (selectedNodeId) forcedVisible.add(selectedNodeId);
    if (editingNodeId) forcedVisible.add(editingNodeId);

    const filtered = allNodes.filter(node => {
      // 強制表示ノードは常に表示
      if (forcedVisible.has(node.id)) return true;

      // ビューポート内チェック
      const isInViewport = (
        node.x >= viewportBounds.left - NODE_SIZE &&
        node.x <= viewportBounds.right + NODE_SIZE &&
        node.y >= viewportBounds.top - NODE_SIZE &&
        node.y <= viewportBounds.bottom + NODE_SIZE
      );

      return isInViewport;
    });

    console.log(`🎯 仮想化: ${allNodes.length}ノード中${filtered.length}ノードを表示`);
    return filtered;
  }, [data.rootNode, viewportBounds, selectedNodeId, editingNodeId, flattenVisibleNodes]);

  // 接続線の計算（可視ノードのみ）
  const connections = useMemo((): Connection[] => {
    const allNodes = flattenVisibleNodes(data.rootNode);
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    const connections: Connection[] = [];

    allNodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        const isRootNode = node.id === 'root';
        
        if (!node.collapsed) {
          if (isRootNode) {
            // ルートノードの場合は直接接続
            node.children.forEach((child: MindMapNode) => {
              // 親または子が可視の場合のみ接続線を描画
              if (visibleNodeIds.has(node.id) || visibleNodeIds.has(child.id)) {
                connections.push({ 
                  from: node, 
                  to: child, 
                  hasToggleButton: false,
                  color: child.color || '#666'
                });
              }
            });
          } else {
            // 非ルートノードの場合はトグルボタン経由
            if (visibleNodeIds.has(node.id)) {
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
              node.children.forEach((child: MindMapNode) => {
                connections.push({
                  from: { x: toggleX, y: toggleY },
                  to: child,
                  hasToggleButton: false,
                  color: node.color || '#666'
                });
              });
            }
          }
        } else {
          // 折りたたまれている場合
          if (visibleNodeIds.has(node.id)) {
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
      }
    });

    return connections;
  }, [data.rootNode, visibleNodes, flattenVisibleNodes]);

  // 既存のイベントハンドラーやその他の機能は元のMindMapCanvasから継承
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    if (svgRef.current) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.3), 5);
      setZoom(newZoom);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      // パン操作の実装は元のままで省略
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      if (editingNodeId) {
        onFinishEdit(editingNodeId, editText);
      }
      onSelectNode(null);
    }
  };

  return (
    <div className="virtualized-canvas-container">
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
          cursor: 'grab',
          border: '2px solid #e1e5e9',
          borderRadius: '12px',
          userSelect: 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <g transform={`scale(${zoom}) translate(${pan.x}, ${pan.y})`}>
          {/* 接続線 */}
          <g className="connection-lines">
            {connections.filter(conn => !conn.hasToggleButton).map((conn, index) => (
              <Connection
                key={`${'id' in conn.from ? conn.from.id : 'toggle'}-${'id' in conn.to ? conn.to.id : 'toggle'}-${index}`}
                from={conn.from}
                to={conn.to}
                hasToggleButton={false}
                onToggleCollapse={onToggleCollapse}
                nodeId={conn.nodeId || ''}
                isToggleConnection={conn.isToggleConnection}
                color={conn.color}
              />
            ))}
          </g>

          {/* 可視ノードのみ */}
          <g className="nodes">
            {visibleNodes.map(node => (
              <Node
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isEditing={editingNodeId === node.id}
                isDragTarget={false}
                onSelect={onSelectNode}
                onStartEdit={onStartEdit}
                onFinishEdit={onFinishEdit}
                onDragStart={() => {}}
                onDragMove={() => {}}
                onDragEnd={() => {}}
                onAddChild={onAddChild}
                onAddSibling={onAddSibling}
                onDelete={onDeleteNode}
                onRightClick={onRightClick}
                editText={editText}
                setEditText={setEditText}
                onFileUpload={onFileUpload}
                onRemoveFile={onRemoveFile}
                onShowImageModal={onShowImageModal}
                onShowFileActionMenu={onShowFileActionMenu}
                onShowNodeMapLinks={onShowNodeMapLinks}
                zoom={zoom}
                pan={pan}
                svgRef={svgRef}
              />
            ))}
          </g>

          {/* トグルボタン */}
          <g className="toggle-buttons">
            {connections.filter(conn => conn.hasToggleButton).map((conn, index) => (
              <Connection
                key={`toggle-${conn.nodeId}-${index}`}
                from={conn.from}
                to={conn.to}
                hasToggleButton={true}
                onToggleCollapse={onToggleCollapse}
                nodeId={conn.nodeId || ''}
                isCollapsed={conn.isCollapsed}
              />
            ))}
          </g>
        </g>
      </svg>

      <div className="performance-info">
        <span>🎯 仮想化: {visibleNodes.length}ノード表示中</span>
      </div>

      <style>{`
        .virtualized-canvas-container {
          position: relative;
        }

        .performance-info {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
        }

        svg {
          display: block;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
};

export default VirtualizedCanvas;