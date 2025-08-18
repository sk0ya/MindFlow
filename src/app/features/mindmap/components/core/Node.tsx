import React, { useRef, useState, useCallback, useEffect, memo } from 'react';
import NodeRenderer from './NodeRenderer';
import NodeEditor from './NodeEditor';
import NodeAttachments from './NodeAttachments';
import NodeActions from './NodeActions';
import NodeMapLinkIndicator from './NodeMapLinkIndicator';
import { useNodeDragHandler } from './NodeDragHandler';
import { calculateNodeSize } from '../../../../shared/utils/nodeUtils';
import type { MindMapNode, FileAttachment } from '@shared/types';

interface NodeProps {
  node: MindMapNode;
  isSelected: boolean;
  isEditing: boolean;
  isDragTarget?: boolean;
  onSelect: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onDragStart?: (nodeId: string) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: (nodeId: string, x: number, y: number) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onRightClick?: (e: React.MouseEvent, nodeId: string) => void;
  onFileUpload: (nodeId: string, files: FileList) => void;
  onRemoveFile: (nodeId: string, fileId: string) => void;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onShowNodeMapLinks: (node: MindMapNode, position: { x: number; y: number }) => void;
  editText: string;
  setEditText: (text: string) => void;
  zoom: number;
  pan: { x: number; y: number };
  svgRef: React.RefObject<SVGSVGElement>;
}

const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  isEditing,
  isDragTarget,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onDragStart,
  onDragMove,
  onDragEnd,
  onAddChild,
  onDelete,
  onRightClick,
  onFileUpload,
  onShowImageModal,
  onShowFileActionMenu,
  onShowNodeMapLinks,
  editText,
  setEditText,
  zoom,
  pan,
  svgRef
}) => {
  const [isLayoutTransitioning, setIsLayoutTransitioning] = useState(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousPosition = useRef({ x: node.x, y: node.y });
  
  // ドラッグハンドラーを使用
  const { isDragging, handleMouseDown } = useNodeDragHandler({
    node,
    zoom,
    svgRef,
    onDragStart,
    onDragMove,
    onDragEnd
  });

  // 位置変更を検出してレイアウトトランジション状態を管理
  useEffect(() => {
    const positionChanged = previousPosition.current.x !== node.x || previousPosition.current.y !== node.y;
    if (positionChanged && !isDragging) {
      setIsLayoutTransitioning(true);
      previousPosition.current = { x: node.x, y: node.y };
      
      // 少し遅延してからトランジションを再有効化
      const timeoutId = setTimeout(() => {
        setIsLayoutTransitioning(false);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    } else {
      previousPosition.current = { x: node.x, y: node.y };
    }
    return undefined;
  }, [node.x, node.y, isDragging]);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // ドラッグが発生していない場合のみクリック処理
    if (!isDragging) {
      if (isSelected && !isEditing) {
        // 既に選択されている場合は編集モードに入る
        onStartEdit(node.id);
      } else {
        // 未選択の場合は選択のみ
        onSelect(node.id);
      }
    }
  }, [node.id, isDragging, isSelected, isEditing, onStartEdit, onSelect]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onStartEdit(node.id);
  }, [node.id, onStartEdit]);

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onRightClick) {
      onRightClick(e, node.id);
    }
  }, [node.id, onRightClick]);

  // ノードのサイズ計算（共有ユーティリティ関数を使用）
  const nodeSize = calculateNodeSize(node, editText, isEditing);
  const nodeWidth = nodeSize.width;
  const nodeHeight = nodeSize.height;
  const imageHeight = nodeSize.imageHeight;

  return (
    <g>
      <NodeRenderer
        node={node}
        isSelected={isSelected}
        isDragTarget={isDragTarget}
        isDragging={isDragging}
        isLayoutTransitioning={isLayoutTransitioning}
        nodeWidth={nodeWidth}
        nodeHeight={nodeHeight}
        imageHeight={imageHeight}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleRightClick}
      />
      
      <NodeAttachments
        node={node}
        nodeWidth={nodeWidth}
        imageHeight={imageHeight}
        svgRef={svgRef}
        zoom={zoom}
        pan={pan}
        onShowImageModal={onShowImageModal}
        onShowFileActionMenu={onShowFileActionMenu}
      />

      <NodeEditor
        node={node}
        isEditing={isEditing}
        editText={editText}
        setEditText={setEditText}
        onFinishEdit={onFinishEdit}
        nodeWidth={nodeWidth}
        imageHeight={imageHeight}
        blurTimeoutRef={blurTimeoutRef}
      />

      <NodeActions
        node={node}
        isSelected={isSelected}
        isEditing={isEditing}
        nodeHeight={nodeHeight}
        onAddChild={onAddChild}
        onDelete={onDelete}
        onFileUpload={onFileUpload}
        onShowNodeMapLinks={onShowNodeMapLinks}
      />

      <NodeMapLinkIndicator
        node={node}
        nodeWidth={nodeWidth}
        nodeHeight={nodeHeight}
        onShowNodeMapLinks={onShowNodeMapLinks}
      />
    </g>
  );
};

// React.memoでパフォーマンス最適化
export default memo(Node, (prevProps: NodeProps, nextProps: NodeProps) => {
  // ノードの基本情報が変わった場合は再レンダリング
  if (prevProps.node.id !== nextProps.node.id ||
      prevProps.node.text !== nextProps.node.text ||
      prevProps.node.x !== nextProps.node.x ||
      prevProps.node.y !== nextProps.node.y ||
      prevProps.node.fontSize !== nextProps.node.fontSize ||
      prevProps.node.fontWeight !== nextProps.node.fontWeight ||
      prevProps.node.color !== nextProps.node.color ||
      prevProps.node.collapsed !== nextProps.node.collapsed) {
    return false;
  }

  // 添付ファイルが変わった場合は再レンダリング
  if (JSON.stringify(prevProps.node.attachments) !== JSON.stringify(nextProps.node.attachments)) {
    return false;
  }

  // 選択・編集状態が変わった場合は再レンダリング
  if (prevProps.isSelected !== nextProps.isSelected ||
      prevProps.isEditing !== nextProps.isEditing ||
      prevProps.isDragTarget !== nextProps.isDragTarget) {
    return false;
  }

  // 編集テキストが変わった場合は再レンダリング
  if (prevProps.editText !== nextProps.editText) {
    return false;
  }

  // ズーム・パンが変わった場合は再レンダリング
  if (prevProps.zoom !== nextProps.zoom ||
      prevProps.pan.x !== nextProps.pan.x ||
      prevProps.pan.y !== nextProps.pan.y) {
    return false;
  }

  // その他の場合は再レンダリングしない
  return true;
});

export { Node };
