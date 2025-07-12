import type { MindMapNode, MindMapData } from '../../../shared/types';

// 正規化されたデータ構造
export interface NormalizedData {
  nodes: Record<string, MindMapNode>;
  rootNodeId: string;
  parentMap: Record<string, string>; // child -> parent
  childrenMap: Record<string, string[]>; // parent -> children
}

export interface NormalizedMindMapData extends Omit<MindMapData, 'rootNode'> {
  rootNodeId: string;
  normalizedData: NormalizedData;
}

/**
 * 従来の階層構造を正規化構造に変換
 */
export function normalizeTreeData(rootNode: MindMapNode): NormalizedData {
  const nodes: Record<string, MindMapNode> = {};
  const parentMap: Record<string, string> = {};
  const childrenMap: Record<string, string[]> = {};

  function traverse(node: MindMapNode, parentId?: string) {
    // ノードを格納（childrenプロパティを除去）
    const { children, ...nodeWithoutChildren } = node;
    nodes[node.id] = { ...nodeWithoutChildren, children: [] };

    // 親子関係を記録
    if (parentId) {
      parentMap[node.id] = parentId;
    }

    // 子供のIDリストを記録
    const childIds = (children || []).map(child => child.id);
    childrenMap[node.id] = childIds;

    // 子ノードを再帰的に処理
    (children || []).forEach(child => {
      traverse(child, node.id);
    });
  }

  traverse(rootNode);

  return {
    nodes,
    rootNodeId: rootNode.id,
    parentMap,
    childrenMap
  };
}

/**
 * 正規化構造から階層構造を復元
 */
export function denormalizeTreeData(normalizedData: NormalizedData): MindMapNode {
  const { nodes, rootNodeId, childrenMap } = normalizedData;

  function buildTree(nodeId: string): MindMapNode {
    const node = nodes[nodeId];
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const childIds = childrenMap[nodeId] || [];
    const children = childIds.map(childId => buildTree(childId));

    return {
      ...node,
      children
    };
  }

  return buildTree(rootNodeId);
}

/**
 * 正規化されたデータでのノード検索 - O(1)
 */
export function findNormalizedNode(
  normalizedData: NormalizedData, 
  nodeId: string
): MindMapNode | null {
  return normalizedData.nodes[nodeId] || null;
}

/**
 * 正規化されたデータでのノード更新 - O(1)
 */
export function updateNormalizedNode(
  normalizedData: NormalizedData,
  nodeId: string,
  updates: Partial<MindMapNode>
): NormalizedData {
  const existingNode = normalizedData.nodes[nodeId];
  if (!existingNode) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  return {
    ...normalizedData,
    nodes: {
      ...normalizedData.nodes,
      [nodeId]: { ...existingNode, ...updates }
    }
  };
}

/**
 * 正規化されたデータでのノード削除 - O(1)
 */
export function deleteNormalizedNode(
  normalizedData: NormalizedData,
  nodeId: string
): NormalizedData {
  if (nodeId === normalizedData.rootNodeId) {
    throw new Error('Cannot delete root node');
  }

  const parentId = normalizedData.parentMap[nodeId];
  if (!parentId) {
    throw new Error(`Parent not found for node: ${nodeId}`);
  }

  // 削除対象ノードとその子孫を特定
  const nodesToDelete = new Set<string>();
  
  function collectDescendants(id: string) {
    nodesToDelete.add(id);
    const children = normalizedData.childrenMap[id] || [];
    children.forEach(childId => collectDescendants(childId));
  }
  
  collectDescendants(nodeId);

  // 新しい構造を作成
  const newNodes = { ...normalizedData.nodes };
  const newParentMap = { ...normalizedData.parentMap };
  const newChildrenMap = { ...normalizedData.childrenMap };

  // 削除対象ノードを除去
  nodesToDelete.forEach(id => {
    delete newNodes[id];
    delete newParentMap[id];
    delete newChildrenMap[id];
  });

  // 親の子リストから削除
  newChildrenMap[parentId] = newChildrenMap[parentId].filter(id => id !== nodeId);

  return {
    ...normalizedData,
    nodes: newNodes,
    parentMap: newParentMap,
    childrenMap: newChildrenMap
  };
}

/**
 * 正規化されたデータでのノード追加 - O(1)
 */
export function addNormalizedNode(
  normalizedData: NormalizedData,
  parentId: string,
  newNode: MindMapNode
): NormalizedData {
  if (normalizedData.nodes[newNode.id]) {
    throw new Error(`Node already exists: ${newNode.id}`);
  }

  if (!normalizedData.nodes[parentId]) {
    throw new Error(`Parent node not found: ${parentId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { children: _children, ...nodeWithoutChildren } = newNode;

  return {
    ...normalizedData,
    nodes: {
      ...normalizedData.nodes,
      [newNode.id]: { ...nodeWithoutChildren, children: [] }
    },
    parentMap: {
      ...normalizedData.parentMap,
      [newNode.id]: parentId
    },
    childrenMap: {
      ...normalizedData.childrenMap,
      [parentId]: [...(normalizedData.childrenMap[parentId] || []), newNode.id],
      [newNode.id]: []
    }
  };
}

/**
 * 正規化されたデータでのノード移動 - O(1)
 */
export function moveNormalizedNode(
  normalizedData: NormalizedData,
  nodeId: string,
  newParentId: string
): NormalizedData {
  if (nodeId === normalizedData.rootNodeId) {
    throw new Error('Cannot move root node');
  }

  const oldParentId = normalizedData.parentMap[nodeId];
  if (!oldParentId) {
    throw new Error(`Parent not found for node: ${nodeId}`);
  }

  if (!normalizedData.nodes[newParentId]) {
    throw new Error(`New parent node not found: ${newParentId}`);
  }

  // 循環参照チェック
  function isDescendant(ancestorId: string, descendantId: string): boolean {
    const children = normalizedData.childrenMap[descendantId] || [];
    return children.includes(ancestorId) || 
           children.some(childId => isDescendant(ancestorId, childId));
  }

  if (isDescendant(nodeId, newParentId)) {
    throw new Error('Cannot move node to its descendant');
  }

  return {
    ...normalizedData,
    parentMap: {
      ...normalizedData.parentMap,
      [nodeId]: newParentId
    },
    childrenMap: {
      ...normalizedData.childrenMap,
      [oldParentId]: normalizedData.childrenMap[oldParentId].filter(id => id !== nodeId),
      [newParentId]: [...(normalizedData.childrenMap[newParentId] || []), nodeId]
    }
  };
}