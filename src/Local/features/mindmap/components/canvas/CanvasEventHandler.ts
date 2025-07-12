import { useCallback } from 'react';

interface CanvasEventHandlerProps {
  editingNodeId: string | null;
  editText: string;
  onSelectNode: (nodeId: string | null) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
}

export const useCanvasEventHandler = ({
  editingNodeId,
  editText,
  onSelectNode,
  onFinishEdit
}: CanvasEventHandlerProps) => {

  // 背景クリック処理
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    // ノード要素（rect, circle, foreignObject）以外をクリックした場合に背景クリック処理
    const target = e.target as Element;
    const isNodeElement = target.tagName === 'rect' || 
                         target.tagName === 'circle' || 
                         target.tagName === 'foreignObject' ||
                         target.closest('foreignObject');
    
    if (!isNodeElement) {
      // 編集中の場合は編集を確定してから選択をクリア
      if (editingNodeId) {
        onFinishEdit(editingNodeId, editText);
      }
      onSelectNode(null);
    }
  }, [editingNodeId, editText, onFinishEdit, onSelectNode]);

  // 右クリック処理
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onSelectNode(null);
  }, [onSelectNode]);

  // ノード選択時に編集を確定する処理
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    // 編集中で、異なるノードが選択された場合は編集を確定
    if (editingNodeId && editingNodeId !== nodeId) {
      console.log('🖱️ Canvas: 別ノード選択時の編集確定をNode.jsxに委任');
    }
    onSelectNode(nodeId);
  }, [editingNodeId, onSelectNode]);

  return {
    handleBackgroundClick,
    handleContextMenu,
    handleNodeSelect
  };
};

export type { CanvasEventHandlerProps };