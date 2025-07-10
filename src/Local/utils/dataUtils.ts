import type { MindMapNode, MindMapData } from '../shared/types';

/**
 * Find a node by ID in a tree structure
 */
export function findNodeById(node: MindMapNode, id: string): MindMapNode | null {
  if (node.id === id) {
    return node;
  }

  for (const child of node.children || []) {
    const found = findNodeById(child, id);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Update a node in the tree structure
 */
export function updateNodeInTree(
  node: MindMapNode,
  id: string,
  updates: Partial<MindMapNode>
): MindMapNode {
  if (node.id === id) {
    return { ...node, ...updates };
  }

  return {
    ...node,
    children: node.children?.map(child => updateNodeInTree(child, id, updates)) || []
  };
}

/**
 * Delete a node from the tree structure
 */
export function deleteNodeFromTree(node: MindMapNode, id: string): MindMapNode {
  // Don't delete root node (assume root doesn't have parent in tree structure)
  if (node.id === id && node.id === 'root') {
    return node;
  }

  return {
    ...node,
    children: node.children?.filter(child => child.id !== id)
      .map(child => deleteNodeFromTree(child, id)) || []
  };
}

/**
 * Add a node to the tree structure
 */
export function addNodeToTree(
  node: MindMapNode,
  parentId: string,
  newNode: MindMapNode
): MindMapNode {
  if (node.id === parentId) {
    return {
      ...node,
      children: [...(node.children || []), newNode]
    };
  }

  return {
    ...node,
    children: node.children?.map(child => addNodeToTree(child, parentId, newNode)) || []
  };
}

/**
 * Validate MindMap data structure
 */
export function validateMindMapData(data: any): data is MindMapData {
  if (!data || typeof data !== 'object') return false;
  
  const requiredFields = ['id', 'title', 'rootNode'];
  for (const field of requiredFields) {
    if (!(field in data)) return false;
  }

  // Basic validation of rootNode
  if (!data.rootNode || typeof data.rootNode !== 'object') return false;
  if (!data.rootNode.id || typeof data.rootNode.id !== 'string') return false;
  if (!data.rootNode.text || typeof data.rootNode.text !== 'string') return false;

  return true;
}

/**
 * Generate a unique ID with optional prefix
 */
export function generateUniqueId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substr(2, 9);
  const id = `${timestamp}-${randomPart}`;
  
  return prefix ? `${prefix}-${id}` : id;
}