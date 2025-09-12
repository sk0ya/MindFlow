import { useCallback, useRef } from 'react';
import { logger } from '../../../../shared/utils/logger';
import { useMindMapStore } from '../../../../core/store/mindMapStore';

interface CanvasEventHandlerProps {
  editingNodeId: string | null;
  editText: string;
  onSelectNode: (nodeId: string | null) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  getIsPanning?: () => boolean;
}

export const useCanvasEventHandler = ({
  editingNodeId,
  editText,
  onSelectNode,
  onFinishEdit,
  getIsPanning
}: CanvasEventHandlerProps) => {
  const store = useMindMapStore();
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const wasPanningRef = useRef<boolean>(false);
  const DRAG_THRESHOLD = 5; // ピクセル

  // マウスダウン時の位置を記録
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    // マウスダウン時点でのパン状態を記録
    wasPanningRef.current = getIsPanning ? getIsPanning() : false;
  }, [getIsPanning]);

  // 背景マウスアップ処理（クリック判定）
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // マウスダウン位置が記録されていない場合はスキップ
    if (!mouseDownPosRef.current) {
      return;
    }

    // マウス移動量を計算
    const deltaX = Math.abs(e.clientX - mouseDownPosRef.current.x);
    const deltaY = Math.abs(e.clientY - mouseDownPosRef.current.y);
    const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 必ずmouseDownPosRefをクリア
    mouseDownPosRef.current = null;

    // しきい値以上動いた場合はドラッグと見なす
    const wasDragging = totalMovement > DRAG_THRESHOLD;
    
    // ドラッグまたはパン操作の場合は背景クリック処理をスキップ
    // マウスダウン時に記録したパン状態を使用（ViewportHandlerが先にリセットするため）
    const wasPanning = wasPanningRef.current;
    
    if (wasDragging || wasPanning) {
      return;
    }

    // ノード要素（rect, circle, foreignObject）以外をクリックした場合に背景クリック処理
    const target = e.target as Element;
    const isNodeElement = target.tagName === 'rect' || 
                         target.tagName === 'circle' || 
                         target.tagName === 'foreignObject' ||
                         target.closest('foreignObject');
    
    if (!isNodeElement) {
      // 編集中の場合は編集を確定
      if (editingNodeId) {
        onFinishEdit(editingNodeId, editText);
      }
      // ノード選択をクリア
      onSelectNode(null);
      // 添付ファイル・リンク一覧を閉じる
      store.closeAttachmentAndLinkLists();
    }
    
    // マウスアップ時にパン状態をリセット
    wasPanningRef.current = false;
  }, [editingNodeId, editText, onFinishEdit, onSelectNode, store]);

  // 右クリック処理
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ノード選択時に編集を確定する処理
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    // 編集中で、異なるノードが選択された場合は編集を確定
    if (editingNodeId && editingNodeId !== nodeId) {
      logger.debug('Canvas: 別ノード選択時の編集確定をNode.jsxに委任');
    }
    
    // ノード選択時に添付ファイル・リンク一覧を閉じる（ただし、アイコンクリックでの表示切り替えは除く）
    const { showAttachmentListForNode, showLinkListForNode } = store.ui;
    if (showAttachmentListForNode !== nodeId && showLinkListForNode !== nodeId) {
      store.closeAttachmentAndLinkLists();
    }
    
    onSelectNode(nodeId);
  }, [editingNodeId, onSelectNode, store]);

  return {
    handleMouseUp,
    handleContextMenu,
    handleNodeSelect,
    handleMouseDown
  };
};

export type { CanvasEventHandlerProps };