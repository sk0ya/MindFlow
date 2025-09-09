import { MindMapNode } from '../types/dataTypes';

export function findNodeById(rootNode: MindMapNode, nodeId: string): MindMapNode | null {
  if (rootNode.id === nodeId) return rootNode;
  
  for (const child of rootNode.children || []) {
    const result = findNodeById(child, nodeId);
    if (result) return result;
  }
  
  return null;
}

export function findNodePathById(rootNode: MindMapNode, nodeId: string): MindMapNode[] | null {
  if (rootNode.id === nodeId) return [rootNode];
  
  for (const child of rootNode.children || []) {
    const childPath = findNodePathById(child, nodeId);
    if (childPath) return [rootNode, ...childPath];
  }
  
  return null;
}

export function traverseNodes(rootNode: MindMapNode, callback: (node: MindMapNode) => void): void {
  callback(rootNode);
  
  for (const child of rootNode.children || []) {
    traverseNodes(child, callback);
  }
}

export function updateNodeInTree(
  rootNode: MindMapNode,
  nodeId: string,
  updater: (node: MindMapNode) => MindMapNode
): MindMapNode {
  if (rootNode.id === nodeId) {
    return updater(rootNode);
  }
  
  return {
    ...rootNode,
    children: rootNode.children?.map(child =>
      updateNodeInTree(child, nodeId, updater)
    )
  };
}

export function removeNodeFromTree(rootNode: MindMapNode, nodeId: string): MindMapNode {
  return {
    ...rootNode,
    children: rootNode.children?.filter(child => child.id !== nodeId)
      .map(child => removeNodeFromTree(child, nodeId))
  };
}