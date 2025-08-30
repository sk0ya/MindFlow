import React, { memo } from 'react';
import { CanvasConnections, CanvasDragGuide } from '.';
import { Node } from '../..';
import SelectedNodeAttachmentList from './SelectedNodeAttachmentList';
import NodeActions from './NodeActions';
import { calculateNodeSize } from '../../../../shared/utils/nodeUtils';
import type { FileAttachment, MindMapData, MindMapNode } from '../../../../shared';

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
  onMouseUp: (e: React.MouseEvent) => void;
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
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;

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
  onMouseUp,
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
  onUpdateNode,
  onAutoLayout,
  onDragStart,
  onDragMove,
  onDragEnd
}) => {
  return (
    <div className="mindmap-canvas-container">
      <svg
        ref={svgRef}
        width="100%"
        height="calc(100vh)"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
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
        <g transform={`scale(${zoom * 1.5}) translate(${pan?.x || 0}, ${pan?.y || 0})`}>
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
                onUpdateNode={onUpdateNode}
                onAutoLayout={onAutoLayout}
                zoom={zoom}
                pan={pan}
                svgRef={svgRef}
              />
            ))}
          </g>

          {/* 選択されたノードの添付ファイル一覧を最前面に表示 */}
          {selectedNodeId && (
            (() => {
              const selectedNode = allNodes.find(node => node.id === selectedNodeId);
              if (selectedNode) {
                const nodeSize = calculateNodeSize(selectedNode, editText, editingNodeId === selectedNode.id);
                return (
                  <SelectedNodeAttachmentList
                    key={`attachment-list-${selectedNodeId}`}
                    node={selectedNode}
                    isVisible={selectedNodeId === selectedNode.id && editingNodeId !== selectedNode.id}
                    nodeWidth={nodeSize.width}
                    nodeHeight={nodeSize.height}
                    onFileClick={(file) => {
                      onShowFileActionMenu(file, selectedNode.id, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
                    }}
                    onFileDoubleClick={(file) => {
                      if (file.isImage) {
                        onShowImageModal(file);
                      }
                    }}
                    onFileContextMenu={(file, position) => {
                      onShowFileActionMenu(file, selectedNode.id, position);
                    }}
                  />
                );
              }
              return null;
            })()
          )}

          {/* 選択されたノードのアクションボタンを最前面に表示 */}
          {selectedNodeId && (
            (() => {
              const selectedNode = allNodes.find(node => node.id === selectedNodeId);
              if (selectedNode) {
                const nodeSize = calculateNodeSize(selectedNode, editText, editingNodeId === selectedNode.id);
                return (
                  <NodeActions
                    key={`actions-${selectedNodeId}`}
                    node={selectedNode}
                    isSelected={selectedNodeId === selectedNode.id}
                    isEditing={editingNodeId === selectedNode.id}
                    nodeHeight={nodeSize.height}
                    onAddChild={onAddChild}
                    onDelete={onDeleteNode}
                    onFileUpload={onFileUpload}
                  />
                );
              }
              return null;
            })()
          )}
        </g>
      </svg>


      <style>{`
        .mindmap-canvas-container {
          position: relative;
          height: 100%;
          width: 100%;
        }

        svg {
          display: block;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          width: 100%;
          height: 100%;
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
        }
      `}</style>
    </div>
  );
};

export default memo(CanvasRenderer);