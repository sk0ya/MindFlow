import type { MindMapNode } from '../../../../shared/types';

// Type definitions for the hook parameters and returns
interface Position {
  x: number;
  y: number;
}

interface NodeHandlers {
  handleAddChild: (parentId: string) => Promise<void>;
  handleRightClick: (e: React.MouseEvent, nodeId?: string) => void;
  handleAddSibling: (nodeId: string) => void;
  handleCopyNode: (node: MindMapNode) => MindMapNode;
  handlePasteNode: (parentId: string, clipboard: MindMapNode | null) => Promise<void>;
  handleNodeSelect: (nodeId: string | null) => void;
  handleAddNodeMapLink: (nodeId: string, targetMapId: string, targetMapTitle: string, description: string) => void;
  handleRemoveNodeMapLink: (nodeId: string, linkId: string) => void;
}

/**
 * ノード操作関連のハンドラーを管理するカスタムフック
 */
export const useNodeHandlers = (
  setSelectedNodeId: (id: string | null) => void,
  setContextMenuPosition: (position: Position | null) => void,
  setShowContextMenu: (show: boolean) => void,
  setShowCustomizationPanel: (show: boolean) => void,
  addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>,
  addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean) => Promise<string | null>,
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void,
  addNodeMapLink: (nodeId: string, targetMapId: string, targetMapTitle: string, description: string) => void,
  removeNodeMapLink: (nodeId: string, linkId: string) => void,
  updateCursorPosition?: (nodeId: string) => void
): NodeHandlers => {
  const handleAddChild = async (parentId: string): Promise<void> => {
    await addChildNode(parentId, '', true); // startEditing = true で即座に編集開始
  };

  const handleRightClick = (e: React.MouseEvent, nodeId?: string): void => {
    e.preventDefault();
    e.stopPropagation();
    
    if (nodeId) {
      setSelectedNodeId(nodeId);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
      setShowCustomizationPanel(false);
    }
  };

  const handleAddSibling = (nodeId: string): void => {
    addSiblingNode(nodeId, '', true); // startEditing = true で即座に編集開始
  };

  const handleCopyNode = (node: MindMapNode): MindMapNode => {
    const nodeCopy = JSON.parse(JSON.stringify(node));
    const removeIds = (n: any): void => {
      delete n.id;
      if (n.children) n.children.forEach((child: any) => removeIds(child));
    };
    removeIds(nodeCopy);
    return nodeCopy;
  };

  const handlePasteNode = async (parentId: string, clipboard: MindMapNode | null): Promise<void> => {
    if (!clipboard) return;
    
    const newNodeId = await addChildNode(parentId);
    if (newNodeId) {
      updateNode(newNodeId, {
        text: clipboard.text || '',
        fontSize: clipboard.fontSize,
        fontWeight: clipboard.fontWeight,
        fontStyle: clipboard.fontStyle
      });
      setSelectedNodeId(newNodeId);
    }
  };

  // カーソル更新（ノード選択時）
  const handleNodeSelect = (nodeId: string | null): void => {
    setSelectedNodeId(nodeId);
    if (updateCursorPosition && nodeId) {
      updateCursorPosition(nodeId);
    }
  };

  const handleAddNodeMapLink = (nodeId: string, targetMapId: string, targetMapTitle: string, description: string): void => {
    addNodeMapLink(nodeId, targetMapId, targetMapTitle, description);
  };

  const handleRemoveNodeMapLink = (nodeId: string, linkId: string): void => {
    removeNodeMapLink(nodeId, linkId);
  };

  return {
    handleAddChild,
    handleRightClick,
    handleAddSibling,
    handleCopyNode,
    handlePasteNode,
    handleNodeSelect,
    handleAddNodeMapLink,
    handleRemoveNodeMapLink
  };
};