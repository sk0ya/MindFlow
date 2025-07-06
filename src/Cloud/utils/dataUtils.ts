// Shared data utilities for cloud mode
import { MindMapNode, MindMapData } from '../../shared/types/core';

// 統一された空文字ノードクリーンアップ関数
export const cleanEmptyNodesFromData = (data: MindMapData | null): MindMapData | null => {
  if (!data || !data.rootNode) return data;

  const cleanNode = (node: MindMapNode): MindMapNode => {
    if (!node) return node;
    
    // 子ノードを再帰的にクリーンアップし、空文字ノードを除去
    const cleanedChildren = node.children
      ?.map(cleanNode)
      ?.filter((child: MindMapNode) => {
        // ルートノード以外で、テキストが空またはnullの場合は除去
        const hasValidText = child && child.text && child.text.trim() !== '';
        const isRoot = child && child.id === 'root';
        return isRoot || hasValidText;
      }) || [];

    return {
      ...node,
      children: cleanedChildren
    };
  };

  const cleanedData = {
    ...data,
    rootNode: cleanNode(data.rootNode),
    updatedAt: new Date().toISOString()
  };

  if (process.env.NODE_ENV === 'development') {
    const originalNodeCount = countNodes(data.rootNode);
    const cleanedNodeCount = countNodes(cleanedData.rootNode);
    if (originalNodeCount !== cleanedNodeCount) {
      console.log('🧹 空文字ノードをクリーンアップ:', {
        original: originalNodeCount,
        cleaned: cleanedNodeCount,
        removed: originalNodeCount - cleanedNodeCount
      });
    }
  }

  return cleanedData;
};

// ノード数をカウントするヘルパー関数
export const countNodes = (node: MindMapNode | null): number => {
  if (!node) return 0;
  return 1 + (node.children?.reduce((sum: number, child: MindMapNode) => sum + countNodes(child), 0) || 0);
};

// 空文字ノードが存在するかチェックする関数
export const hasEmptyNodes = (node: MindMapNode | null): boolean => {
  if (!node) return false;
  
  if (node.children) {
    for (const child of node.children) {
      // 空文字またはnullテキストのノードがあるかチェック
      if (!child.text || child.text.trim() === '') {
        return true;
      }
      // 再帰的にチェック
      if (hasEmptyNodes(child)) {
        return true;
      }
    }
  }
  
  return false;
};

export type { MindMapNode, MindMapData };