import React, { useRef, memo, useCallback } from 'react';
import CanvasRenderer from '../core/CanvasRenderer';
import { useCanvasDragHandler } from '../core/CanvasDragHandler';
import { useCanvasViewportHandler } from '../core/CanvasViewportHandler';
import { useCanvasEventHandler } from '../core/CanvasEventHandler';
import type { MindMapData, MindMapNode, FileAttachment, NodeLink } from '@shared/types';

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
  onShowLinkActionMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onAddLink: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
  
  // Link display data
  availableMaps?: { id: string; title: string }[];
  currentMapData?: { id: string; rootNode: any };
  
  // Link navigation
  onLinkNavigate?: (link: NodeLink) => void;
  
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  
  // Icon toggle handlers
  onToggleAttachmentList?: (nodeId: string) => void;
  onToggleLinkList?: (nodeId: string) => void;
}

const MindMapCanvas: React.FC<MindMapCanvasProps> = (props) => {
  const {
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    setEditText,
    onSelectNode,
    onStartEdit,
    onFinishEdit,
    onChangeParent,
    onChangeSiblingOrder,
    onAddChild,
    onAddSibling,
    onDeleteNode,
    onRightClick,
    onToggleCollapse,
    onFileUpload,
    onRemoveFile,
    onShowImageModal,
    onShowFileActionMenu,
    onShowLinkActionMenu,
    onUpdateNode,
    onAutoLayout,
    availableMaps,
    currentMapData,
    onLinkNavigate,
    zoom,
    setZoom,
    pan,
    setPan,
    onToggleAttachmentList,
    onToggleLinkList
  } = props;

  const svgRef = useRef<SVGSVGElement>(null);
  
  // ノードの平坦化
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
  
  // ドラッグハンドラーを使用
  const { dragState, handleDragStart, handleDragMove, handleDragEnd } = useCanvasDragHandler({
    allNodes,
    zoom,
    pan,
    svgRef,
    onChangeParent,
    onChangeSiblingOrder,
    rootNode: data.rootNode
  });

  // ビューポートハンドラーを使用
  const { handleWheel, handleMouseDown, getCursor, getIsPanning } = useCanvasViewportHandler({
    zoom,
    setZoom,
    pan,
    setPan,
    svgRef,
    isDragging: dragState.isDragging
  });

  // イベントハンドラーを使用
  const { handleMouseUp: handleCanvasMouseUp, handleContextMenu, handleNodeSelect, handleMouseDown: handleCanvasMouseDown } = useCanvasEventHandler({
    editingNodeId,
    editText,
    onSelectNode,
    onFinishEdit,
    getIsPanning
  });

  // ドラッグハンドラーのアダプター（Node.tsxとの互換性維持）
  const handleDragStartAdapter = (nodeId: string) => {
    handleDragStart(nodeId, {} as React.MouseEvent);
  };

  const handleDragMoveAdapter = (x: number, y: number) => {
    const mockEvent = { clientX: x, clientY: y } as React.MouseEvent;
    handleDragMove(mockEvent);
  };

  const handleDragEndAdapter = (_nodeId: string, _x: number, _y: number) => {
    handleDragEnd();
  };

  // マウスダウンイベントを組み合わせる
  const combinedHandleMouseDown = useCallback((e: React.MouseEvent) => {
    handleCanvasMouseDown(e);
    handleMouseDown(e);
  }, [handleCanvasMouseDown, handleMouseDown]);

  return (
    <CanvasRenderer
      svgRef={svgRef}
      data={data}
      allNodes={allNodes}
      selectedNodeId={selectedNodeId}
      editingNodeId={editingNodeId}
      editText={editText}
      setEditText={setEditText}
      zoom={zoom}
      pan={pan}
      cursor={getCursor()}
      dragState={dragState}
      onWheel={handleWheel}
      onMouseDown={combinedHandleMouseDown}
      onMouseUp={handleCanvasMouseUp}
      onContextMenu={handleContextMenu}
      onNodeSelect={handleNodeSelect}
      onStartEdit={onStartEdit}
      onFinishEdit={onFinishEdit}
      onAddChild={onAddChild}
      onAddSibling={onAddSibling}
      onDeleteNode={onDeleteNode}
      onRightClick={onRightClick}
      onToggleCollapse={onToggleCollapse}
      onFileUpload={onFileUpload}
      onRemoveFile={onRemoveFile}
      onShowImageModal={onShowImageModal}
      onShowFileActionMenu={onShowFileActionMenu}
      onShowLinkActionMenu={onShowLinkActionMenu}
      onUpdateNode={onUpdateNode}
      onAutoLayout={onAutoLayout}
      availableMaps={availableMaps}
      currentMapData={currentMapData}
      onLinkNavigate={onLinkNavigate}
      onDragStart={handleDragStartAdapter}
      onDragMove={handleDragMoveAdapter}
      onDragEnd={handleDragEndAdapter}
      onToggleAttachmentList={onToggleAttachmentList}
      onToggleLinkList={onToggleLinkList}
    />
  );
};

export default memo(MindMapCanvas);