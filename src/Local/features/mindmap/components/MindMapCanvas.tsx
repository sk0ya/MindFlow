import React, { useRef, memo } from 'react';
import CanvasRenderer from './canvas/CanvasRenderer';
import { useCanvasDragHandler } from './canvas/CanvasDragHandler';
import { useCanvasViewportHandler } from './canvas/CanvasViewportHandler';
import { useCanvasEventHandler } from './canvas/CanvasEventHandler';
import type { MindMapData, MindMapNode, FileAttachment } from '@shared/types';

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
  onShowNodeMapLinks: (node: MindMapNode, position: { x: number; y: number }) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
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
    onShowNodeMapLinks,
    zoom,
    setZoom,
    pan,
    setPan
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
  console.log('🎯 MindMapCanvas useCanvasDragHandler 呼び出し:', { 
    hasOnChangeParent: !!onChangeParent,
    hasOnChangeSiblingOrder: !!onChangeSiblingOrder,
    onChangeParentType: typeof onChangeParent,
    onChangeSiblingOrderType: typeof onChangeSiblingOrder
  });
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
  const { handleWheel, handleMouseDown, getCursor } = useCanvasViewportHandler({
    zoom,
    setZoom,
    pan,
    setPan,
    svgRef,
    isDragging: dragState.isDragging
  });

  // イベントハンドラーを使用
  const { handleBackgroundClick, handleContextMenu, handleNodeSelect } = useCanvasEventHandler({
    editingNodeId,
    editText,
    onSelectNode,
    onFinishEdit
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
      onMouseDown={handleMouseDown}
      onBackgroundClick={handleBackgroundClick}
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
      onShowNodeMapLinks={onShowNodeMapLinks}
      onDragStart={handleDragStartAdapter}
      onDragMove={handleDragMoveAdapter}
      onDragEnd={handleDragEndAdapter}
    />
  );
};

export default memo(MindMapCanvas);