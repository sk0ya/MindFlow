import React, { useRef, useCallback, useEffect, useState } from 'react';
import Node from './Node';
import Connection from '../common/Connection';
import type { MindMapData, MindMapNode, FileAttachment } from '../../../shared/types';

interface MindMapCanvasProps {
  data: MindMapData;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onChangeParent?: (nodeId: string, newParentId: string) => void;
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

interface DragState {
  isDragging: boolean;
  draggedNodeId: string | null;
  dropTargetId: string | null;
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
  onChangeParent,
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
  setPan
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedNodeId: null,
    dropTargetId: null
  });
  
  // dragStateのrefも作成してNodeからアクセスできるようにする
  const dragStateRef = useRef(dragState);
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const flattenVisibleNodes = (node: MindMapNode): MindMapNode[] => {
    const result = [node];
    if (!node?.collapsed && node?.children) {
      node.children.forEach((child: MindMapNode) => 
        result.push(...flattenVisibleNodes(child))
      );
    }
    return result;
  };
  
  const allNodes = flattenVisibleNodes(data.rootNode);
  
  // ドロップターゲット検出のためのヘルパー関数
  const getNodeAtPosition = useCallback((x: number, y: number): MindMapNode | null => {
    // SVG座標系での位置を取得
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return null;
    
    // マウス座標をSVG内座標に変換（zoom, panを考慮）
    // 正しい変換: (クライアント座標 - SVG位置) / zoom - pan
    const svgX = (x - svgRect.left) / zoom - pan.x;
    const svgY = (y - svgRect.top) / zoom - pan.y;
    
    console.log('🎯 座標変換:', { 
      clientX: x, clientY: y, 
      svgLeft: svgRect.left, svgTop: svgRect.top,
      zoom, panX: pan.x, panY: pan.y,
      svgX, svgY 
    });
    
    // 各ノードとの距離を計算して最も近いものを見つける
    let closestNode: MindMapNode | null = null;
    let minDistance = Infinity;
    const maxDropDistance = 120; // ドロップ可能な最大距離を増加
    
    allNodes.forEach(node => {
      if (node.id === dragState.draggedNodeId) return; // 自分自身は除外
      
      const distance = Math.sqrt(
        Math.pow(node.x - svgX, 2) + Math.pow(node.y - svgY, 2)
      );
      
      console.log('📏 ノード距離計算:', { 
        nodeId: node.id, 
        nodeX: node.x, nodeY: node.y, 
        distance, 
        maxDropDistance 
      });
      
      if (distance < maxDropDistance && distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });
    
    console.log('🎯 最終結果:', { closestNodeId: (closestNode as MindMapNode | null)?.id, minDistance });
    return closestNode;
  }, [allNodes, zoom, pan, dragState.draggedNodeId]);

  // ドラッグ開始時の処理
  const handleDragStart = useCallback((nodeId: string) => {
    console.log('🔥 ドラッグ開始:', { nodeId });
    setDragState({
      isDragging: true,
      draggedNodeId: nodeId,
      dropTargetId: null
    });
  }, []);

  // ドラッグ中の処理
  const handleDragMove = useCallback((x: number, y: number) => {
    console.log('🎯 handleDragMove 呼び出し:', { x, y });
    setDragState(prev => {
      console.log('🎯 ドラッグ状態確認:', { isDragging: prev.isDragging });
      if (!prev.isDragging) {
        console.log('🚫 ドラッグ中でないため処理をスキップ');
        return prev;
      }
      
      const targetNode = getNodeAtPosition(x, y);
      console.log('🎯 ドラッグ移動:', { x, y, targetNodeId: targetNode?.id });
      return {
        ...prev,
        dropTargetId: targetNode?.id || null
      };
    });
  }, [getNodeAtPosition]);

  // ドラッグ終了時の処理（親変更のみ）
  const handleDragEnd = useCallback((nodeId: string, _x: number, _y: number) => {
    setDragState(prevState => {
      console.log('🎯 handleDragEnd 実行:', { 
        nodeId, 
        dropTargetId: prevState.dropTargetId, 
        hasOnChangeParent: !!onChangeParent 
      });
      
      if (prevState.dropTargetId && prevState.dropTargetId !== nodeId) {
        // 親要素を変更
        console.log('🎯 ドロップターゲット検出、親変更実行:', { nodeId, dropTargetId: prevState.dropTargetId });
        if (onChangeParent) {
          console.log('🔄 changeParent関数呼び出し');
          onChangeParent(nodeId, prevState.dropTargetId);
        } else {
          console.error('❌ onChangeParent関数が未定義');
        }
      } else {
        console.log('🚫 ドロップターゲットなし、親変更をスキップ');
      }
      
      return {
        isDragging: false,
        draggedNodeId: null,
        dropTargetId: null
      };
    });
  }, [onChangeParent]);
  
  const connections: Connection[] = [];
  allNodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      const isRootNode = node.id === 'root';
      
      if (!node.collapsed) {
        if (isRootNode) {
          // ルートノードの場合は直接接続
          node.children.forEach((child: MindMapNode) => {
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
          node.children.forEach((child: MindMapNode) => {
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
      isPanningRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    // ドラッグ中はパン操作を無効化してドラッグ操作を優先
    if (isPanningRef.current && !dragState.isDragging) {
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
    // ドラッグ中でない場合のみパン終了
    if (!dragState.isDragging) {
      isPanningRef.current = false;
    }
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
      console.log('🖱️ Canvas: 別ノード選択時の編集確定をNode.jsxに委任');
      // onFinishEdit(editingNodeId, editText); // この行を削除
    }
    onSelectNode(nodeId);
  }, [editingNodeId, onSelectNode]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging]);

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
          cursor: isPanningRef.current ? 'grabbing' : dragState.isDragging ? 'grabbing' : 'grab',
          border: '2px solid #e1e5e9',
          borderRadius: '12px',
          userSelect: 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <g transform={`scale(${zoom}) translate(${pan.x}, ${pan.y})`}>
          {/* ドラッグ中のドロップガイドライン */}
          {dragState.isDragging && (
            <g className="drop-guide">
              {(() => {
                const draggedNode = allNodes.find(n => n.id === dragState.draggedNodeId);
                const targetNode = allNodes.find(n => n.id === dragState.dropTargetId);
                console.log('🎨 ガイドライン表示:', { 
                  isDragging: dragState.isDragging, 
                  dropTargetId: dragState.dropTargetId,
                  draggedNode: !!draggedNode,
                  targetNode: !!targetNode
                });
                // ドラッグ中は最低限のエフェクトを表示
                if (draggedNode) {
                  return (
                    <>
                      <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                         refX="10" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill="#ff9800" />
                        </marker>
                      </defs>
                      
                      {/* ドラッグ中ノードの強調表示 */}
                      <circle
                        cx={draggedNode.x}
                        cy={draggedNode.y}
                        r="50"
                        fill="none"
                        stroke="#ff9800"
                        strokeWidth="2"
                        strokeDasharray="6,6"
                        opacity="0.6"
                      />
                      
                      {/* ドロップ検出範囲の表示 */}
                      <circle
                        cx={draggedNode.x}
                        cy={draggedNode.y}
                        r="120"
                        fill="none"
                        stroke="#ff9800"
                        strokeWidth="1"
                        strokeDasharray="2,8"
                        opacity="0.3"
                      />
                      
                      {/* ドロップターゲットがある場合の接続線 */}
                      {targetNode && (
                        <>
                          <line
                            x1={draggedNode.x}
                            y1={draggedNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke="#ff9800"
                            strokeWidth="3"
                            strokeDasharray="8,4"
                            markerEnd="url(#arrowhead)"
                            opacity="0.8"
                          />
                          <circle
                            cx={targetNode.x}
                            cy={targetNode.y}
                            r="60"
                            fill="none"
                            stroke="#ff9800"
                            strokeWidth="2"
                            strokeDasharray="4,4"
                            opacity="0.5"
                          />
                        </>
                      )}
                    </>
                  );
                }
                return null;
              })()}
            </g>
          )}

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

          <g className="nodes">
            {allNodes.map(node => (
              <Node
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isEditing={editingNodeId === node.id}
                isDragTarget={dragState.dropTargetId === node.id}
                onSelect={handleNodeSelect}
                onStartEdit={onStartEdit}
                onFinishEdit={onFinishEdit}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
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

      <div className="help-text">
        <p>
          <strong>操作方法:</strong> 
          クリック=選択 | ダブルクリック=編集 | Tab=子追加 | Enter=兄弟追加 | Delete=削除 | 
          Space=編集 | マウスホイール=ズーム | 背景ドラッグ=パン | 
          <span style={{color: '#ff9800', fontWeight: 'bold'}}>ノードドラッグ=親変更</span> | 
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

        .drop-guide line {
          animation: dragPulse 1.5s ease-in-out infinite;
        }

        .drop-guide circle {
          animation: dropZonePulse 2s ease-in-out infinite;
        }

        @keyframes dragPulse {
          0%, 100% { stroke-opacity: 0.8; }
          50% { stroke-opacity: 0.4; }
        }

        @keyframes dropZonePulse {
          0%, 100% { 
            stroke-opacity: 0.5; 
            r: 60;
          }
          50% { 
            stroke-opacity: 0.8; 
            r: 65;
          }
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
