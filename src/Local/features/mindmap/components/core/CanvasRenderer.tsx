import React, { memo } from 'react';
import { Node } from '../..';
import { CanvasConnections, CanvasDragGuide } from '.';
import type { MindMapData, MindMapNode, FileAttachment } from '@local/shared';

interface DragState {
  isDragging: boolean;
  draggedNodeId: string | null;
  dropTargetId: string | null;
  dropPosition: 'child' | 'before' | 'after' | null;
  dropAction: 'move-parent' | 'reorder-sibling' | null;
  dragOffset: { x: number; y: number };
}

interface CanvasRendererProps {
  svgRef: React.RefObject<SVGSVGElement>;
  data: MindMapData;
  allNodes: MindMapNode[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  zoom: number;
  pan: { x: number; y: number };
  cursor: string;
  dragState: DragState;
  
  // Event handlers
  onWheel: (e: React.WheelEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onBackgroundClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onNodeSelect: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRightClick?: (e: React.MouseEvent, nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onFileUpload: (nodeId: string, files: FileList) => void;
  onRemoveFile: (nodeId: string, fileId: string) => void;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onShowNodeMapLinks: (node: MindMapNode, position: { x: number; y: number }) => void;
  
  // Drag handlers
  onDragStart: (nodeId: string) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (nodeId: string, x: number, y: number) => void;
}

const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  svgRef,
  data,
  allNodes,
  selectedNodeId,
  editingNodeId,
  editText,
  setEditText,
  zoom,
  pan,
  cursor,
  dragState,
  onWheel,
  onMouseDown,
  onBackgroundClick,
  onContextMenu,
  onNodeSelect,
  onStartEdit,
  onFinishEdit,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onRightClick,
  onToggleCollapse,
  onFileUpload,
  onRemoveFile,
  onShowImageModal,
  onShowFileActionMenu,
  onShowNodeMapLinks,
  onDragStart,
  onDragMove,
  onDragEnd
}) => {
  return (
    <div className="mindmap-canvas-container">
      <svg
        ref={svgRef}
        width="100%"
        height="calc(100vh - 150px)"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onClick={onBackgroundClick}
        onContextMenu={onContextMenu}
        style={{
          background: 'white',
          cursor,
          border: '2px solid #e1e5e9',
          borderRadius: '12px',
          userSelect: 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <g transform={`scale(${zoom}) translate(${pan?.x || 0}, ${pan?.y || 0})`}>
          {/* ドラッグ中のドロップガイドライン */}
          <CanvasDragGuide
            dragState={dragState}
            allNodes={allNodes}
          />

          <CanvasConnections
            allNodes={allNodes}
            data={data}
            onToggleCollapse={onToggleCollapse}
          />

          <g className="nodes">
            {allNodes.map(node => (
              <Node
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isEditing={editingNodeId === node.id}
                isDragTarget={dragState.dropTargetId === node.id}
                onSelect={onNodeSelect}
                onStartEdit={onStartEdit}
                onFinishEdit={onFinishEdit}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
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

export default memo(CanvasRenderer);