import type { NodeLink, MindMapNode, MindMapData } from '@shared/types';
import { generateLinkId } from './idGenerator';
import { findNodeById } from './nodeTreeUtils';

// ノードにリンクを追加する関数
export const addLinkToNode = (
  node: MindMapNode, 
  linkData: Partial<NodeLink>
): MindMapNode => {
  const newLink: NodeLink = {
    id: linkData.id || generateLinkId(),
    targetMapId: linkData.targetMapId,
    targetNodeId: linkData.targetNodeId,
    createdAt: linkData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return {
    ...node,
    links: [...(node.links || []), newLink]
  };
};

// ノードのリンクを更新する関数
export const updateLinkInNode = (
  node: MindMapNode,
  linkId: string,
  updates: Partial<NodeLink>
): MindMapNode => {
  if (!node.links) return node;

  return {
    ...node,
    links: node.links.map(link =>
      link.id === linkId
        ? {
            ...link,
            ...updates,
            updatedAt: new Date().toISOString()
          }
        : link
    )
  };
};

// ノードからリンクを削除する関数
export const removeLinkFromNode = (
  node: MindMapNode,
  linkId: string
): MindMapNode => {
  if (!node.links) return node;

  return {
    ...node,
    links: node.links.filter(link => link.id !== linkId)
  };
};

// ツリー内のノードを検索してリンクを追加する関数
export const addLinkToNodeInTree = (
  rootNode: MindMapNode,
  nodeId: string,
  linkData: Partial<NodeLink>
): MindMapNode => {
  if (rootNode.id === nodeId) {
    return addLinkToNode(rootNode, linkData);
  }

  return {
    ...rootNode,
    children: rootNode.children.map(child =>
      addLinkToNodeInTree(child, nodeId, linkData)
    )
  };
};

// ツリー内のノードを検索してリンクを更新する関数
export const updateLinkInNodeTree = (
  rootNode: MindMapNode,
  nodeId: string,
  linkId: string,
  updates: Partial<NodeLink>
): MindMapNode => {
  if (rootNode.id === nodeId) {
    return updateLinkInNode(rootNode, linkId, updates);
  }

  return {
    ...rootNode,
    children: rootNode.children.map(child =>
      updateLinkInNodeTree(child, nodeId, linkId, updates)
    )
  };
};

// ツリー内のノードを検索してリンクを削除する関数
export const removeLinkFromNodeTree = (
  rootNode: MindMapNode,
  nodeId: string,
  linkId: string
): MindMapNode => {
  if (rootNode.id === nodeId) {
    return removeLinkFromNode(rootNode, linkId);
  }

  return {
    ...rootNode,
    children: rootNode.children.map(child =>
      removeLinkFromNodeTree(child, nodeId, linkId)
    )
  };
};


// リンクを検証する関数
export const validateLink = (linkData: Partial<NodeLink>): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];


  if (linkData.targetMapId && linkData.targetMapId.length > 50) {
    errors.push('ターゲットマップIDは50文字以内で入力してください');
  }

  if (linkData.targetNodeId && linkData.targetNodeId.length > 50) {
    errors.push('ターゲットノードIDは50文字以内で入力してください');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// リンク先の情報を取得する関数
export const getLinkTargetInfo = (
  link: NodeLink,
  currentData: MindMapData
): {
  isCurrentMap: boolean;
  targetNode: MindMapNode | null;
  canNavigate: boolean;
} => {
  const isCurrentMap = !link.targetMapId || link.targetMapId === currentData.id;
  
  let targetNode: MindMapNode | null = null;
  
  if (isCurrentMap && link.targetNodeId) {
    targetNode = findNodeById(currentData.rootNode, link.targetNodeId);
  }

  const canNavigate = isCurrentMap && (targetNode !== null || !link.targetNodeId);

  return {
    isCurrentMap,
    targetNode,
    canNavigate
  };
};

// リンクのナビゲーション用URLを生成する関数
export const generateLinkUrl = (link: NodeLink): string | null => {
  if (!link.targetMapId && !link.targetNodeId) {
    return null;
  }

  const params = new URLSearchParams();
  
  if (link.targetMapId) {
    params.set('mapId', link.targetMapId);
  }
  
  if (link.targetNodeId) {
    params.set('nodeId', link.targetNodeId);
  }

  return `${window.location.pathname}?${params.toString()}`;
};

// リンクの表示用テキストを生成する関数
export const getLinkDisplayText = (link: NodeLink): string => {
  const parts: string[] = [];
  
  if (link.targetMapId) {
    parts.push(`Map: ${link.targetMapId}`);
  }
  
  if (link.targetNodeId) {
    parts.push(`Node: ${link.targetNodeId}`);
  }

  if (parts.length === 0) {
    return '内部リンク';
  }

  return parts.join(' → ');
};